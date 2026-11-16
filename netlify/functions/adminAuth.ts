import { createHmac, timingSafeEqual } from 'node:crypto'

const TTL_MS = 12 * 60 * 60 * 1000

function secret(): string {
  return (
    process.env.ADMIN_TOKEN_SECRET?.trim() ||
    process.env.ADMIN_PASSWORD?.trim() ||
    ''
  )
}

export function passwordConfigured(): boolean {
  return (process.env.ADMIN_PASSWORD?.trim().length ?? 0) >= 8
}

export function checkPassword(password: string): boolean {
  const expected = process.env.ADMIN_PASSWORD?.trim() ?? ''
  if (expected.length < 8) return false
  const a = Buffer.from(password.trim())
  const b = Buffer.from(expected)
  if (a.length !== b.length) {
    timingSafeEqual(b, b)
    return false
  }
  return timingSafeEqual(a, b)
}

export function signToken(): string {
  const key = secret()
  if (!key) throw new Error('ADMIN_PASSWORD fehlt')
  const payload = Buffer.from(
    JSON.stringify({ exp: Date.now() + TTL_MS }),
  ).toString('base64url')
  const sig = createHmac('sha256', key).update(payload).digest('base64url')
  return `${payload}.${sig}`
}

export function verifyToken(token: string | undefined): boolean {
  const key = secret()
  if (!token || !key) return false
  const dot = token.indexOf('.')
  if (dot <= 0) return false
  const payload = token.slice(0, dot)
  const sig = token.slice(dot + 1)
  const expected = createHmac('sha256', key).update(payload).digest('base64url')
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false
  try {
    const body = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      exp?: unknown
    }
    return typeof body.exp === 'number' && body.exp > Date.now()
  } catch {
    return false
  }
}

export function bearerToken(headers: Record<string, string | undefined> | undefined): string | undefined {
  const raw = headers?.authorization ?? headers?.Authorization
  if (!raw) return undefined
  const m = /^Bearer\s+(.+)$/i.exec(raw.trim())
  return m?.[1]
}
