import { useState } from 'react'
import {
  composeTarifLabel,
  normalizePrice,
  splitTarifLabel,
  type CatalogGarage,
} from '../lib/catalogModel'
import { adminFetch, type AdminState } from './api'

type TarifDraft = {
  key: string
  id?: string
  title: string
  price: string
  detail: string
  active: boolean
}

type GarageDraft = {
  id?: string
  label: string
  vertragsAdresse: string
  kation: string
  active: boolean
  tarife: TarifDraft[]
}

function blankTarif(): TarifDraft {
  return { key: crypto.randomUUID(), title: '', price: '', detail: '', active: true }
}

function fromGarage(garage: CatalogGarage): GarageDraft {
  return {
    id: garage.id,
    label: garage.label,
    vertragsAdresse: garage.vertragsAdresse,
    kation: garage.kationEur == null ? '' : String(garage.kationEur).replace('.', ','),
    active: garage.active,
    tarife: garage.tarife
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((t) => {
        const parts = splitTarifLabel(t.label)
        return {
          key: t.id,
          id: t.id,
          title: parts.title,
          price: parts.price,
          detail: t.detail,
          active: t.active,
        }
      }),
  }
}

function blankGarage(): GarageDraft {
  return {
    label: '',
    vertragsAdresse: '',
    kation: '',
    active: true,
    tarife: [blankTarif()],
  }
}

export function GaragenPanel({
  garagen,
  writable,
  token,
  onChange,
}: {
  garagen: CatalogGarage[]
  writable: boolean
  token: string
  onChange: (state: AdminState) => void
}) {
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  async function move(index: number, dir: -1 | 1) {
    const next = garagen.slice()
    const target = index + dir
    if (target < 0 || target >= next.length) return
    const [item] = next.splice(index, 1)
    if (!item) return
    next.splice(target, 0, item)
    setError('')
    try {
      const state = await adminFetch<AdminState>(
        'reorderGarages',
        { ids: next.map((g) => g.id) },
        token,
      )
      onChange(state)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Reihenfolge fehlgeschlagen.')
    }
  }

  return (
    <div>
      {error && <p className="banner err">{error}</p>}
      <div className="inline-actions" style={{ marginBottom: '1rem' }}>
        <button
          type="button"
          className="btn"
          disabled={!writable}
          onClick={() => setCreating((v) => !v)}
        >
          {creating ? 'Abbrechen' : 'Garage hinzufügen'}
        </button>
      </div>
      {creating && (
        <GarageEditor
          initial={blankGarage()}
          title="Neue Garage"
          writable={writable}
          token={token}
          onSaved={(state) => {
            setCreating(false)
            onChange(state)
          }}
        />
      )}
      {garagen.map((garage, index) => (
        <GarageEditor
          key={garage.id}
          initial={fromGarage(garage)}
          title={garage.label}
          writable={writable}
          token={token}
          canUp={index > 0}
          canDown={index < garagen.length - 1}
          onMove={(dir) => move(index, dir)}
          onDelete={async () => {
            if (!window.confirm(`Garage „${garage.label}“ und ihre Tarife löschen?`)) return
            setError('')
            try {
              const state = await adminFetch<AdminState>(
                'deleteGarage',
                { id: garage.id },
                token,
              )
              onChange(state)
            } catch (e) {
              setError(e instanceof Error ? e.message : 'Löschen fehlgeschlagen.')
            }
          }}
          onSaved={onChange}
        />
      ))}
    </div>
  )
}

function GarageEditor({
  initial,
  title,
  writable,
  token,
  canUp,
  canDown,
  onMove,
  onDelete,
  onSaved,
}: {
  initial: GarageDraft
  title: string
  writable: boolean
  token: string
  canUp?: boolean
  canDown?: boolean
  onMove?: (dir: -1 | 1) => void
  onDelete?: () => void
  onSaved: (state: AdminState) => void
}) {
  const [draft, setDraft] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [isError, setIsError] = useState(false)

  function patchTarif(key: string, patch: Partial<TarifDraft>) {
    setDraft((d) => ({
      ...d,
      tarife: d.tarife.map((t) => (t.key === key ? { ...t, ...patch } : t)),
    }))
  }

  async function save() {
    setBusy(true)
    setMessage('')
    try {
      const state = await adminFetch<AdminState>(
        'saveGarage',
        {
          garage: {
            id: draft.id,
            label: draft.label,
            vertragsAdresse: draft.vertragsAdresse,
            kationEur: draft.kation.trim() === '' ? null : draft.kation,
            active: draft.active,
            tarife: draft.tarife.map((t) => ({
              id: t.id,
              title: t.title,
              price: t.price,
              detail: t.detail,
              active: t.active,
            })),
          },
        },
        token,
      )
      const saved = draft.id
        ? state.garagen.find((g) => g.id === draft.id)
        : undefined
      if (saved) setDraft(fromGarage(saved))
      setIsError(false)
      setMessage('Gespeichert.')
      onSaved(state)
    } catch (e) {
      setIsError(true)
      setMessage(e instanceof Error ? e.message : 'Speichern fehlgeschlagen.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="garage-card">
      <div className="card-head">
        <h2>{title}</h2>
        <div className="inline-actions">
          {onMove && (
            <>
              <button type="button" className="btn-ghost" disabled={!writable || !canUp} onClick={() => onMove(-1)}>
                Nach oben
              </button>
              <button type="button" className="btn-ghost" disabled={!writable || !canDown} onClick={() => onMove(1)}>
                Nach unten
              </button>
            </>
          )}
          {onDelete && (
            <button type="button" className="btn-danger" disabled={!writable || busy} onClick={onDelete}>
              Löschen
            </button>
          )}
        </div>
      </div>
      <div className="stack-fields">
        <label>
          Name im Formular
          <input
            value={draft.label}
            disabled={!writable}
            onChange={(e) => setDraft({ ...draft, label: e.target.value })}
          />
        </label>
        <label>
          Adresse im Vertrag
          <input
            value={draft.vertragsAdresse}
            disabled={!writable}
            onChange={(e) => setDraft({ ...draft, vertragsAdresse: e.target.value })}
          />
        </label>
        <label>
          Kaution (€)
          <input
            inputMode="decimal"
            value={draft.kation}
            disabled={!writable}
            placeholder="leer, wenn kein Betrag"
            onChange={(e) => setDraft({ ...draft, kation: e.target.value })}
          />
          <span className="hint">Leer lassen, wenn auf der Website kein Betrag stehen soll.</span>
        </label>
      </div>
      <label className="check-inline">
        <input
          type="checkbox"
          checked={draft.active}
          disabled={!writable}
          onChange={(e) => setDraft({ ...draft, active: e.target.checked })}
        />
        Im Anmeldeformular anzeigen
      </label>
      {draft.tarife.map((tarif) => {
        const price = normalizePrice(tarif.price)
        const preview =
          tarif.title.trim() && price ? composeTarifLabel(tarif.title, tarif.price) : ''
        return (
          <div className="tarif-row" key={tarif.key}>
            <label>
              Tarif
              <input
                value={tarif.title}
                disabled={!writable}
                placeholder="Mo–So, 00–24 Uhr"
                onChange={(e) => patchTarif(tarif.key, { title: e.target.value })}
              />
            </label>
            <label>
              Preis € / Monat
              <input
                value={tarif.price}
                disabled={!writable}
                placeholder="350,00"
                onChange={(e) => patchTarif(tarif.key, { price: e.target.value })}
              />
            </label>
            <label>
              Zusatz
              <input
                value={tarif.detail}
                disabled={!writable}
                placeholder="variabler Stellplatz"
                onChange={(e) => patchTarif(tarif.key, { detail: e.target.value })}
              />
            </label>
            <div className="inline-actions">
              <label className="check-inline">
                <input
                  type="checkbox"
                  checked={tarif.active}
                  disabled={!writable}
                  onChange={(e) => patchTarif(tarif.key, { active: e.target.checked })}
                />
                aktiv
              </label>
              <button
                type="button"
                className="btn-danger"
                disabled={!writable || draft.tarife.length < 2}
                onClick={() =>
                  setDraft((d) => ({ ...d, tarife: d.tarife.filter((t) => t.key !== tarif.key) }))
                }
              >
                Entfernen
              </button>
            </div>
            {preview && <p className="preview">{preview}</p>}
          </div>
        )
      })}
      <div className="inline-actions">
        <button
          type="button"
          className="btn-ghost"
          disabled={!writable}
          onClick={() => setDraft((d) => ({ ...d, tarife: [...d.tarife, blankTarif()] }))}
        >
          Tarif hinzufügen
        </button>
        <button type="button" className="btn" disabled={!writable || busy} onClick={() => void save()}>
          {busy ? 'Speichert…' : 'Speichern'}
        </button>
      </div>
      {message && <p className={`banner ${isError ? 'err' : 'ok'}`}>{message}</p>}
    </section>
  )
}
