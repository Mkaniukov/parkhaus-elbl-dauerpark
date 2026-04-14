import type { ApplicationFormInput } from './schema'
import { GARAGEN, KAUTION_EUR } from './constants'

export type ContractPreview = {
  name_firma: string
  adresse: string
  telefon: string
  email: string
  beginnDE: string
  fahrzeug: string
  kennzeichen: string
  vertragsAdresse: string
  /** z. B. „Mo–So, 00–24 Uhr“ aus dem Tarif-Label */
  nutzungszeiten: string
  tarifLabel: string
  tarifDetail: string
  gesamtentgeltAnzeige: string
  kautionEuro: number
}

/** ISO-Datum (yyyy-mm-dd) → TT.MM.JJJJ */
export function formatDateDE(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim())
  if (!m) return iso
  return `${m[3]}.${m[2]}.${m[1]}`
}

/** Text nach dem Gedankenstrich im Tarif-Label (Preis / Monat). */
export function extractPreisAusTarifLabel(label: string): string {
  const idx = label.indexOf('—')
  if (idx < 0) return label.trim()
  return label
    .slice(idx + 1)
    .trim()
    .replace(/\s*\/\s*Monat\s*$/i, '')
    .trim()
}

/** Erster Teil des Tarif-Labels vor „—“ (Nutzungszeiten / Produkt). */
export function extractNutzungszeitenAusLabel(label: string): string {
  const idx = label.indexOf('—')
  if (idx < 0) return label.trim()
  return label.slice(0, idx).trim()
}

export function buildContractPreview(
  data: ApplicationFormInput,
): ContractPreview | null {
  const garage = GARAGEN.find((g) => g.id === data.garage)
  const tarif = garage?.tarife.find((t) => t.id === data.tarif)
  if (!garage || !tarif) return null

  return {
    name_firma: data.name_firma.trim(),
    adresse: data.adresse.trim(),
    telefon: data.telefon.trim(),
    email: data.email.trim(),
    beginnDE: formatDateDE(data.beginn),
    fahrzeug: data.fahrzeug.trim(),
    kennzeichen: data.kennzeichen.trim(),
    vertragsAdresse: garage.vertragsAdresse,
    nutzungszeiten: extractNutzungszeitenAusLabel(tarif.label),
    tarifLabel: tarif.label,
    tarifDetail: tarif.detail,
    gesamtentgeltAnzeige: extractPreisAusTarifLabel(tarif.label),
    kautionEuro: KAUTION_EUR,
  }
}
