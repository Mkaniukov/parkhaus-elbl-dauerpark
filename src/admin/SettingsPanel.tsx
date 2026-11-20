import { useState } from 'react'
import type { AdminSettings } from '../lib/catalogModel'
import { adminFetch, type AdminState } from './api'

export function SettingsPanel({
  settings,
  writable,
  token,
  onChange,
}: {
  settings: AdminSettings
  writable: boolean
  token: string
  onChange: (state: AdminState) => void
}) {
  const [draft, setDraft] = useState(settings)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [isError, setIsError] = useState(false)

  function patch(partial: Partial<AdminSettings>) {
    setDraft((d) => ({ ...d, ...partial }))
  }

  async function save() {
    setBusy(true)
    setMessage('')
    try {
      const state = await adminFetch<AdminState>(
        'saveSettings',
        {
          settings: {
            ...draft,
            kationEur: Number(String(draft.kationEur).replace(',', '.')),
            minVertragMonate: Number(draft.minVertragMonate),
          },
        },
        token,
      )
      setIsError(false)
      setMessage('Gespeichert. Formular und künftige Verträge nutzen diese Werte.')
      setDraft(state.settings)
      onChange(state)
    } catch (e) {
      setIsError(true)
      setMessage(e instanceof Error ? e.message : 'Speichern fehlgeschlagen.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="panel-card">
      <h2>E-Mail und Vertragstexte</h2>
      <p className="hint">
        SMTP-Zugangsdaten (MAIL_USER, Passwort, Absender) bleiben in den
        Netlify-Variablen. Hier ändern Sie nur, wohin Anträge gehen und was
        Antragsteller sehen.
      </p>
      <div className="stack-fields" style={{ marginTop: '0.9rem' }}>
        <label>
          Empfänger der Büromail
          <textarea
            value={draft.notifyTo}
            disabled={!writable}
            onChange={(e) => patch({ notifyTo: e.target.value })}
          />
          <span className="hint">Eine Adresse pro Zeile. Alle erhalten den Antrag.</span>
        </label>
        <label>
          Öffentliche E-Mail
          <input
            type="email"
            value={draft.publicEmail}
            disabled={!writable}
            onChange={(e) => patch({ publicEmail: e.target.value })}
          />
          <span className="hint">
            Steht im Formular und ist Reply-To der Bestätigung an den Antragsteller.
          </span>
        </label>
        <label>
          Kaution, falls die Garage keinen eigenen Betrag hat (€)
          <input
            inputMode="decimal"
            value={draft.kationEur}
            disabled={!writable}
            onChange={(e) => patch({ kationEur: Number(e.target.value.replace(',', '.')) })}
          />
          <span className="hint">
            Steht nur im Vertrag, wenn bei der Garage das Feld Kaution leer ist. Die Website zeigt den Betrag der Garage.
          </span>
        </label>
        <label>
          Mindestlaufzeit (Monate)
          <input
            inputMode="numeric"
            value={draft.minVertragMonate}
            disabled={!writable}
            onChange={(e) => patch({ minVertragMonate: Number(e.target.value) })}
          />
        </label>
        <label>
          Kündigungshinweis
          <textarea
            value={draft.kuendigungHinweis}
            disabled={!writable}
            onChange={(e) => patch({ kuendigungHinweis: e.target.value })}
          />
        </label>
        <label>
          Link zu den AGB
          <input
            value={draft.agbPdfUrl}
            disabled={!writable}
            onChange={(e) => patch({ agbPdfUrl: e.target.value })}
          />
        </label>
      </div>
      <div className="inline-actions" style={{ marginTop: '0.9rem' }}>
        <button type="button" className="btn" disabled={!writable || busy} onClick={() => void save()}>
          {busy ? 'Speichert…' : 'Speichern'}
        </button>
      </div>
      {message && <p className={`banner ${isError ? 'err' : 'ok'}`}>{message}</p>}
    </section>
  )
}
