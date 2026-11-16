import {
  AGB_PDF_URL,
  GARAGEN,
  KAUTION_EUR,
  KUENDIGUNG_HINWEIS,
  MIN_VERTRAG_MONATE,
} from './constants'

export const DEFAULT_PUBLIC_EMAIL = 'office@parkhaus-elbl.at'

export type CatalogTarif = {
  id: string
  label: string
  detail: string
  active: boolean
  sortOrder: number
}

export type CatalogGarage = {
  id: string
  label: string
  vertragsAdresse: string
  active: boolean
  sortOrder: number
  tarife: CatalogTarif[]
}

export type PublicSettings = {
  publicEmail: string
  kationEur: number
  minVertragMonate: number
  kuendigungHinweis: string
  agbPdfUrl: string
}

export type AdminSettings = PublicSettings & {
  /** Eine oder mehrere Adressen, durch Zeilenumbruch oder Komma getrennt. */
  notifyTo: string
}

export type FullCatalog = {
  garagen: CatalogGarage[]
  settings: AdminSettings
}

export type PublicCatalog = {
  garagen: CatalogGarage[]
  settings: PublicSettings
}

export function fallbackCatalog(): FullCatalog {
  return {
    garagen: GARAGEN.map((g, i) => ({
      id: g.id,
      label: g.label,
      vertragsAdresse: g.vertragsAdresse,
      active: true,
      sortOrder: i,
      tarife: g.tarife.map((t, j) => ({
        id: t.id,
        label: t.label,
        detail: t.detail,
        active: true,
        sortOrder: j,
      })),
    })),
    settings: {
      notifyTo: DEFAULT_PUBLIC_EMAIL,
      publicEmail: DEFAULT_PUBLIC_EMAIL,
      kationEur: KAUTION_EUR,
      minVertragMonate: MIN_VERTRAG_MONATE,
      kuendigungHinweis: KUENDIGUNG_HINWEIS,
      agbPdfUrl: AGB_PDF_URL,
    },
  }
}

export function toPublicCatalog(full: FullCatalog): PublicCatalog {
  const garagen = full.garagen
    .filter((g) => g.active)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label, 'de'))
    .map((g) => ({
      ...g,
      tarife: g.tarife
        .filter((t) => t.active)
        .sort((a, b) => a.sortOrder - b.sortOrder),
    }))
    .filter((g) => g.tarife.length > 0)
  return {
    garagen,
    settings: {
      publicEmail: full.settings.publicEmail,
      kationEur: full.settings.kationEur,
      minVertragMonate: full.settings.minVertragMonate,
      kuendigungHinweis: full.settings.kuendigungHinweis,
      agbPdfUrl: full.settings.agbPdfUrl,
    },
  }
}

export function isPublicSettings(v: unknown): v is PublicSettings {
  if (!v || typeof v !== 'object') return false
  const s = v as PublicSettings
  return (
    typeof s.publicEmail === 'string' &&
    typeof s.kuendigungHinweis === 'string' &&
    typeof s.agbPdfUrl === 'string' &&
    typeof s.kationEur === 'number' &&
    Number.isFinite(s.kationEur) &&
    typeof s.minVertragMonate === 'number' &&
    Number.isFinite(s.minVertragMonate)
  )
}

export function slugify(input: string): string {
  const folded = input
    .trim()
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
  const slug = folded
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
  return slug || 'eintrag'
}

export function uniqueId(base: string, taken: Set<string>): string {
  let id = base
  let n = 2
  while (taken.has(id)) {
    const suffix = `-${n}`
    id = `${base.slice(0, Math.max(1, 64 - suffix.length))}${suffix}`
    n += 1
  }
  return id
}

/** „350“, „350,-“, „350,5“, „152,32-169,86“ → „350,00“ bzw. „152,32–169,86“. */
export function normalizePrice(raw: string): string | null {
  const compact = raw
    .trim()
    .replace(/\s+/g, '')
    .replace(/\u2013/g, '-')
    .replace(/\u2014/g, '-')
  if (!compact) return null
  const parts = compact.split('-')
  if (parts.length < 1 || parts.length > 2) return null
  const norm = parts.map(normalizePricePart)
  if (norm.some((p) => p === null)) return null
  return norm.join('–')
}

function normalizePricePart(part: string): string | null {
  const cleaned = part.replace(/,-$/, '').replace(/\.$/, '')
  const m = /^(\d{1,5})(?:[.,](\d{1,2}))?$/.exec(cleaned)
  if (!m) return null
  const decimals = (m[2] ?? '00').padEnd(2, '0')
  return `${m[1]},${decimals}`
}

export function composeTarifLabel(title: string, price: string): string {
  const norm = normalizePrice(price)
  if (!norm) throw new Error('Ungültiger Preis')
  return `${title.trim()} — ${norm} € / Monat`
}

export function splitTarifLabel(label: string): { title: string; price: string } {
  const m =
    /^(.*?)\s—\s*(\d{1,5}(?:,\d{2})?(?:\s*[–-]\s*\d{1,5}(?:,\d{2})?)?)\s*€/u.exec(
      label.trim(),
    )
  if (!m?.[1] || !m[2]) return { title: label.trim(), price: '' }
  return { title: m[1].trim(), price: m[2].replace(/\s/g, '') }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function isEmail(value: string): boolean {
  return EMAIL_RE.test(value)
}

export function parseEmailList(raw: string): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const part of raw.split(/[\s,;]+/)) {
    const email = part.trim().toLowerCase()
    if (!email || seen.has(email)) continue
    seen.add(email)
    out.push(email)
  }
  return out
}

export function isSafeUrl(url: string): boolean {
  if (url.startsWith('/') && !url.startsWith('//')) return true
  try {
    const u = new URL(url)
    return u.protocol === 'https:' || u.protocol === 'http:'
  } catch {
    return false
  }
}

export function tarifLine(catalog: PublicCatalog, tarifId: string): string {
  for (const g of catalog.garagen) {
    const t = g.tarife.find((x) => x.id === tarifId)
    if (!t) continue
    return t.detail ? `${t.label} — ${t.detail}` : t.label
  }
  return tarifId
}

export function validateAdminSettings(input: AdminSettings): string | null {
  const notify = parseEmailList(input.notifyTo)
  if (notify.length === 0 || notify.some((e) => !isEmail(e))) {
    return 'Mindestens eine gültige Empfänger-Adresse für die Büromail.'
  }
  if (!isEmail(input.publicEmail.trim().toLowerCase())) {
    return 'Öffentliche E-Mail ist ungültig.'
  }
  if (!Number.isFinite(input.kationEur) || input.kationEur < 0 || input.kationEur > 10000) {
    return 'Kaution zwischen 0 und 10.000 €.'
  }
  if (
    !Number.isInteger(input.minVertragMonate) ||
    input.minVertragMonate < 1 ||
    input.minVertragMonate > 36
  ) {
    return 'Mindestlaufzeit zwischen 1 und 36 Monaten.'
  }
  const hint = input.kuendigungHinweis.trim()
  if (hint.length < 8 || hint.length > 400) {
    return 'Kündigungshinweis: 8 bis 400 Zeichen.'
  }
  if (!isSafeUrl(input.agbPdfUrl.trim())) {
    return 'AGB-Link muss mit / oder http(s):// beginnen.'
  }
  return null
}
