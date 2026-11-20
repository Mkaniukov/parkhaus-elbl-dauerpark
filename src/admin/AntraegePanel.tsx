import { useEffect, useState } from 'react'
import type { CatalogGarage } from '../lib/catalogModel'
import { adminFetch, type AntragListItem } from './api'

function labelFor(garagen: CatalogGarage[], garageId: string, tarifId: string): string {
  const garage = garagen.find((g) => g.id === garageId)
  const tarif = garage?.tarife.find((t) => t.id === tarifId)
  const garageName = garage?.label ?? garageId
  const tarifName = tarif?.label ?? tarifId
  return `${garageName} — ${tarifName}`
}

export function AntraegePanel({
  token,
  garagen,
}: {
  token: string
  garagen: CatalogGarage[]
}) {
  const [rows, setRows] = useState<AntragListItem[]>([])
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancel = false
    adminFetch<{ antraege: AntragListItem[]; note?: string }>('antraege', {}, token)
      .then((res) => {
        if (cancel) return
        setRows(res.antraege ?? [])
        setNote(res.note ?? '')
      })
      .catch((e: unknown) => {
        if (cancel) return
        setError(e instanceof Error ? e.message : 'Anträge konnten nicht geladen werden.')
      })
      .finally(() => {
        if (!cancel) setLoading(false)
      })
    return () => {
      cancel = true
    }
  }, [token])

  if (loading) return <p className="hint">Anträge werden geladen…</p>
  if (error) return <p className="banner err">{error}</p>

  return (
    <section className="panel-card">
      <h2>Letzte Anträge</h2>
      <p className="hint">
        Nur zur Übersicht. Bankdaten stehen in der Büromail und in Supabase, nicht in
        dieser Liste.
      </p>
      {note && <p className="banner warn">{note}</p>}
      {rows.length === 0 && !note && <p className="hint">Noch keine Anträge.</p>}
      <div className="antrag-list">
        {rows.map((row) => (
          <article className="antrag-card" key={row.id}>
            <strong>{row.name_firma}</strong>
            <div>
              {new Date(row.created_at).toLocaleString('de-AT')} · Beginn {row.beginn}
            </div>
            <div>{labelFor(garagen, row.garage, row.tarif)}</div>
            {[row.fahrzeug, row.kennzeichen].filter(Boolean).length > 0 && (
              <div>{[row.fahrzeug, row.kennzeichen].filter(Boolean).join(' · ')}</div>
            )}
            <div>
              <a href={`mailto:${row.email}`}>{row.email}</a>
              {row.telefon ? ` · ${row.telefon}` : ''}
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
