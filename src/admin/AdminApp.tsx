import { useEffect, useState, type FormEvent } from 'react'
import { adminFetch, readToken, writeToken, type AdminState } from './api'
import { AntraegePanel } from './AntraegePanel'
import { GaragenPanel } from './GaragenPanel'
import { SettingsPanel } from './SettingsPanel'
import './admin.css'

type Tab = 'garagen' | 'settings' | 'antraege'

export function AdminApp() {
  const [token, setToken] = useState<string | null>(() => readToken())
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [busy, setBusy] = useState(false)
  const [state, setState] = useState<AdminState | null>(null)
  const [loadError, setLoadError] = useState('')
  const [tab, setTab] = useState<Tab>('garagen')

  useEffect(() => {
    if (!token) return
    let cancel = false
    adminFetch<AdminState>('state', {}, token)
      .then((next) => {
        if (!cancel) setState(next)
      })
      .catch((e: unknown) => {
        if (cancel) return
        const status = e instanceof Error && 'status' in e ? (e as { status: number }).status : 0
        if (status === 401) {
          writeToken(null)
          setToken(null)
          return
        }
        setLoadError(e instanceof Error ? e.message : 'Laden fehlgeschlagen.')
      })
    return () => {
      cancel = true
    }
  }, [token])

  async function login(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setLoginError('')
    try {
      const res = await adminFetch<{ token: string }>('login', { password }, null)
      writeToken(res.token)
      setToken(res.token)
      setPassword('')
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : 'Anmeldung fehlgeschlagen.')
    } finally {
      setBusy(false)
    }
  }

  function logout() {
    writeToken(null)
    setToken(null)
    setState(null)
  }

  return (
    <div className="layout admin-layout">
      <header className="header">
        <p className="brand">PARKHAUS ELBL</p>
        <div className="admin-top">
          <h1>Verwaltung</h1>
          <div className="admin-links">
            <a href="/">Zur Anmeldung</a>
            {token && (
              <button type="button" className="linkish" onClick={logout}>
                Abmelden
              </button>
            )}
          </div>
        </div>
        <p className="sub">Garagen, Tarife und Empfänger der Antragsmail.</p>
      </header>
      {!token ? (
        <form className="login-box stack-fields" onSubmit={(e) => void login(e)}>
          <label>
            Passwort
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <button type="submit" className="btn" disabled={busy || password.length === 0}>
            {busy ? 'Prüft…' : 'Anmelden'}
          </button>
          {loginError && <p className="banner err">{loginError}</p>}
          <p className="hint">
            Das Passwort ist die Variable ADMIN_PASSWORD auf dem Server, mindestens
            8 Zeichen. Es wird nicht im Browser gespeichert.
          </p>
        </form>
      ) : loadError ? (
        <p className="banner err">{loadError}</p>
      ) : !state ? (
        <p className="hint">Daten werden geladen…</p>
      ) : (
        <main>
          <p className={`banner ${state.writable ? 'ok' : 'warn'}`}>{state.notice}</p>
          <div className="tabs" role="tablist">
            <button type="button" className={`tab ${tab === 'garagen' ? 'active' : ''}`} onClick={() => setTab('garagen')}>
              Garagen
            </button>
            <button type="button" className={`tab ${tab === 'settings' ? 'active' : ''}`} onClick={() => setTab('settings')}>
              E-Mail und Texte
            </button>
            <button type="button" className={`tab ${tab === 'antraege' ? 'active' : ''}`} onClick={() => setTab('antraege')}>
              Anträge
            </button>
          </div>
          {tab === 'garagen' && (
            <GaragenPanel
              garagen={state.garagen}
              writable={state.writable}
              token={token}
              onChange={setState}
            />
          )}
          {tab === 'settings' && (
            <SettingsPanel
              settings={state.settings}
              writable={state.writable}
              token={token}
              onChange={setState}
            />
          )}
          {tab === 'antraege' && <AntraegePanel token={token} garagen={state.garagen} />}
        </main>
      )}
    </div>
  )
}
