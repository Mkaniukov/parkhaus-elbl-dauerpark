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

function buildEmailHtml(
  payload: ApplicationPayload,
  options?: { hasWordAttachment: boolean },
): string {
  const rows: [string, string][] = [
    ['Name / Firma', payload.name_firma],
    ['Adresse', payload.adresse],
    ['Telefon', payload.telefon],
    ['E-Mail', payload.email],
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
  const anhang =
    options?.hasWordAttachment === true
      ? '<p style="margin-top:14px;font-size:14px">Anhang: dieselben Daten als <strong>Microsoft Word (.docx)</strong> zur Bearbeitung in der Buchhaltung.</p>'
      : ''
  return `<!DOCTYPE html><html><body><h2>Neuer Dauerpark-Antrag</h2><table>${table}</table>${anhang}</body></html>`
}

/** Google Workspace / Gmail SMTP (App-Passwort ohne Leerzeichen). */
type MailAttachment = { filename: string; content: Buffer }

async function sendSmtpEmail(
  html: string,
  subject: string,
  attachment?: MailAttachment,
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
  const from =
    process.env.MAIL_FROM ?? `Parkhaus ELBL <${user}>`
  const to = process.env.NOTIFY_TO ?? 'office@parkhaus-elbl.at'

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  })
  await transporter.sendMail({
    from,
    to,
    subject,
    html,
    attachments: attachment
      ? [
          {
            filename: attachment.filename,
            content: attachment.content,
            contentType:
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          },
        ]
      : [],
  })
}

async function sendResendEmail(
  html: string,
  subject: string,
  attachment?: MailAttachment,
) {
  const key = process.env.RESEND_API_KEY!
  const to = process.env.NOTIFY_TO ?? 'office@parkhaus-elbl.at'
  const from = process.env.NOTIFY_FROM!
  const body: Record<string, unknown> = {
    from,
    to: [to],
    subject,
    html,
  }
  if (attachment) {
    body.attachments = [
      {
        filename: attachment.filename,
        content: attachment.content.toString('base64'),
      },
    ]
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

  if (raw._hp && String(raw._hp).trim() !== '') {
    return json(200, { ok: true })
  }
  delete raw._hp

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

  if (hasSmtp && !hasDb) {
    console.warn(
      'Supabase: INSERT übersprungen — SUPABASE_URL und/oder SUPABASE_SERVICE_ROLE_KEY (oder SUPABASE_SECRET_KEY) fehlen in den Function-Umgebungsvariablen. E-Mail wird trotzdem gesendet.',
    )
  }

  if (hasDb) {
    const supabase = createClient(supabaseUrl!, serviceKey!)
    const { data: inserted, error } = await supabase
      .from('dauerpark_antraege')
      .insert({
        name_firma: data.name_firma,
        adresse: data.adresse,
        telefon: data.telefon,
        email: data.email,
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
    if (inserted?.id && process.env.SKIP_GENERATE_CONTRACT !== 'true') {
      void triggerGenerateContract(supabaseUrl!, serviceKey!, inserted.id)
    }
  }

  let wordAttachment: MailAttachment | undefined
  if (
    (hasSmtp || hasResend) &&
    process.env.SKIP_WORD_ATTACHMENT !== 'true'
  ) {
    try {
      // Dynamischer Import: verhindert Absturz beim Cold Start, falls docx nicht lädt
      const mod = await import('./buildAntragDocx')
      const buf = await mod.buildAntragDocx(data)
      wordAttachment = {
        filename: mod.antragDocxFilename(data),
        content: buf,
      }
    } catch (e) {
      console.error('Word-Anhang konnte nicht erzeugt werden', e)
    }
  } else if (process.env.SKIP_WORD_ATTACHMENT === 'true') {
    console.warn('SKIP_WORD_ATTACHMENT: kein .docx-Anhang')
  }

  const subj = `Dauerpark-Antrag: ${data.name_firma} — ${data.kennzeichen}`

  try {
    let html = buildEmailHtml(data, {
      hasWordAttachment: Boolean(wordAttachment),
    })
    if (hasSmtp) {
      try {
        await sendSmtpEmail(html, subj, wordAttachment)
      } catch (e) {
        if (wordAttachment) {
          console.warn(
            'SMTP mit Anhang fehlgeschlagen, ohne Anhang wiederholen',
            e,
          )
          html = buildEmailHtml(data, { hasWordAttachment: false })
          await sendSmtpEmail(html, subj, undefined)
        } else {
          throw e
        }
      }
    } else if (hasResend) {
      try {
        await sendResendEmail(html, subj, wordAttachment)
      } catch (e) {
        if (wordAttachment) {
          console.warn(
            'Resend mit Anhang fehlgeschlagen, ohne Anhang wiederholen',
            e,
          )
          html = buildEmailHtml(data, { hasWordAttachment: false })
          await sendResendEmail(html, subj, undefined)
        } else {
          throw e
        }
      }
    } else {
      console.warn('Kein E-Mail-Versand konfiguriert — nur Datenbank')
    }
  } catch (e) {
    console.error(e)
    return json(500, { ok: false, error: 'E-Mail konnte nicht gesendet werden.' })
  }

  return json(200, { ok: true })
}

/** Edge Function `generate-contract` — Google-Doc aus Vorlage; optional per SKIP_GENERATE_CONTRACT aus. */
async function triggerGenerateContract(
  supabaseUrl: string,
  serviceKey: string,
  recordId: string,
): Promise<void> {
  const url = `${supabaseUrl.replace(/\/$/, '')}/functions/v1/generate-contract`
  const r = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${serviceKey}`,
    },
    body: JSON.stringify({ record_id: recordId }),
  })
  if (!r.ok) {
    const t = await r.text()
    console.error('generate-contract', r.status, t)
  }
}
