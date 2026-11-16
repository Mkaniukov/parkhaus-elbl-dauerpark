import type { AdminSettings, CatalogGarage } from '../lib/catalogModel'
import { apiUrl } from '../lib/apiUrl'

const TOKEN_KEY = 'elbl-admin-token'

export type CatalogSource = 'file' | 'supabase' | 'fallback'

export type AdminState = {
  ok: true
  source: CatalogSource
  writable: boolean
  notice: string
  garagen: CatalogGarage[]
  settings: AdminSettings
}

export type AntragListItem = {
  id: string
  created_at: string
  name_firma: string
  email: string
  telefon: string
  garage: string
  tarif: string
  kennzeichen: string
  beginn: string
  fahrzeug: string
}

export class AdminRequestError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

export function readToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY)
}

export function writeToken(token: string | null): void {
  if (token) sessionStorage.setItem(TOKEN_KEY, token)
  else sessionStorage.removeItem(TOKEN_KEY)
}

export async function adminFetch<T>(
  action: string,
  body: object | undefined,
  token: string | null,
): Promise<T> {
  const res = await fetch(apiUrl('admin'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ action, ...body }),
  })
  const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string }
  if (!res.ok || json.ok === false) {
    throw new AdminRequestError(json.error || 'Anfrage fehlgeschlagen.', res.status)
  }
  return json as T
}
