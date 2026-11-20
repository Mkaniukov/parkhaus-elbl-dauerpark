import { ApplicationForm } from './components/ApplicationForm'
import { AdminApp } from './admin/AdminApp'
import { usePublicCatalog } from './lib/usePublicCatalog'
import './App.css'

function PublicApp() {
  const catalog = usePublicCatalog()
  return (
    <div className="elbl">
      <div className="elbl-banner">
        <img src="/legacy/images/Banner/Header_2500x400.jpg" alt="" />
        <header className="elbl-top">
          <a className="elbl-logo" href="https://www.parkhaus-elbl.at/">
            <img
              src="/legacy/images/Logos/P-Quadrat_200x200.png"
              alt="Parkhaus Elbl"
              width={75}
              height={75}
            />
          </a>
        </header>
      </div>
      <main className="elbl-main">
        <h1>Dauerparkplatz — Online-Anmeldung</h1>
        <p className="sub">
          Felder mit * sind erforderlich. Preise inkl. 20 % UST.
        </p>
        <ApplicationForm catalog={catalog} />
      </main>
      <footer className="elbl-foot">
        <p className="slogan">
          DIE <strong>SUCHE</strong> HAT EIN <strong>ENDE</strong>
        </p>
        <p className="copy">
          Copyright by
          <br />
          <strong>PARKHAUS ELBL</strong>
          <br />
          Betriebsgesellschaft m.b.H.
        </p>
        <p className="foot-links">
          <a href={`mailto:${catalog.settings.publicEmail}`}>
            {catalog.settings.publicEmail}
          </a>
          {' · '}
          <a href="https://www.parkhaus-elbl.at/">parkhaus-elbl.at</a>
        </p>
      </footer>
    </div>
  )
}

function App() {
  const path = window.location.pathname
  if (path === '/admin' || path.startsWith('/admin/')) return <AdminApp />
  return <PublicApp />
}

export default App
