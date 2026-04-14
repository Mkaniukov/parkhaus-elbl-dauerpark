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
      <div ref={ref} className="contract-print-root" lang="de">
        <section className="contract-page contract-page--1">
          <header className="contract-letterhead">
            <h1 className="contract-angebot-title">ANGEBOT AN:</h1>
            <div className="contract-letterhead-body">
              <p className="contract-lh-company">
                <strong>Nurejew Promenade Garagen GmbH &amp; Co KG</strong>
              </p>
              <p className="contract-lh-muted">vertreten durch</p>
              <p className="contract-lh-elbl">
                <strong>Parkhaus Elbl</strong>
                <br />
                Betriebsgesellschaft m. b. H.
                <br />
                1010 Wien, Seitenstettengasse 5 / 15
                <br />
                <span className="contract-lh-email">
                  office@parkhaus-elbl.at
                </span>
                <br />
                Telefon: 01/532 47 75 · Fax 01/532 47 75 20
              </p>
              <p className="contract-lh-intro">
                (im Folgenden Garagenunternehmen genannt) auf Abschluss eines
              </p>
              <p className="contract-garage-title">
                <strong>GARAGENNUTZUNGSVERTRAGES</strong>
              </p>
              <p className="contract-lh-garage-line">
                für die Garage in <strong>{data.vertragsAdresse}</strong> (im
                Folgenden Garage genannt)
              </p>
            </div>
          </header>

          <div className="contract-parties">
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
                  <td>
                    s.o. · FAX: ________
                  </td>
                </tr>
                <tr>
                  <td>E-Mail</td>
                  <td>{data.email}</td>
                </tr>
              </tbody>
            </table>

            <p className="contract-nutzung contract-nutzung--einsteller">
              (im Folgenden Einsteller genannt)
            </p>

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
                Das monatliche Entgelt für diesen {st} ergibt sich aus dem
                gewählten Tarif (Preise inkl. 20 % USt.):
              </p>
              <p>
                <strong>Gewählter Tarif:</strong> {data.tarifLabel}
              </p>
              <p>
                <strong>
                  Derzeitiges monatliches Gesamtentgelt (inkl. USt.) gemäß
                  Tarif:
                </strong>{' '}
                {data.gesamtentgeltAnzeige}
              </p>
              <p className="contract-hinweis-klein">
                Eine Aufschlüsselung in Hauptmietzins, Betriebskosten und
                Umsatzsteuer kann je nach Stellplatz gesondert mitgeteilt werden
                (vgl. Muster auf Seite 1 des Originalvertrags).
              </p>
            </div>
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
