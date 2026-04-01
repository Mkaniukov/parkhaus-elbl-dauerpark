import type { Handler } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'
import nodemailer from 'nodemailer'
import { applicationPayloadSchema, type ApplicationPayload } from '../../src/lib/schema'
import { GARAGEN, TARIFE } from '../../src/lib/constants'

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

function tarifLabel(id: string): string {
  return TARIFE.find((t) => t.id === id)?.label ?? id
}

function garageLabel(id: string): string {
  return GARAGEN.find((g) => g.id === id)?.label ?? id
}

function buildEmailHtml(payload: ApplicationPayload): string {
  const rows: [string, string][] = [
    ['Name / Firma', payload.name_firma],
    ['Adresse', payload.adresse],
    ['Telefon', payload.telefon],
    ['E-Mail', payload.email],
    ['Beginn', payload.beginn],
    ['Garage', garageLabel(payload.garage)],
    ['Fahrzeug', payload.fahrzeug],
    ['Kennzeichen', payload.kennzeichen],
    ['Tarif', tarifLabel(payload.tarif)],
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
  return `<!DOCTYPE html><html><body><h2>Neuer Dauerpark-Antrag</h2><table>${table}</table></body></html>`
}

/** Google Workspace / Gmail SMTP (App-Passwort ohne Leerzeichen). */
async function sendSmtpEmail(html: string, subject: string) {
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
  })
}

async function sendResendEmail(html: string, subject: string) {
  const key = process.env.RESEND_API_KEY!
  const to = process.env.NOTIFY_TO ?? 'office@parkhaus-elbl.at'
  const from = process.env.NOTIFY_FROM!
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      html,
    }),
  })
  if (!r.ok) {
    const t = await r.text()
    console.error('Resend error', r.status, t)
    throw new Error('E-Mail-Versand fehlgeschlagen')
  }
}

export const handler: Handler = async (event) => {
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
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
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

  if (hasDb) {
    const supabase = createClient(supabaseUrl!, serviceKey!)
    const { error } = await supabase.from('dauerpark_antraege').insert({
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
    if (error) {
      console.error('Supabase insert', error)
      return json(500, { ok: false, error: 'Speichern fehlgeschlagen.' })
    }
  }

  try {
    const html = buildEmailHtml(data)
    const subj = `Dauerpark-Antrag: ${data.name_firma} — ${data.kennzeichen}`
    if (hasSmtp) {
      await sendSmtpEmail(html, subj)
    } else if (hasResend) {
      await sendResendEmail(html, subj)
    } else {
      console.warn('Kein E-Mail-Versand konfiguriert — nur Datenbank')
    }
  } catch (e) {
    console.error(e)
    return json(500, { ok: false, error: 'E-Mail konnte nicht gesendet werden.' })
  }

  return json(200, { ok: true })
}
