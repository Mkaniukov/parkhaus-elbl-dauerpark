/** IBAN-Längen EU-Mitgliedstaaten (ISO 13616). */
const EU_IBAN_LENGTH: Record<string, number> = {
  AT: 20,
  BE: 16,
  BG: 22,
  HR: 21,
  CY: 28,
  CZ: 24,
  DK: 18,
  EE: 20,
  FI: 18,
  FR: 27,
  DE: 22,
  GR: 27,
  HU: 28,
  IE: 22,
  IT: 27,
  LV: 21,
  LT: 20,
  LU: 20,
  MT: 31,
  NL: 18,
  PL: 28,
  PT: 25,
  RO: 24,
  SK: 24,
  SI: 19,
  ES: 24,
  SE: 24,
}

export function normalizeIban(raw: string): string {
  return raw.replace(/\s+/g, '').toUpperCase()
}

/** MOD-97-Prüfziffer (ISO 13616). */
function ibanChecksumValid(iban: string): boolean {
  const rearranged = iban.slice(4) + iban.slice(0, 4)
  let remainder = 0
  for (let i = 0; i < rearranged.length; i++) {
    const ch = rearranged[i]!
    const chunk =
      ch >= 'A' && ch <= 'Z'
        ? (ch.charCodeAt(0) - 55).toString()
        : ch
    for (let j = 0; j < chunk.length; j++) {
      remainder =
        (remainder * 10 + Number.parseInt(chunk[j]!, 10)) % 97
    }
  }
  return remainder === 1
}

/** Gültige IBAN eines EU-Mitgliedstaats (Format + Länge + Prüfziffer). */
export function isValidEuIban(raw: string): boolean {
  const iban = normalizeIban(raw)
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]+$/.test(iban)) return false

  const country = iban.slice(0, 2)
  const expectedLen = EU_IBAN_LENGTH[country]
  if (expectedLen === undefined || iban.length !== expectedLen) return false

  return ibanChecksumValid(iban)
}
