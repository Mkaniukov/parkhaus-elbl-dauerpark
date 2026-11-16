import { ApplicationForm } from './components/ApplicationForm'
import { AdminApp } from './admin/AdminApp'
import { usePublicCatalog } from './lib/usePublicCatalog'
import './App.css'

function PublicApp() {
  const catalog = usePublicCatalog()
  return (
    <div className="layout">
      <header className="header">
        <p className="brand">PARKHAUS ELBL</p>
        <h1>Dauerparkplatz — Online-Anmeldung</h1>
        <p className="sub">
          Bitte füllen Sie alle Felder aus. Preise inkl. 20 % UST.
        </p>
      </header>
      <main>
        <ApplicationForm catalog={catalog} />
      </main>
      <footer className="footer">
        <a href={`mailto:${catalog.settings.publicEmail}`}>
          {catalog.settings.publicEmail}
        </a>
        {' · '}
        <a href="https://www.parkhaus-elbl.at" target="_blank" rel="noreferrer">
          parkhaus-elbl.at
        </a>
        {' · '}
        <a href="/admin">Verwaltung</a>
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
