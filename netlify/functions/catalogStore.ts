import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import {
  composeTarifLabel,
  fallbackCatalog,
  normalizePrice,
  parseEmailList,
  slugify,
  toPublicCatalog,
  uniqueId,
  validateAdminSettings,
  type AdminSettings,
  type CatalogGarage,
  type CatalogTarif,
  type FullCatalog,
  type PublicCatalog,
} from '../../src/lib/catalogModel'

export type CatalogSource = 'file' | 'supabase' | 'fallback'

export type LoadedCatalog = {
  catalog: FullCatalog
  publicCatalog: PublicCatalog
  source: CatalogSource
  writable: boolean
  notice: string
}

type GarageRow = {
  id: string
  label: string
  vertrags_adresse: string
  sort_order: number
  active: boolean
}

type TarifRow = {
  id: string
  garage_id: string
  label: string
  detail: string
  sort_order: number
  active: boolean
}

const FILE_PATH = path.join(process.cwd(), 'data', 'catalog.json')

function hasSupabase(): boolean {
  return Boolean(
    process.env.SUPABASE_URL &&
      (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY),
  )
}

function storeKind(): CatalogSource | 'unconfigured' {
  if (process.env.CATALOG_STORE === 'file') return 'file'
  if (hasSupabase()) return 'supabase'
  const hosted = Boolean(
    process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.NETLIFY,
  )
  if (hosted) return 'unconfigured'
  return 'file'
}

function noticeFor(source: CatalogSource, writable: boolean): string {
  if (source === 'supabase') {
    return 'Gespeichert in Supabase. Das Anmeldeformular übernimmt Änderungen sofort.'
  }
  if (source === 'file') {
    return 'Lokal in data/catalog.json. Auf Netlify gilt die Supabase-Datenbank, sobald die Migration gelaufen ist.'
  }
  if (!writable) {
    return 'Supabase ist nicht verbunden oder die Tabellen fehlen. Angezeigt werden die Tarife aus dem Programmcode. Zum Speichern SUPABASE_URL, den Service-Role-Key und die Migration 20261116160000_admin_catalog setzen.'
  }
  return ''
}

function supabase(): SupabaseClient {
  const url = process.env.SUPABASE_URL
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY
  if (!url || !key) throw new Error('Supabase ist nicht konfiguriert.')
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

function missingTable(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  const msg = error.message ?? ''
  return (
    error.code === '42P01' ||
    error.code === 'PGRST205' ||
    /does not exist|schema cache|could not find the table/i.test(msg)
  )
}

function rowsToCatalog(
  garagen: GarageRow[],
  tarife: TarifRow[],
  settings: AdminSettings,
): FullCatalog {
  const byGarage = new Map<string, CatalogTarif[]>()
  for (const t of tarife) {
    const list = byGarage.get(t.garage_id) ?? []
    list.push({
      id: t.id,
      label: t.label,
      detail: t.detail,
      active: t.active,
      sortOrder: t.sort_order,
    })
    byGarage.set(t.garage_id, list)
  }
  return {
    garagen: garagen
      .map((g) => ({
        id: g.id,
        label: g.label,
        vertragsAdresse: g.vertrags_adresse,
        active: g.active,
        sortOrder: g.sort_order,
        tarife: (byGarage.get(g.id) ?? []).sort((a, b) => a.sortOrder - b.sortOrder),
      }))
      .sort((a, b) => a.sortOrder - b.sortOrder),
    settings,
  }
}

function settingsFromMap(map: Map<string, string>, base: AdminSettings): AdminSettings {
  const kation = Number((map.get('kation_eur') ?? String(base.kationEur)).replace(',', '.'))
  const months = Number(map.get('min_vertrag_monate') ?? String(base.minVertragMonate))
  return {
    notifyTo: map.get('notify_to') ?? base.notifyTo,
    publicEmail: map.get('public_email') ?? base.publicEmail,
    kationEur: Number.isFinite(kation) ? kation : base.kationEur,
    minVertragMonate: Number.isFinite(months) ? months : base.minVertragMonate,
    kuendigungHinweis: map.get('kuendigung_hinweis') ?? base.kuendigungHinweis,
    agbPdfUrl: map.get('agb_pdf_url') ?? base.agbPdfUrl,
  }
}

function settingsToRows(settings: AdminSettings): { key: string; value: string }[] {
  return [
    { key: 'notify_to', value: parseEmailList(settings.notifyTo).join('\n') },
    { key: 'public_email', value: settings.publicEmail.trim().toLowerCase() },
    { key: 'kation_eur', value: String(settings.kationEur) },
    { key: 'min_vertrag_monate', value: String(settings.minVertragMonate) },
    { key: 'kuendigung_hinweis', value: settings.kuendigungHinweis.trim() },
    { key: 'agb_pdf_url', value: settings.agbPdfUrl.trim() },
  ]
}

function normalizeCatalog(raw: FullCatalog): FullCatalog {
  const base = fallbackCatalog().settings
  return {
    settings: { ...base, ...raw.settings },
    garagen: raw.garagen.map((g, i) => ({
      id: g.id,
      label: g.label,
      vertragsAdresse: g.vertragsAdresse,
      active: g.active !== false,
      sortOrder: typeof g.sortOrder === 'number' ? g.sortOrder : i,
      tarife: (g.tarife ?? []).map((t, j) => ({
        id: t.id,
        label: t.label,
        detail: t.detail ?? '',
        active: t.active !== false,
        sortOrder: typeof t.sortOrder === 'number' ? t.sortOrder : j,
      })),
    })),
  }
}

async function readFileCatalog(): Promise<FullCatalog> {
  let raw: string
  try {
    raw = await readFile(FILE_PATH, 'utf8')
  } catch (e) {
    const err = e as NodeJS.ErrnoException
    if (err.code !== 'ENOENT') throw e
    const seed = fallbackCatalog()
    try {
      await writeFileCatalog(seed)
      return seed
    } catch {
      raw = await readFile(FILE_PATH, 'utf8')
    }
  }
  try {
    const parsed = JSON.parse(raw) as FullCatalog
    if (!Array.isArray(parsed.garagen) || !parsed.settings) {
      throw new Error('unvollständig')
    }
    return normalizeCatalog(parsed)
  } catch {
    throw new Error('data/catalog.json ist beschädigt.')
  }
}

async function writeFileCatalog(catalog: FullCatalog): Promise<void> {
  await mkdir(path.dirname(FILE_PATH), { recursive: true })
  const tmp = `${FILE_PATH}.${process.pid}.${Date.now()}-${Math.random().toString(16).slice(2)}.tmp`
  await writeFile(tmp, JSON.stringify(catalog, null, 2))
  try {
    await rename(tmp, FILE_PATH)
  } catch (e) {
    await rm(tmp, { force: true })
    throw e
  }
}

async function seedSupabase(client: SupabaseClient, seed: FullCatalog): Promise<void> {
  const now = new Date().toISOString()
  const garagen = seed.garagen.map((g) => ({
    id: g.id,
    label: g.label,
    vertrags_adresse: g.vertragsAdresse,
    sort_order: g.sortOrder,
    active: g.active,
    updated_at: now,
  }))
  const tarife = seed.garagen.flatMap((g) =>
    g.tarife.map((t) => ({
      id: t.id,
      garage_id: g.id,
      label: t.label,
      detail: t.detail,
      sort_order: t.sortOrder,
      active: t.active,
      updated_at: now,
    })),
  )
  const gRes = await client.from('garagen').upsert(garagen, { onConflict: 'id' })
  if (gRes.error) throw new Error(gRes.error.message)
  const tRes = await client.from('tarife').upsert(tarife, { onConflict: 'id' })
  if (tRes.error) throw new Error(tRes.error.message)
  const sRes = await client.from('app_settings').upsert(
    settingsToRows(seed.settings).map((row) => ({ ...row, updated_at: now })),
    { onConflict: 'key' },
  )
  if (sRes.error) throw new Error(sRes.error.message)
}

async function readSupabase(seedIfEmpty = true): Promise<FullCatalog | 'missing'> {
  const client = supabase()
  const gRes = await client.from('garagen').select('*').order('sort_order')
  if (gRes.error) {
    if (missingTable(gRes.error)) return 'missing'
    throw new Error(gRes.error.message)
  }
  const tRes = await client.from('tarife').select('*').order('sort_order')
  if (tRes.error) {
    if (missingTable(tRes.error)) return 'missing'
    throw new Error(tRes.error.message)
  }
  const sRes = await client.from('app_settings').select('key, value')
  if (sRes.error) {
    if (missingTable(sRes.error)) return 'missing'
    throw new Error(sRes.error.message)
  }
  const garagen = (gRes.data ?? []) as GarageRow[]
  const tarife = (tRes.data ?? []) as TarifRow[]
  if (garagen.length === 0) {
    if (!seedIfEmpty) throw new Error('Katalog ist leer und konnte nicht befüllt werden.')
    await seedSupabase(client, fallbackCatalog())
    return readSupabase(false)
  }
  const map = new Map<string, string>()
  for (const row of (sRes.data ?? []) as { key: string; value: string }[]) {
    map.set(row.key, row.value)
  }
  const settings = settingsFromMap(map, fallbackCatalog().settings)
  if (map.size === 0) {
    const now = new Date().toISOString()
    await client.from('app_settings').upsert(
      settingsToRows(settings).map((row) => ({ ...row, updated_at: now })),
      { onConflict: 'key' },
    )
  }
  return rowsToCatalog(garagen, tarife, settings)
}

export async function loadCatalog(): Promise<LoadedCatalog> {
  const kind = storeKind()
  if (kind === 'unconfigured') {
    const catalog = fallbackCatalog()
    return {
      catalog,
      publicCatalog: toPublicCatalog(catalog),
      source: 'fallback',
      writable: false,
      notice: noticeFor('fallback', false),
    }
  }
  try {
    if (kind === 'file') {
      const catalog = await readFileCatalog()
      return {
        catalog,
        publicCatalog: toPublicCatalog(catalog),
        source: 'file',
        writable: true,
        notice: noticeFor('file', true),
      }
    }
    const remote = await readSupabase()
    if (remote === 'missing') {
      const catalog = fallbackCatalog()
      return {
        catalog,
        publicCatalog: toPublicCatalog(catalog),
        source: 'fallback',
        writable: false,
        notice: noticeFor('fallback', false),
      }
    }
    return {
      catalog: remote,
      publicCatalog: toPublicCatalog(remote),
      source: 'supabase',
      writable: true,
      notice: noticeFor('supabase', true),
    }
  } catch (e) {
    console.error('catalog load', e)
    const catalog = fallbackCatalog()
    return {
      catalog,
      publicCatalog: toPublicCatalog(catalog),
      source: 'fallback',
      writable: false,
      notice:
        e instanceof Error
          ? `Katalog nicht ladbar (${e.message}). Das Formular nutzt die eingebauten Tarife.`
          : noticeFor('fallback', false),
    }
  }
}

async function persist(catalog: FullCatalog): Promise<void> {
  const kind = storeKind()
  if (kind === 'file') {
    await writeFileCatalog(catalog)
    return
  }
  if (kind !== 'supabase') {
    throw new Error(
      'Speichern nicht möglich: Supabase-URL, Service-Role-Key oder die Migration fehlen.',
    )
  }
  const client = supabase()
  const now = new Date().toISOString()
  const garageRows = catalog.garagen.map((g) => ({
    id: g.id,
    label: g.label,
    vertrags_adresse: g.vertragsAdresse,
    sort_order: g.sortOrder,
    active: g.active,
    updated_at: now,
  }))
  const tarifRows = catalog.garagen.flatMap((g) =>
    g.tarife.map((t) => ({
      id: t.id,
      garage_id: g.id,
      label: t.label,
      detail: t.detail,
      sort_order: t.sortOrder,
      active: t.active,
      updated_at: now,
    })),
  )
  if (garageRows.length > 0) {
    const gUp = await client.from('garagen').upsert(garageRows, { onConflict: 'id' })
    if (gUp.error) throw new Error(gUp.error.message)
  }
  if (tarifRows.length > 0) {
    const tUp = await client.from('tarife').upsert(tarifRows, { onConflict: 'id' })
    if (tUp.error) throw new Error(tUp.error.message)
  }
  await deleteMissing(client, 'tarife', tarifRows.map((t) => t.id))
  await deleteMissing(client, 'garagen', garageRows.map((g) => g.id))
  const sUp = await client.from('app_settings').upsert(
    settingsToRows(catalog.settings).map((row) => ({ ...row, updated_at: now })),
    { onConflict: 'key' },
  )
  if (sUp.error) throw new Error(sUp.error.message)
}

async function deleteMissing(
  client: SupabaseClient,
  table: 'garagen' | 'tarife',
  keep: string[],
): Promise<void> {
  const existing = await client.from(table).select('id')
  if (existing.error) throw new Error(existing.error.message)
  const keepSet = new Set(keep)
  const drop = ((existing.data ?? []) as { id: string }[])
    .map((row) => row.id)
    .filter((id) => !keepSet.has(id))
  if (drop.length === 0) return
  const res = await client.from(table).delete().in('id', drop)
  if (res.error) throw new Error(res.error.message)
}

export type TarifInput = {
  id?: string
  title: string
  price: string
  detail?: string
  active?: boolean
}

export type GarageInput = {
  id?: string
  label: string
  vertragsAdresse: string
  active?: boolean
  tarife: TarifInput[]
}

function cleanTarife(
  garageId: string,
  inputs: TarifInput[],
  own: Set<string>,
  others: Set<string>,
): CatalogTarif[] {
  const assigned = new Set(others)
  const rows: CatalogTarif[] = []
  inputs.forEach((input, index) => {
    const title = input.title?.trim() ?? ''
    const price = input.price?.trim() ?? ''
    const detail = (input.detail ?? '').trim()
    if (!title && !price && !detail) return
    if (title.length < 2 || title.length > 140) {
      throw new Error('Tarifbezeichnung: 2 bis 140 Zeichen.')
    }
    if (!normalizePrice(price)) {
      throw new Error(`Preis für „${title}“ fehlt oder ist ungültig. Beispiel: 350,00`)
    }
    if (detail.length > 180) throw new Error('Tarif-Zusatz ist zu lang.')
    const requested = input.id?.trim()
    const id =
      requested && own.has(requested) && !assigned.has(requested)
        ? requested
        : uniqueId(`${garageId}__${slugify(title)}`, assigned)
    assigned.add(id)
    rows.push({
      id,
      label: composeTarifLabel(title, price),
      detail,
      active: input.active !== false,
      sortOrder: index,
    })
  })
  if (rows.length === 0) throw new Error('Mindestens ein Tarif pro Garage.')
  return rows
}

export async function saveGarage(input: GarageInput): Promise<LoadedCatalog> {
  const loaded = await requireWritable()
  const label = input.label?.trim() ?? ''
  const vertragsAdresse = input.vertragsAdresse?.trim() ?? ''
  if (label.length < 2 || label.length > 140) {
    throw new Error('Garagenname: 2 bis 140 Zeichen.')
  }
  if (vertragsAdresse.length < 2 || vertragsAdresse.length > 180) {
    throw new Error('Vertragsadresse: 2 bis 180 Zeichen.')
  }
  const catalog = loaded.catalog
  let id = input.id?.trim()
  const existing = id ? catalog.garagen.find((g) => g.id === id) : undefined
  if (id && !existing) throw new Error('Garage nicht gefunden.')
  if (!id) {
    id = uniqueId(
      slugify(label),
      new Set(catalog.garagen.map((g) => g.id)),
    )
  }
  const own = new Set(existing?.tarife.map((t) => t.id) ?? [])
  const others = new Set(
    catalog.garagen
      .filter((g) => g.id !== id)
      .flatMap((g) => g.tarife.map((t) => t.id)),
  )
  const tarife = cleanTarife(id, input.tarife ?? [], own, others)
  const nextGarage: CatalogGarage = {
    id,
    label,
    vertragsAdresse,
    active: input.active !== false,
    sortOrder: existing?.sortOrder ?? catalog.garagen.length,
    tarife,
  }
  const garagen = existing
    ? catalog.garagen.map((g) => (g.id === id ? nextGarage : g))
    : [...catalog.garagen, nextGarage]
  await persist({ ...catalog, garagen })
  return loadCatalog()
}

export async function deleteGarage(id: string): Promise<LoadedCatalog> {
  const loaded = await requireWritable()
  const garagen = loaded.catalog.garagen.filter((g) => g.id !== id)
  if (garagen.length === loaded.catalog.garagen.length) {
    throw new Error('Garage nicht gefunden.')
  }
  await persist({ ...loaded.catalog, garagen })
  return loadCatalog()
}

export async function reorderGarages(ids: string[]): Promise<LoadedCatalog> {
  const loaded = await requireWritable()
  const byId = new Map(loaded.catalog.garagen.map((g) => [g.id, g]))
  if (ids.length !== byId.size || ids.some((id) => !byId.has(id))) {
    throw new Error('Reihenfolge enthält nicht alle Garagen.')
  }
  const garagen = ids.map((id, index) => {
    const g = byId.get(id)!
    return { ...g, sortOrder: index }
  })
  await persist({ ...loaded.catalog, garagen })
  return loadCatalog()
}

export async function saveSettings(settings: AdminSettings): Promise<LoadedCatalog> {
  const loaded = await requireWritable()
  const normalized: AdminSettings = {
    ...settings,
    notifyTo: settings.notifyTo ?? '',
    publicEmail: settings.publicEmail ?? '',
    kationEur: Number(settings.kationEur),
    minVertragMonate: Number(settings.minVertragMonate),
    kuendigungHinweis: settings.kuendigungHinweis ?? '',
    agbPdfUrl: settings.agbPdfUrl ?? '',
  }
  const problem = validateAdminSettings(normalized)
  if (problem) throw new Error(problem)
  normalized.notifyTo = parseEmailList(normalized.notifyTo).join('\n')
  normalized.publicEmail = normalized.publicEmail.trim().toLowerCase()
  normalized.kuendigungHinweis = normalized.kuendigungHinweis.trim()
  normalized.agbPdfUrl = normalized.agbPdfUrl.trim()
  await persist({ ...loaded.catalog, settings: normalized })
  return loadCatalog()
}

async function requireWritable(): Promise<LoadedCatalog> {
  const loaded = await loadCatalog()
  if (!loaded.writable) throw new Error(loaded.notice)
  return loaded
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

export async function listAntraege(): Promise<{
  antraege: AntragListItem[]
  note?: string
}> {
  if (storeKind() !== 'supabase') {
    return {
      antraege: [],
      note: 'Anträge liegen in Supabase. In der lokalen Datei sind sie nicht enthalten.',
    }
  }
  const client = supabase()
  const res = await client
    .from('dauerpark_antraege')
    .select(
      'id, created_at, name_firma, email, telefon, garage, tarif, kennzeichen, beginn, fahrzeug',
    )
    .order('created_at', { ascending: false })
    .limit(40)
  if (res.error) throw new Error(res.error.message)
  return { antraege: (res.data ?? []) as AntragListItem[] }
}
