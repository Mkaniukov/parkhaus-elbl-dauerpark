import { ApplicationForm } from './components/ApplicationForm'
import './App.css'

function App() {
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
        <ApplicationForm />
      </main>
      <footer className="footer">
        <a href="mailto:office@parkhaus-elbl.at">office@parkhaus-elbl.at</a>
        {' · '}
        <a href="https://www.parkhaus-elbl.at" target="_blank" rel="noreferrer">
          parkhaus-elbl.at
        </a>
      </footer>
    </div>
  )
}

export default App
