import { z } from 'zod'
import { getCatalog } from './catalogSnapshot'
import { isValidEuropeanIban, normalizeIban } from './iban'

/** IBAN eines europäischen Landes, einschließlich GB (Länge je Land + MOD-97). */
const ibanEu = z
  .string()
  .min(1, 'IBAN erforderlich')
  .transform(normalizeIban)
  .refine(isValidEuropeanIban, 'Ungültige IBAN')

export const applicationPayloadSchema = z
  .object({
    name_firma: z.string().min(2, 'Name oder Firma angeben'),
    adresse: z.string().min(4, 'Straße und Hausnummer'),
    plz_ort: z.string().trim().min(4, 'PLZ und Ort'),
    telefon: z.string().min(5, 'Telefonnummer'),
    email: z.string().email('Gültige E-Mail'),
    beginn: z.string().min(1, 'Beginn wählen'),
    fahrzeug: z.string().trim(),
    kennzeichen: z.string().trim(),
    iban: ibanEu,
    bic: z
      .string()
      .optional()
      .transform((s) => {
        const t = s?.trim()
        return t ? t.toUpperCase() : undefined
      }),
    lautend_auf: z.string().min(2, 'Kontoinhaber / lautend auf'),
    stellplatz_nutzer: z.string().max(180).default(''),
    tarif: z.string().min(1, 'Tarif wählen'),
    garage: z.string().min(1, 'Garage wählen'),
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
  .superRefine((data, ctx) => {
    const garage = getCatalog().garagen.find((g) => g.id === data.garage)
    if (!garage) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Garage wählen.',
        path: ['garage'],
      })
      return
    }
    const allowed = new Set(garage.tarife.map((t) => t.id))
    if (!allowed.has(data.tarif)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Tarif passt nicht zur gewählten Garage.',
        path: ['tarif'],
      })
    }
  })

export type ApplicationPayload = z.infer<typeof applicationPayloadSchema>
/** Rohdaten aus dem Formular (vor IBAN-/BIC-Normalisierung). */
export type ApplicationFormInput = z.input<typeof applicationPayloadSchema>
