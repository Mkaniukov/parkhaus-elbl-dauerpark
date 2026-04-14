import {
  Document,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TableLayoutType,
  TextRun,
  WidthType,
} from 'docx'
import type { ApplicationPayload } from '../../src/lib/schema'
import { GARAGEN, formatTarifLine } from '../../src/lib/constants'
import { formatDateDE } from '../../src/lib/contractHelpers'

function garageLabel(id: string): string {
  return GARAGEN.find((g) => g.id === id)?.label ?? id
}

function garageVertragsadresse(id: string): string {
  return GARAGEN.find((g) => g.id === id)?.vertragsAdresse ?? '—'
}

function pCell(text: string, bold = false): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({
        text,
        bold,
        font: 'Calibri',
        size: bold ? 22 : 22,
      }),
    ],
  })
}

/** Dateiname für E-Mail-Anhang (ASCII, kurz). */
export function antragDocxFilename(payload: ApplicationPayload): string {
  const kn = payload.kennzeichen
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 28)
  const name = payload.name_firma
    .replace(/[^\w\s-]/g, '')
    .trim()
    .slice(0, 36)
    .replace(/\s+/g, '-')
  return `Dauerpark-Antrag_${name || 'Antrag'}_${kn || 'X'}.docx`
}

export async function buildAntragDocx(
  payload: ApplicationPayload,
): Promise<Buffer> {
  const rows: [string, string][] = [
    ['Name / Firma', payload.name_firma],
    ['Adresse', payload.adresse],
    ['Telefon', payload.telefon],
    ['E-Mail', payload.email],
    ['Beginn (gewünscht)', formatDateDE(payload.beginn)],
    ['Garage (Bezeichnung)', garageLabel(payload.garage)],
    ['Garage (Vertragsort)', garageVertragsadresse(payload.garage)],
    ['Fahrzeug (Marke / Typ)', payload.fahrzeug],
    ['Kennzeichen', payload.kennzeichen],
    ['Tarif', formatTarifLine(payload.tarif)],
    ['IBAN', payload.iban],
    ['BIC', payload.bic ?? '—'],
    ['Konto lautend auf', payload.lautend_auf],
    ['AGB akzeptiert', payload.agb_akzeptiert ? 'ja' : 'nein'],
    ['SEPA akzeptiert', payload.sepa_akzeptiert ? 'ja' : 'nein'],
    ['Datenschutz akzeptiert', payload.datenschutz_akzeptiert ? 'ja' : 'nein'],
  ]

  const tableRows: TableRow[] = [
    new TableRow({
      children: [
        new TableCell({
          width: { size: 38, type: WidthType.PERCENTAGE },
          children: [pCell('Feld', true)],
        }),
        new TableCell({
          width: { size: 62, type: WidthType.PERCENTAGE },
          children: [pCell('Inhalt', true)],
        }),
      ],
    }),
    ...rows.map(
      ([k, v]) =>
        new TableRow({
          children: [
            new TableCell({
              children: [pCell(k)],
            }),
            new TableCell({
              children: [pCell(String(v))],
            }),
          ],
        }),
    ),
  ]

  const doc = new Document({
    creator: 'Parkhaus ELBL Dauerpark',
    title: 'Dauerpark-Antrag',
    description: 'Bearbeitbar für Buchhaltung',
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1440,
              right: 1440,
              bottom: 1440,
              left: 1440,
            },
          },
        },
        children: [
          new Paragraph({
            children: [
              new TextRun({
                text: 'Dauerpark-Antrag',
                bold: true,
                size: 32,
                font: 'Calibri',
              }),
            ],
            spacing: { after: 120 },
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: 'Parkhaus ELBL — Daten für Buchhaltung (Word, bearbeitbar)',
                size: 22,
                italics: true,
                font: 'Calibri',
              }),
            ],
            spacing: { after: 280 },
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            layout: TableLayoutType.FIXED,
            rows: tableRows,
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: 'Hinweis: Dieses Dokument wurde automatisch aus der Online-Anmeldung erzeugt.',
                size: 18,
                color: '666666',
                font: 'Calibri',
              }),
            ],
            spacing: { before: 360 },
          }),
        ],
      },
    ],
  })

  return Packer.toBuffer(doc)
}
