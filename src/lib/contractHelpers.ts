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
