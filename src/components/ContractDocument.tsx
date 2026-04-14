import { forwardRef } from 'react'
import type { ContractPreview } from '../lib/contractHelpers'
import {
  GARAGENVERTRAG_SEITE_2,
  GARAGENVERTRAG_SEITE_3,
  GARAGENVERTRAG_SEITE_4,
} from '../content/garagenvertragStatischeSeiten'
import './ContractDocument.css'

function stellplatzTyp(data: ContractPreview): string {
  if (/motorrad/i.test(data.tarifLabel)) return 'Motorrad-Stellplatz'
  if (/fahrrad|e-scooter|e-bike/i.test(data.tarifLabel))
    return 'Stellplatz (Fahrrad / e-Bike / e-Scooter)'
  return 'PKW-Einstellplatz'
}

function formatKautionEUR(n: number): string {
  return new Intl.NumberFormat('de-AT', {
    style: 'currency',
    currency: 'EUR',
  }).format(n)
}

type Props = {
  data: ContractPreview
}

export const ContractDocument = forwardRef<HTMLDivElement, Props>(
  function ContractDocument({ data }, ref) {
    const st = stellplatzTyp(data)

    return (
      <div ref={ref} className="contract-print-root">
      <section className="contract-page contract-page--1">
        <h1>Angebot an:</h1>
        <div className="contract-block">
          <p>
            <strong>Nurejew Promenade Garagen GmbH &amp; Co KG</strong>
          </p>
          <p>vertreten durch</p>
          <p>
            <strong>Parkhaus Elbl</strong>
            <br />
            Betriebsgesellschaft m. b. H.
            <br />
            1010 Wien, Seitenstettengasse 5 / 15
            <br />
            <a href="mailto:office@parkhaus-elbl.at">office@parkhaus-elbl.at</a>
            <br />
            Telefon: 01/532 47 75 · Fax 01/532 47 75 20
          </p>
          <p>
            (im Folgenden Garagenunternehmen genannt) auf Abschluss eines
          </p>
          <p>
            <strong>GARAGENNUTZUNGSVERTRAGES</strong>
          </p>
          <p>
            für die Garage in <strong>{data.vertragsAdresse}</strong> (im
            Folgenden Garage genannt)
          </p>
        </div>

        <table className="contract-meta-table">
          <tbody>
            <tr>
              <td>Herrn/Frau/Firma</td>
              <td>
                <strong>{data.name_firma}</strong> · Kunden-Nr.: ________
              </td>
            </tr>
            <tr>
              <td>Top</td>
              <td>________</td>
            </tr>
            <tr>
              <td>Anschrift</td>
              <td>{data.adresse}</td>
            </tr>
            <tr>
              <td>Firmenbuch / UID-Nr.</td>
              <td>________ / ________</td>
            </tr>
            <tr>
              <td>Telefon</td>
              <td>{data.telefon}</td>
            </tr>
            <tr>
              <td>Stellplatzbenützer</td>
              <td>wie Einsteller · FAX: ________</td>
            </tr>
            <tr>
              <td>E-Mail</td>
              <td>{data.email}</td>
            </tr>
          </tbody>
        </table>

        <p className="contract-nutzung">(im Folgenden Einsteller genannt)</p>

        <p className="contract-nutzung">{data.nutzungszeiten}</p>
        <p className="contract-nutzung">{data.tarifDetail}</p>

        <p>
          <strong>Polizeil. Kennzeichen:</strong> {data.kennzeichen}
        </p>
        <p className="contract-kaution">
          <strong>Kaution:</strong> {formatKautionEUR(data.kautionEuro)}
        </p>

        <p>
          <strong>{st}</strong>
        </p>
        <table className="contract-pkw-table">
          <thead>
            <tr>
              <th>Einstelldauer ab</th>
              <th>Fahrzeug (Marke / Typ)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{data.beginnDE}</td>
              <td>{data.fahrzeug}</td>
            </tr>
          </tbody>
        </table>

        <div className="contract-entgelt-box">
          <p>
            Das monatliche Entgelt für diesen {st} ergibt sich aus dem gewählten
            Tarif (Preise inkl. 20 % USt.):
          </p>
          <p>
            <strong>Gewählter Tarif:</strong> {data.tarifLabel}
          </p>
          <p>
            <strong>Derzeitiges monatliches Gesamtentgelt (inkl. USt.) gemäß
            Tarif:</strong> {data.gesamtentgeltAnzeige}
          </p>
          <p className="contract-hinweis-klein">
            Eine Aufschlüsselung in Hauptmietzins, Betriebskosten und Umsatzsteuer
            kann je nach Stellplatz gesondert mitgeteilt werden (vgl. Muster auf
            Seite 1 des Originalvertrags).
          </p>
        </div>
      </section>

      <section className="contract-page contract-page--2">
        <pre className="contract-legal-pre">{GARAGENVERTRAG_SEITE_2}</pre>
      </section>

      <section className="contract-page contract-page--3">
        <pre className="contract-legal-pre">{GARAGENVERTRAG_SEITE_3}</pre>
      </section>

      <section className="contract-page contract-page--4">
        <pre className="contract-legal-pre">{GARAGENVERTRAG_SEITE_4}</pre>
      </section>
    </div>
  )
},
)
