/** IBAN-Längen europäischer Länder, einschließlich GB (ISO 13616). */
const EUROPE_IBAN_LENGTH: Record<string, number> = {
  AD: 24,
  AL: 28,
  AT: 20,
  AZ: 28,
  BA: 20,
  BE: 16,
  BG: 22,
  BY: 28,
  CH: 21,
  CY: 28,
  CZ: 24,
  DE: 22,
  DK: 18,
  EE: 20,
  ES: 24,
  FI: 18,
  FO: 18,
  FR: 27,
  GB: 22,
  GE: 22,
  GI: 23,
  GL: 18,
  GR: 27,
  HR: 21,
  HU: 28,
  IE: 22,
  IS: 26,
  IT: 27,
  LI: 21,
  LT: 20,
  LU: 20,
  LV: 21,
  MC: 27,
  MD: 24,
  ME: 22,
  MK: 19,
  MT: 31,
  NL: 18,
  NO: 15,
  PL: 28,
  PT: 25,
  RO: 24,
  RS: 22,
  SE: 24,
  SI: 19,
  SK: 24,
  SM: 27,
  TR: 26,
  UA: 29,
  VA: 22,
  XK: 20,
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

/** Gültige IBAN eines europäischen Landes (Format + Länge + Prüfziffer). */
export function isValidEuropeanIban(raw: string): boolean {
  const iban = normalizeIban(raw)
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]+$/.test(iban)) return false

  const country = iban.slice(0, 2)
  const expectedLen = EUROPE_IBAN_LENGTH[country]
  if (expectedLen === undefined || iban.length !== expectedLen) return false

  return ibanChecksumValid(iban)
}
