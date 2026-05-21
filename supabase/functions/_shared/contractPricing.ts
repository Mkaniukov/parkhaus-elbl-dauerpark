/** Hilfen für Platzhalter Kaution / Hauptmietzins im Google-Vertrag */

import { TARIF_ID_TO_LABEL } from "./tarifLabels.ts"

export function tariffLabelOrEmpty(tarifId: string): string {
  return TARIF_ID_TO_LABEL[tarifId.trim()] ?? ""
}

/**
 * Aus einem Tarif-Label den Betrag vor „€“, z. B.:
 * „… — 350,00 € / Monat“ → „350,00 €“,
 * „… — 152,32–169,86 € / Monat“ → „152,32–169,86 €“
 */
export function extractHauptmietzinsFromLabel(label: string): string | null {
  const t = label.trim()
  if (!t) return null
  const em = /\s—\s*((?:\d{1,5}(?:,\d{2})?)(?:\s*[–-]\s*\d{1,5}(?:,\d{2})?)?)\s*€/u.exec(
    t,
  )
  if (em?.[1]) return `${em[1]} €`
  const loose =
    /(\d{1,5}(?:,\d{2})?(?:\s*[–-]\s*\d{1,5}(?:,\d{2})?)?)\s*€/u.exec(t)
  return loose?.[1] ? `${loose[1]} €` : null
}

export function resolveHauptmietzinsEUR(tarifId: string): string {
  const label = tariffLabelOrEmpty(tarifId)
  if (!label) return "—"
  return extractHauptmietzinsFromLabel(label) ?? "—"
}

/** Default 400 wie KAUTION_EUR im Frontend; per Secret CONTRACT_KAUTION_EUR überschreibbar */
export function resolveKautionEURDisplay(): string {
  const raw = Deno.env.get("CONTRACT_KAUTION_EUR")?.trim()
  let euro = 400
  if (raw) {
    const n = Number(raw.replace(",", "."))
    if (Number.isFinite(n) && n >= 0) euro = n
    else console.warn("CONTRACT_KAUTION_EUR ungültig, nutze Fallback 400:", raw)
  }
  return formatEURdeAT(euro)
}

export function formatEURdeAT(value: number): string {
  return `${
    new Intl.NumberFormat("de-AT", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value)
  } €`
}
