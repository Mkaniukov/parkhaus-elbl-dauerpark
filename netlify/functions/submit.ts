import type { Handler } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'
import nodemailer from 'nodemailer'
import { applicationPayloadSchema, type ApplicationPayload } from '../../src/lib/schema'
import { GARAGEN, formatTarifLine } from '../../src/lib/constants'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(statusCode: number, body: object) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
    body: JSON.stringify(body),
  }
}

function garageLabel(id: string): string {
  return GARAGEN.find((g) => g.id === id)?.label ?? id
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function buildEmailHtml(
  payload: ApplicationPayload,
  options?: {
    contractDocUrl?: string
    hasContractPdfAttachment?: boolean
  },
): string {
  const rows: [string, string][] = [
    ['Name / Firma', payload.name_firma],
    ['Adresse', payload.adresse],
    ['Telefon', payload.telefon],
    ['E-Mail', payload.email],
    ['Stellplatz-Nutzer', payload.stellplatz_nutzer.trim() || '—'],
    ['Beginn', payload.beginn],
    ['Garage', garageLabel(payload.garage)],
    ['Fahrzeug', payload.fahrzeug],
    ['Kennzeichen', payload.kennzeichen],
    ['Tarif', formatTarifLine(payload.tarif)],
    ['IBAN', payload.iban],
    ['BIC', payload.bic ?? '—'],
    ['Lautend auf', payload.lautend_auf],
  ]
  const table = rows
    .map(
      ([k, v]) =>
        `<tr><td style="padding:6px 12px;border:1px solid #ddd"><strong>${k}</strong></td><td style="padding:6px 12px;border:1px solid #ddd">${String(v)}</td></tr>`,
    )
    .join('')
  const vertragLink =
    options?.contractDocUrl && options.contractDocUrl.trim() !== ''
      ? `<p style="margin-top:14px"><strong>Dauerpark-Vertrag (Google Doc):</strong> <a href="${escapeHtml(options.contractDocUrl)}">Dokument öffnen</a></p>`
      : ''
  const pdfHinweis = options?.hasContractPdfAttachment
    ? '<p style="margin-top:8px;font-size:14px">Anhang: <strong>PDF-Export</strong> des Vertrags (Vorlage).</p>'
    : ''
  return `<!DOCTYPE html><html><body><h2>Neuer Dauerpark-Antrag</h2><table>${table}</table>${vertragLink}${pdfHinweis}</body></html>`
}

/** Kurze Bestätigung direkt an Antragsteller:in (ohne Anhänge — weniger Spam-Risiko). */
function buildApplicantConfirmationHtml(
  nameFirma: string,
  officeMailto: string,
): string {
  const safeOffice = escapeHtml(officeMailto.trim())
  const suffix =
    nameFirma.trim().length > 0
      ? `<p style="margin-top:14px;font-size:14px;color:#4b5563">Bezug: <strong>${escapeHtml(nameFirma.trim())}</strong></p>`
      : ''
  return `<!DOCTYPE html><html lang="de"><head><meta charset="utf-8"/></head><body style="font-family:Segoe UI,system-ui,-apple-system,sans-serif;font-size:15px;line-height:1.55;color:#1a1f2e;max-width:36rem;margin:0;padding:16px">
<p>Sehr geehrte Damen und Herren,</p>
<p>vielen Dank für Ihre Online-Anmeldung eines <strong>Dauerparkplatzes</strong> bei Parkhaus ELBL.</p>
<p>Wir haben Ihre Daten erfolgreich erhalten und werden sie schnellstmöglich bearbeiten. Bei offenen Punkten oder weiteren Schritten meldet sich eine Kollegin oder ein Kollege bei Ihnen.</p>
<p>Bis dahin bitten wir Sie um ein wenig Geduld — wir kümmern uns zeitnah um Ihre Anfrage.</p>
${suffix}
<hr style="border:none;border-top:1px solid #e5e7eb;margin:22px 0"/>
<p style="font-size:13px;color:#6b7280">Mit freundlichen Grüßen<br/><strong>Parkhaus ELBL</strong></p>
<p style="font-size:13px;color:#6b7280">Bei Fragen erreichen Sie uns unter <a href="mailto:${safeOffice}">${safeOffice}</a>.</p>
</body></html>`
}

/** Google Workspace / Gmail SMTP (App-Passwort ohne Leerzeichen). */
type MailAttachment = { filename: string; content: Buffer }

/** Rückgabe von Edge Function generate-contract (Mail: Link + PDF). */
type ContractFromGoogle = { url: string; pdfBuffer?: Buffer }

function contentTypeForFilename(filename: string): string {
  if (filename.endsWith('.pdf')) return 'application/pdf'
  if (filename.endsWith('.docx')) {
    return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  }
  return 'application/octet-stream'
}

/** Google „Vertrag“ für Dateiname (PDF). */
function contractPdfFilename(kennzeichen: string): string {
  const safe = kennzeichen
    .replace(/[^\w-]+/gu, '_')
    .replace(/_+/g, '_')
    .slice(0, 40)
  return `Dauerparkvertrag-${safe || 'Antrag'}.pdf`
}

type MailSendOptions = {
  /** Reply-To auf Antragsteller:in — nur Büromail; keine BCC-Kopie (die schickt eine eigene Bestätigung). */
  applicantEmail?: string
  /** Direkt an diese Adresse (Bestätigung an Kund:in); dann kein automatisches Reply-To aus applicantEmail. */
  directTo?: string
  /** Reply-To Header (z.&nbsp;B. Büroadresse bei Bestätigung an Antragsteller:in). */
  replyTo?: string
}

/**
 * Gmail/Google Workspace: authentifizierter User (MAIL_USER) muss mit der Absender-Adresse übereinstimmen.
 * Sonst SMTP 500/535 nach Wechsel von MAIL_USER ohne MAIL_FROM-Anpassung.
 */
function resolveSmtpFromEnvelope(): string {
  const user = process.env.MAIL_USER!.trim()
  const raw = process.env.MAIL_FROM?.trim()
  if (!raw) return `"Parkhaus ELBL" <${user}>`

  const m = /<([^>]+)>/.exec(raw)
  const addrInHeader = (m?.[1] ?? '').trim().toLowerCase()
  /** Kein Parser-Match → freier Text, lieber MAIL_USER verwenden */
  if (!addrInHeader) return `"Parkhaus ELBL" <${user}>`

  if (addrInHeader !== user.toLowerCase()) {
    console.warn(
      `submit SMTP: MAIL_FROM enthält (${addrInHeader}), MAIL_USER=${user} — Absender angepasst (Google-SMTP-Anforderung).`,
    )
    let namePart = raw.split('<')[0]?.trim() ?? ''
    namePart = namePart.replace(/^["']+|["']+$/g, '').trim() || 'Parkhaus ELBL'
    return `"${namePart}" <${user}>`
  }

  return raw
}

/** Nutzerhilfe bei 500, ohne SMTP-Secrets zu loggen. */
function publicMailErrorHint(err: unknown): string | undefined {
  if (!(err instanceof Error)) return undefined
  const msg = `${err.message} ${'response' in err ? String((err as { response?: string }).response) : ''}`.toLowerCase()
  const code =
    typeof (err as NodeJS.ErrnoException).code === 'string'
      ? (err as NodeJS.ErrnoException).code
      : ''

  const responseCodeRaw = (err as { responseCode?: number }).responseCode
  const responseCode =
    typeof responseCodeRaw === 'number' ? responseCodeRaw : NaN

  if (
    responseCode === 535 ||
    responseCode === 534 ||
    responseCode === 553 ||
    msg.includes('535') ||
    msg.includes('invalid login') ||
    msg.includes('authentication failed')
  ) {
    return (
      'E-Mail-Anmeldung beim SMTP-Server wurde abgewiesen. Prüfen: MAIL_USER und App-Passwort passen zusammen;' +
      ' MAIL_FROM darf keine andere Gmail/Workspace-Adresse enthalten als MAIL_USER.'
    )
  }

  if (code === 'ETIMEDOUT' || msg.includes('timeout'))
    return 'E-Mail Zeitüberschreitung (SMTP). Später versuchen oder Resend verwenden.'
  if (code === 'ECONNECTION' || code === 'ECONNREFUSED')
    return 'Keine SMTP-Verbindung möglich. Host/Port in Netlify prüfen.'
  return undefined
}

async function sendSmtpEmail(
  html: string,
  subject: string,
  attachments: MailAttachment[],
  options?: MailSendOptions,
) {
  const host = process.env.MAIL_HOST ?? 'smtp.gmail.com'
  const port = Number(process.env.MAIL_PORT ?? '465')
  const secure =
    process.env.MAIL_SECURE === 'true'
      ? true
      : process.env.MAIL_SECURE === 'false'
        ? false
        : port === 465
  const user = process.env.MAIL_USER!
  const pass = process.env.MAIL_PASSWORD!.replace(/\s+/g, '')
  const from = resolveSmtpFromEnvelope()
  const notifyTo = process.env.NOTIFY_TO ?? 'office@parkhaus-elbl.at'
  const to = options?.directTo?.trim() || notifyTo
  const replyHeader =
    options?.replyTo?.trim() ||
    (!options?.directTo && options?.applicantEmail
      ? options.applicantEmail.trim()
      : undefined)

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  })
  await transporter.sendMail({
    from,
    to,
    ...(replyHeader ? { replyTo: replyHeader } : {}),
    subject,
    html,
    attachments: attachments.map((a) => ({
      filename: a.filename,
      content: a.content,
      contentType: contentTypeForFilename(a.filename),
    })),
  })
}

async function sendResendEmail(
  html: string,
  subject: string,
  attachments: MailAttachment[],
  options?: MailSendOptions,
) {
  const key = process.env.RESEND_API_KEY!
  const notifyTo = process.env.NOTIFY_TO ?? 'office@parkhaus-elbl.at'
  const toAddr = options?.directTo?.trim() || notifyTo
  const from = process.env.NOTIFY_FROM!
  const replyHeader =
    options?.replyTo?.trim() ||
    (!options?.directTo && options?.applicantEmail
      ? options.applicantEmail.trim()
      : undefined)
  const body: Record<string, unknown> = {
    from,
    to: [toAddr],
    ...(replyHeader ? { reply_to: replyHeader } : {}),
    subject,
    html,
  }
  if (attachments.length > 0) {
    body.attachments = attachments.map((a) => ({
      filename: a.filename,
      content: a.content.toString('base64'),
    }))
  }
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  if (!r.ok) {
    const t = await r.text()
    console.error('Resend error', r.status, t)
    throw new Error('E-Mail-Versand fehlgeschlagen')
  }
}

/** SMTP von Netlify aus oft blockiert — Resend (HTTP) zuerst in der Aufrufkette. */
async function sendMailWithAttachmentRetry(
  transport: 'resend' | 'smtp',
  data: ApplicationPayload,
  subj: string,
  mailAttachments: MailAttachment[],
  contractFromGoogle: ContractFromGoogle | undefined,
): Promise<void> {
  const opts: MailSendOptions = { applicantEmail: data.email }
  const send = transport === 'resend' ? sendResendEmail : sendSmtpEmail
  let html = buildEmailHtml(data, {
    contractDocUrl: contractFromGoogle?.url,
    hasContractPdfAttachment: Boolean(contractFromGoogle?.pdfBuffer),
  })
  try {
    await send(html, subj, mailAttachments, opts)
  } catch (e) {
    if (mailAttachments.length > 0) {
      console.warn(
        `${transport}: Versand mit Anhang fehlgeschlagen, ohne Anhang wiederholen`,
        e,
      )
      html = buildEmailHtml(data, {
        contractDocUrl: contractFromGoogle?.url,
        hasContractPdfAttachment: false,
      })
      await send(html, subj, [], opts)
    } else {
      throw e
    }
  }
}

export const handler: Handler = async (event) => {
  try {
    return await handleSubmit(event)
  } catch (err) {
    console.error('submit: unhandled', err)
    return json(500, {
      ok: false,
      error: 'Interner Serverfehler. Bitte Netlify Function-Logs prüfen.',
    })
  }
}

async function handleSubmit(event: Parameters<Handler>[0]) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' }
  }
  if (event.httpMethod !== 'POST') {
    return json(405, { ok: false, error: 'Method Not Allowed' })
  }

  let raw: Record<string, unknown>
  try {
    raw = JSON.parse(event.body || '{}') as Record<string, unknown>
  } catch {
    return json(400, { ok: false, error: 'Ungültige JSON-Daten' })
  }

  /** Honeypot: Bots füllen oft aus; echte Nutzer lassen leer. */
  const hpRaw = raw.company_website
  delete raw.company_website
  if (
    typeof hpRaw === 'string' &&
    hpRaw.trim() !== ''
  ) {
    console.warn('submit: honeypot company_website nicht leer — Abbruch (stilles OK)', {
      len: hpRaw.length,
    })
    return json(200, { ok: true })
  }

  const parsed = applicationPayloadSchema.safeParse(raw)
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => i.message).join('; ')
    return json(400, { ok: false, error: msg })
  }

  const data = parsed.data
  const supabaseUrl = process.env.SUPABASE_URL
  /** Legacy name + neuer Name „Secret“ im Supabase-Dashboard */
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY
  const hasDb = Boolean(supabaseUrl && serviceKey)
  const hasSmtp = Boolean(process.env.MAIL_USER && process.env.MAIL_PASSWORD)
  const hasResend = Boolean(
    process.env.RESEND_API_KEY && process.env.NOTIFY_FROM,
  )

  if (!hasDb && !hasSmtp && !hasResend) {
    console.error('Konfiguration fehlt', {
      hasDb,
      hasSmtp,
      hasResend,
      mailUserSet: Boolean(process.env.MAIL_USER),
      mailPassSet: Boolean(process.env.MAIL_PASSWORD),
    })
    return json(503, {
      ok: false,
      error:
        'Server-Konfiguration: In Netlify unter Environment variables mindestens MAIL_USER und MAIL_PASSWORD setzen (oder Supabase URL + Service Role), Scope „Production“ wählen und Site neu deployen.',
    })
  }

  console.info('submit: verarbeite Antrag', {
    hasDb,
    hasSmtp,
    hasResend,
    skipContract: process.env.SKIP_GENERATE_CONTRACT === 'true',
    /** Explizit `true`: PDF-Anhang zur Mail — größer/Timeout-Risiko. */
    mailAttachContractPdf: process.env.MAIL_INCLUDE_CONTRACT_PDF === 'true',
  })

  if (hasSmtp && !hasDb) {
    console.warn(
      'Supabase: INSERT übersprungen — SUPABASE_URL und/oder SUPABASE_SERVICE_ROLE_KEY (oder SUPABASE_SECRET_KEY) fehlen in den Function-Umgebungsvariablen. E-Mail wird trotzdem gesendet.',
    )
  }

  /** Vor PDF-Anhang ging die Mail schneller. Nur bei `MAIL_INCLUDE_CONTRACT_PDF=true`: großes PDF aus der Edge Function + Anhang (Timeout/SMTP-Risiko). */
  const mailIncludeContractPdf =
    process.env.MAIL_INCLUDE_CONTRACT_PDF === 'true'

  const shouldMail = hasSmtp || hasResend

  let contractFromGoogle: ContractFromGoogle | undefined

  if (hasDb) {
    const supabase = createClient(supabaseUrl!, serviceKey!)
    const { data: inserted, error } = await supabase
      .from('dauerpark_antraege')
      .insert({
        name_firma: data.name_firma,
        adresse: data.adresse,
        telefon: data.telefon,
        email: data.email,
        stellplatz_nutzer: (() => {
          const s = data.stellplatz_nutzer.trim()
          return s.length > 0 ? s : null
        })(),
        beginn: data.beginn,
        fahrzeug: data.fahrzeug,
        kennzeichen: data.kennzeichen,
        iban: data.iban,
        bic: data.bic ?? null,
        lautend_auf: data.lautend_auf,
        tarif: data.tarif,
        garage: data.garage,
        agb_akzeptiert: data.agb_akzeptiert,
        sepa_akzeptiert: data.sepa_akzeptiert,
        datenschutz_akzeptiert: data.datenschutz_akzeptiert,
      })
      .select('id')
      .single()
    if (error) {
      console.error('Supabase insert', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      })
      return json(500, { ok: false, error: 'Speichern fehlgeschlagen.' })
    }
    const contractPromise =
      inserted?.id && process.env.SKIP_GENERATE_CONTRACT !== 'true'
        ? fetchGenerateContract(
            supabaseUrl!,
            serviceKey!,
            inserted.id,
            mailIncludeContractPdf,
          )
        : Promise.resolve(undefined as ContractFromGoogle | undefined)

    contractFromGoogle = await contractPromise
  } else {
    contractFromGoogle = undefined
  }

  const mailAttachments: MailAttachment[] = []
  if (mailIncludeContractPdf && contractFromGoogle?.pdfBuffer) {
    mailAttachments.push({
      filename: contractPdfFilename(data.kennzeichen),
      content: contractFromGoogle.pdfBuffer,
    })
  }

  const subj = `Dauerpark-Antrag: ${data.name_firma} — ${data.kennzeichen}`

  try {
    const mailChain: ('resend' | 'smtp')[] = []
    if (hasResend) mailChain.push('resend')
    if (hasSmtp) mailChain.push('smtp')

    let mailOk = false
    let lastMailErr: unknown
    for (const t of mailChain) {
      try {
        await sendMailWithAttachmentRetry(
          t,
          data,
          subj,
          mailAttachments,
          contractFromGoogle,
        )
        mailOk = true
        break
      } catch (e) {
        lastMailErr = e
        console.error(`submit: E-Mail via ${t} fehlgeschlagen`, e)
      }
    }

    if (!mailOk && mailChain.length > 0) {
      throw lastMailErr
    }

    if (!mailOk && mailChain.length === 0) {
      console.error(
        'submit: KEIN E-Mail-Versand — in Netlify Production fehlen MAIL_USER/MAIL_PASSWORD oder (RESEND_API_KEY + NOTIFY_FROM). Daten wurden ggf. gespeichert.',
        { hasDb },
      )
    }

    /** Separates Bestätigung an Antragsteller:in — ohne Anhänge; schlägt nicht den gesamten Antrag fehl. */
    const applicantAddr = data.email.trim()
    const notifyAddr = process.env.NOTIFY_TO ?? 'office@parkhaus-elbl.at'
    if (mailOk && mailChain.length > 0 && applicantAddr.length > 0) {
      const confirmHtml = buildApplicantConfirmationHtml(
        data.name_firma,
        notifyAddr,
      )
      const confirmSubj =
        'Bestätigung: Ihre Dauerpark-Anmeldung ist eingegangen'
      const confirmOpts: MailSendOptions = {
        directTo: applicantAddr,
        replyTo: notifyAddr,
      }
      let confirmOk = false
      let confirmLastErr: unknown
      for (const t of mailChain) {
        try {
          const send = t === 'resend' ? sendResendEmail : sendSmtpEmail
          await send(confirmHtml, confirmSubj, [], confirmOpts)
          confirmOk = true
          break
        } catch (e) {
          confirmLastErr = e
          console.error(
            `submit: Bestätigung an Antragsteller:in via ${t} fehlgeschlagen`,
            e,
          )
        }
      }
      if (!confirmOk) {
        console.error(
          'submit: Bestätigungsmail an Antragsteller:in nicht zustellbar',
          confirmLastErr,
        )
      }
    }
  } catch (e) {
    console.error(e)
    const hint = publicMailErrorHint(e)
    return json(500, {
      ok: false,
      error: hint ?? 'E-Mail konnte nicht gesendet werden.',
    })
  }

  const mailSkipped = !hasSmtp && !hasResend
  return json(200, { ok: true, mailSkipped })
}

/** Edge Function generate-contract: Doc + URL in DB; optional PDF für Mail-Anhang (teuer bei Timeout/SMTP). */
async function fetchGenerateContract(
  supabaseUrl: string,
  serviceKey: string,
  recordId: string,
  requestPdfFromEdge: boolean,
): Promise<ContractFromGoogle | undefined> {
  const url = `${supabaseUrl.replace(/\/$/, '')}/functions/v1/generate-contract`
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
      record_id: recordId,
      return_pdf: requestPdfFromEdge,
    }),
    })
    const text = await r.text()
    if (!r.ok) {
      console.error('generate-contract', r.status, text)
      return undefined
    }
    let parsed: {
      ok?: boolean
      contract_pdf_url?: string
      contract_pdf_base64?: string
    }
    try {
      parsed = JSON.parse(text) as typeof parsed
    } catch {
      console.error('generate-contract: kein JSON', text.slice(0, 300))
      return undefined
    }
    if (!parsed.ok || !parsed.contract_pdf_url) return undefined
    let pdfBuffer: Buffer | undefined
    if (parsed.contract_pdf_base64) {
      try {
        pdfBuffer = Buffer.from(parsed.contract_pdf_base64, 'base64')
      } catch (e) {
        console.error('generate-contract: PDF base64', e)
      }
    }
    return { url: parsed.contract_pdf_url, pdfBuffer }
  } catch (e) {
    console.error('generate-contract request', e)
    return undefined
  }
}
