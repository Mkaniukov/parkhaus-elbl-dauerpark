import type { Handler, HandlerEvent } from '@netlify/functions'
import { bearerToken, checkPassword, passwordConfigured, signToken, verifyToken } from './adminAuth'
import {
  deleteGarage,
  listAntraege,
  loadCatalog,
  reorderGarages,
  saveGarage,
  saveSettings,
  type GarageInput,
  type LoadedCatalog,
} from './catalogStore'
import type { AdminSettings } from '../../src/lib/catalogModel'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Cache-Control': 'no-store',
}

const fails = new Map<string, { n: number; until: number }>()

function json(statusCode: number, body: object) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
    body: JSON.stringify(body),
  }
}

function headersOf(event: HandlerEvent): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {}
  for (const [key, value] of Object.entries(event.headers ?? {})) {
    out[key] = Array.isArray(value) ? value[0] : value
  }
  return out
}

function clientIp(headers: Record<string, string | undefined>): string {
  const raw =
    headers['x-nf-client-connection-ip'] ??
    headers['x-forwarded-for'] ??
    'local'
  return raw.split(',')[0]?.trim() || 'local'
}

function stateBody(loaded: LoadedCatalog) {
  return {
    ok: true as const,
    source: loaded.source,
    writable: loaded.writable,
    notice: loaded.notice,
    garagen: loaded.catalog.garagen,
    settings: loaded.catalog.settings,
  }
}

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' }
  }
  if (event.httpMethod !== 'POST') {
    return json(405, { ok: false, error: 'Method Not Allowed' })
  }

  let body: {
    action?: string
    password?: string
    garage?: GarageInput
    id?: string
    ids?: string[]
    settings?: AdminSettings
  }
  try {
    body = JSON.parse(event.body || '{}') as typeof body
  } catch {
    return json(400, { ok: false, error: 'Ungültige JSON-Daten' })
  }

  const headers = headersOf(event)

  if (body.action === 'login') {
    const ip = clientIp(headers)
    const block = fails.get(ip)
    if (block && block.until > Date.now()) {
      return json(429, { ok: false, error: 'Zu viele Versuche. Bitte eine Minute warten.' })
    }
    if (block && block.until > 0 && block.until <= Date.now()) {
      fails.delete(ip)
    }
    if (!passwordConfigured()) {
      return json(503, {
        ok: false,
        error:
          'ADMIN_PASSWORD fehlt oder ist kürzer als 8 Zeichen. In Netlify unter Environment variables setzen (nicht ins Frontend).',
      })
    }
    if (!checkPassword(typeof body.password === 'string' ? body.password : '')) {
      const prev = fails.get(ip)
      const n = (prev?.n ?? 0) + 1
      fails.set(ip, { n, until: n >= 8 ? Date.now() + 60_000 : 0 })
      return json(401, { ok: false, error: 'Passwort falsch.' })
    }
    fails.delete(ip)
    return json(200, { ok: true, token: signToken() })
  }

  if (!verifyToken(bearerToken(headers))) {
    return json(401, { ok: false, error: 'Bitte erneut anmelden.' })
  }

  try {
    switch (body.action) {
      case 'state':
        return json(200, stateBody(await loadCatalog()))
      case 'saveGarage': {
        if (!body.garage) return json(400, { ok: false, error: 'Garage fehlt.' })
        return json(200, stateBody(await saveGarage(body.garage)))
      }
      case 'deleteGarage': {
        if (!body.id) return json(400, { ok: false, error: 'Garage fehlt.' })
        return json(200, stateBody(await deleteGarage(body.id)))
      }
      case 'reorderGarages': {
        if (!Array.isArray(body.ids)) {
          return json(400, { ok: false, error: 'Reihenfolge fehlt.' })
        }
        return json(200, stateBody(await reorderGarages(body.ids)))
      }
      case 'saveSettings': {
        if (!body.settings) return json(400, { ok: false, error: 'Einstellungen fehlen.' })
        return json(200, stateBody(await saveSettings(body.settings)))
      }
      case 'antraege': {
        const list = await listAntraege()
        return json(200, { ok: true, ...list })
      }
      default:
        return json(400, { ok: false, error: 'Unbekannte Aktion.' })
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Speichern fehlgeschlagen.'
    console.error('admin', body.action, e)
    return json(400, { ok: false, error: message })
  }
}
