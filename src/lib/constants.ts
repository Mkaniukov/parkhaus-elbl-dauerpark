/** Einzelner Tarif (pro Garage; IDs sind projektweit eindeutig). */
export type TarifDef = {
  id: string
  label: string
  detail: string
}

export type GarageEntry = {
  id: string
  label: string
  tarife: readonly TarifDef[]
}

/**
 * Tarife laut Dauer_Tarife.pdf (Preise inkl. 20 % UST), ergänzt um bisherige
 * ELBL-Optionen für Standorte ohne eigene PDF-Tabelle.
 */
export const GARAGEN: readonly GarageEntry[] = [
  {
    id: '1010-posthoefe',
    label: '1010 Wien — Garage Posthöfe',
    tarife: [
      {
        id: '1010-posthoefe__mw-fr-350',
        label: 'Mo–Fr, 00–24 Uhr — 350,00 € / Monat',
        detail: 'Werktags durchgehend',
      },
      {
        id: '1010-posthoefe__mo-so-430-var',
        label: 'Mo–So, 00–24 Uhr — 430,00 € / Monat',
        detail: 'variabler Stellplatz',
      },
      {
        id: '1010-posthoefe__mo-so-615-prime',
        label: 'Mo–So, 00–24 Uhr — 615,00 € / Monat',
        detail: 'Fixstellplatz Prime Parking (1. Etage)',
      },
      {
        id: '1010-posthoefe__mo-so-575-fix',
        label: 'Mo–So, 00–24 Uhr — 575,00 € / Monat',
        detail: 'Fixstellplatz untere Ebenen',
      },
      {
        id: '1010-posthoefe__bike-21',
        label: 'Fahrrad, e-Scooter / e-Bike — 21,00 € / Monat',
        detail: '00–24 Uhr',
      },
    ],
  },
  {
    id: '1030-intercont',
    label: '1030 Wien — Garage Hotel InterContinental',
    tarife: [
      {
        id: '1030-intercont__mo-so-24h-fix',
        label: 'Mo–So, 00–24 Uhr — 322,00 € / Monat',
        detail: 'Fixstellplatz',
      },
      {
        id: '1030-intercont__mo-so-24h-var',
        label: 'Mo–So, 00–24 Uhr — 275,00 € / Monat',
        detail: 'variabler Stellplatz',
      },
      {
        id: '1030-intercont__mo-fr-6-20-var',
        label: 'Mo–Fr, 06–20 Uhr — 238,00 € / Monat',
        detail: 'variabler Stellplatz',
      },
      {
        id: '1030-intercont__nacht-var',
        label: 'Nachtparker * — 152,00 € / Monat',
        detail: 'variabler Stellplatz',
      },
    ],
  },
  {
    id: '1060-mollardgasse',
    label: '1060 Wien — Garage Mollardgasse',
    tarife: [
      {
        id: '1060-mollardgasse__mw-fr-350',
        label: 'Mo–Fr, 00–24 Uhr — 350,00 € / Monat',
        detail: 'Werktags durchgehend',
      },
      {
        id: '1060-mollardgasse__mo-so-430-var',
        label: 'Mo–So, 00–24 Uhr — 430,00 € / Monat',
        detail: 'variabler Stellplatz',
      },
      {
        id: '1060-mollardgasse__mo-so-615-prime',
        label: 'Mo–So, 00–24 Uhr — 615,00 € / Monat',
        detail: 'Fixstellplatz Prime Parking (1. Etage)',
      },
      {
        id: '1060-mollardgasse__mo-so-575-fix',
        label: 'Mo–So, 00–24 Uhr — 575,00 € / Monat',
        detail: 'Fixstellplatz untere Ebenen',
      },
      {
        id: '1060-mollardgasse__bike-21',
        label: 'Fahrrad, e-Scooter / e-Bike — 21,00 € / Monat',
        detail: '00–24 Uhr',
      },
    ],
  },
  {
    id: '1070-zieglergasse',
    label: '1070 Wien — Zieglergasse',
    tarife: [
      {
        id: '1070-zieglergasse__mo-so-24h-fix',
        label: 'Mo–So, 00–24 Uhr — 303,00 € / Monat',
        detail: 'Fixstellplatz',
      },
      {
        id: '1070-zieglergasse__mo-so-24h-var',
        label: 'Mo–So, 00–24 Uhr — 227,00 € / Monat',
        detail: 'variabler Stellplatz',
      },
      {
        id: '1070-zieglergasse__mo-fr-6-20-var',
        label: 'Mo–Fr, 06–20 Uhr — 205,00 € / Monat',
        detail: 'variabler Stellplatz',
      },
      {
        id: '1070-zieglergasse__mo-sa-6-20-var',
        label: 'Mo–Sa, 06–20 Uhr — 217,00 € / Monat',
        detail: 'variabler Stellplatz',
      },
    ],
  },
  {
    id: '1070-neubaugasse',
    label: '1070 Wien — Garage Neubaugasse',
    tarife: [
      {
        id: '1070-neubaugasse__nacht-var',
        label: 'Nachtparker * — 145,00 € / Monat',
        detail: 'variabler Stellplatz',
      },
      {
        id: '1070-neubaugasse__motorrad',
        label: 'Motorrad — 80,00 € / Monat',
        detail: '00–24 Uhr',
      },
    ],
  },
  {
    id: '1190-skyline',
    label: '1190 Wien — P&R Garage Skyline',
    tarife: [
      {
        id: '1190-skyline__mo-so-24h-fix-range',
        label: 'Mo–So, 00–24 Uhr — 350,00–415,00 € / Monat',
        detail: 'Fixstellplatz (je nach Kategorie)',
      },
      {
        id: '1190-skyline__mo-so-24h-var',
        label: 'Mo–So, 00–24 Uhr — 310,00 € / Monat',
        detail: 'variabler Stellplatz',
      },
      {
        id: '1190-skyline__mo-sa-6-20-var',
        label: 'Mo–Sa, 06–20 Uhr — 275,00 € / Monat',
        detail: 'variabler Stellplatz',
      },
      {
        id: '1190-skyline__mo-fr-6-20-var',
        label: 'Mo–Fr, 06–20 Uhr — 253,00 € / Monat',
        detail: 'variabler Stellplatz',
      },
      {
        id: '1190-skyline__nacht-var',
        label: 'Nachtparker * — 205,00 € / Monat',
        detail: 'variabler Stellplatz',
      },
      {
        id: '1190-skyline__motorrad',
        label: 'Motorrad — 88,00 € / Monat',
        detail: '00–24 Uhr',
      },
    ],
  },
  {
    id: '1210-am-spitz',
    label: '1210 Wien — Garage Am Spitz',
    tarife: [
      {
        id: '1210-am-spitz__mo-so-24h-var',
        label: 'Mo–So, 00–24 Uhr — 180,00 € / Monat',
        detail: 'variabler Stellplatz',
      },
      {
        id: '1210-am-spitz__mo-fr-6-20-var',
        label: 'Mo–Fr, 06–20 Uhr — 165,00 € / Monat',
        detail: 'variabler Stellplatz',
      },
      {
        id: '1210-am-spitz__nacht-var',
        label: 'Nachtparker ** — 95,00 € / Monat',
        detail: 'variabler Stellplatz',
      },
      {
        id: '1210-am-spitz__motorrad',
        label: 'Motorrad — 72,00 € / Monat',
        detail: '00–24 Uhr',
      },
    ],
  },
  {
    id: '1220-reichsbruecke',
    label: '1220 Wien — Garage Reichsbrücke',
    tarife: [
      {
        id: '1220-reichsbruecke__mo-so-var',
        label: 'Mo–So — 181,00 € / Monat',
        detail: 'variabler Stellplatz',
      },
      {
        id: '1220-reichsbruecke__fix-jungmais',
        label: 'Fixstellplatz Einfahrt Jungmaisstraße — 152,32–169,86 € / Monat',
        detail: 'Mo–So, 00–24 Uhr',
      },
      {
        id: '1220-reichsbruecke__elbl-var-reichsbruecke',
        label:
          'Parkhaus ELBL variabler Stellplatz, Einfahrt Reichsbrücke — 145,84 € / Monat',
        detail: 'Mo–So, 00–24 Uhr',
      },
    ],
  },
  {
    id: '8020-graz-leiner',
    label: '8020 Graz — Garage Leiner',
    tarife: [
      {
        id: '8020-graz-leiner__mw-fr-350',
        label: 'Mo–Fr, 00–24 Uhr — 350,00 € / Monat',
        detail: 'Werktags durchgehend',
      },
      {
        id: '8020-graz-leiner__mo-so-430-var',
        label: 'Mo–So, 00–24 Uhr — 430,00 € / Monat',
        detail: 'variabler Stellplatz',
      },
      {
        id: '8020-graz-leiner__mo-so-615-prime',
        label: 'Mo–So, 00–24 Uhr — 615,00 € / Monat',
        detail: 'Fixstellplatz Prime Parking (1. Etage)',
      },
      {
        id: '8020-graz-leiner__mo-so-575-fix',
        label: 'Mo–So, 00–24 Uhr — 575,00 € / Monat',
        detail: 'Fixstellplatz untere Ebenen',
      },
      {
        id: '8020-graz-leiner__bike-21',
        label: 'Fahrrad, e-Scooter / e-Bike — 21,00 € / Monat',
        detail: '00–24 Uhr',
      },
    ],
  },
] as const

export type GarageId = (typeof GARAGEN)[number]['id']

/** Standard beim ersten Laden des Formulars. */
export const DEFAULT_GARAGE_ID: GarageId = '1010-posthoefe'
export const DEFAULT_TARIF_ID = GARAGEN.find(
  (g) => g.id === DEFAULT_GARAGE_ID,
)!.tarife[0]!.id

export function getTarifeForGarage(garageId: string): readonly TarifDef[] {
  const g = GARAGEN.find((x) => x.id === garageId)
  return g?.tarife ?? []
}

/** Anzeige für E-Mail / Listen: Kurzbeschreibung des gewählten Tarifs. */
export function formatTarifLine(tarifId: string): string {
  for (const g of GARAGEN) {
    const t = g.tarife.find((x) => x.id === tarifId)
    if (t) return `${t.label} — ${t.detail}`
  }
  return tarifId
}

export const KAUTION_EUR = 400
export const MIN_VERTRAG_MONATE = 3
export const KUENDIGUNG_HINWEIS =
  'Mindestvertragsdauer 3 Monate, Kündigungsfrist ein Monat zum Monatsletzten.'
