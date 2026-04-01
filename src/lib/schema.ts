import { z } from 'zod'
import { GARAGEN, TARIFE } from './constants'

const tarifIds = TARIFE.map((t) => t.id) as [string, ...string[]]
const garageIds = GARAGEN.map((g) => g.id) as [string, ...string[]]

function normalizeIban(raw: string): string {
  return raw.replace(/\s+/g, '').toUpperCase()
}

/** AT-IBAN: 20 Zeichen gesamt (AT + 18 Ziffern). */
const ibanAt = z
  .string()
  .min(1, 'IBAN erforderlich')
  .transform(normalizeIban)
  .refine((v) => /^AT\d{18}$/.test(v), 'Ungültige österreichische IBAN')

export const applicationPayloadSchema = z.object({
  name_firma: z.string().min(2, 'Name oder Firma angeben'),
  adresse: z.string().min(4, 'Vollständige Adresse'),
  telefon: z.string().min(5, 'Telefonnummer'),
  email: z.string().email('Gültige E-Mail'),
  beginn: z.string().min(1, 'Beginn wählen'),
  fahrzeug: z.string().min(2, 'Fahrzeug (Marke / Typ)'),
  kennzeichen: z.string().min(2, 'Kennzeichen'),
  iban: ibanAt,
  bic: z
    .string()
    .optional()
    .transform((s) => {
      const t = s?.trim()
      return t ? t.toUpperCase() : undefined
    }),
  lautend_auf: z.string().min(2, 'Kontoinhaber / lautend auf'),
  tarif: z.enum(tarifIds),
  garage: z.enum(garageIds),
  agb_akzeptiert: z
    .boolean()
    .refine((v) => v === true, 'AGB müssen akzeptiert werden'),
  sepa_akzeptiert: z
    .boolean()
    .refine((v) => v === true, 'SEPA-Lastschrift muss akzeptiert werden'),
  datenschutz_akzeptiert: z
    .boolean()
    .refine((v) => v === true, 'Datenschutzerklärung muss akzeptiert werden'),
})

export type ApplicationPayload = z.infer<typeof applicationPayloadSchema>
/** Rohdaten aus dem Formular (vor IBAN-/BIC-Normalisierung). */
export type ApplicationFormInput = z.input<typeof applicationPayloadSchema>
