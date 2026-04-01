/** Tarife laut Parkhaus ELBL Dauerpark (Preise inkl. 20 % UST). */
export const TARIFE = [
  {
    id: 'mw-fr-350',
    label:
      'Mo–Fr, 00–24 Uhr — 350,00 € / Monat',
    detail: 'Werktags durchgehend',
  },
  {
    id: 'mo-so-430-var',
    label:
      'Mo–So, 00–24 Uhr — 430,00 € / Monat',
    detail: 'variabler Stellplatz',
  },
  {
    id: 'mo-so-615-prime',
    label:
      'Mo–So, 00–24 Uhr — 615,00 € / Monat',
    detail: 'Fixstellplatz Prime Parking (1. Etage)',
  },
  {
    id: 'mo-so-575-fix',
    label:
      'Mo–So, 00–24 Uhr — 575,00 € / Monat',
    detail: 'Fixstellplatz untere Ebenen',
  },
  {
    id: 'bike-21',
    label:
      'Fahrrad, e-Scooter / e-Bike — 21,00 € / Monat',
    detail: '00–24 Uhr',
  },
] as const

export type TarifId = (typeof TARIFE)[number]['id']

/** Standorte aus dem Anmeldeformular (eine Garage auswählen). */
export const GARAGEN = [
  { id: '1010-posthoefe', label: '1010 Wien — Garage Posthöfe' },
  { id: '1030-intercont', label: '1030 Wien — Garage Hotel InterCont' },
  { id: '1060-mollardgasse', label: '1060 Wien — Garage Mollardgasse' },
  { id: '1070-zieglergasse', label: '1070 Wien — Zieglergasse' },
  { id: '1070-neubaugasse', label: '1070 Wien — Garage Neubaugasse' },
  { id: '1190-skyline', label: '1190 Wien — P&R Garage Skyline' },
  { id: '1210-am-spitz', label: '1210 Wien — Garage Am Spitz' },
  { id: '1220-reichsbruecke', label: '1220 Wien — Garage Reichsbrücke' },
  { id: '8020-graz-leiner', label: '8020 Graz — Garage Leiner' },
] as const

export type GarageId = (typeof GARAGEN)[number]['id']

export const KAUTION_EUR = 400
export const MIN_VERTRAG_MONATE = 3
export const KUENDIGUNG_HINWEIS =
  'Mindestvertragsdauer 3 Monate, Kündigungsfrist ein Monat zum Monatsletzten.'
