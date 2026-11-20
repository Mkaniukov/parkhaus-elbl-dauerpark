import { useEffect, useRef, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  applicationPayloadSchema,
  type ApplicationFormInput,
} from '../lib/schema'
import {
  DEFAULT_GARAGE_ID,
  DEFAULT_TARIF_ID,
} from '../lib/constants'
import type { PublicCatalog } from '../lib/catalogModel'

function garageFromAddress(): string | null {
  if (typeof window === 'undefined') return null
  const id = new URLSearchParams(window.location.search).get('garage')?.trim()
  return id || null
}

const defaultValues: ApplicationFormInput = {
  name_firma: '',
  adresse: '',
  telefon: '',
  email: '',
  beginn: '',
  fahrzeug: '',
  kennzeichen: '',
  iban: '',
  bic: '',
  lautend_auf: '',
  stellplatz_nutzer: '',
  tarif: DEFAULT_TARIF_ID,
  garage: DEFAULT_GARAGE_ID,
  agb_akzeptiert: false,
  sepa_akzeptiert: false,
  datenschutz_akzeptiert: false,
}

function submitEndpoint(): string {
  if (import.meta.env.VITE_SUBMIT_URL) {
    return import.meta.env.VITE_SUBMIT_URL
  }
  return '/.netlify/functions/submit'
}

export function ApplicationForm({ catalog }: { catalog: PublicCatalog }) {
  /** Honeypot: Wert nur beim Submit lesen (vermeidet Autofill/State-Fehler). */
  const companyWebsiteTrapRef = useRef<HTMLInputElement>(null)
  const requestedGarage = useRef(garageFromAddress())
  const appliedQuery = useRef(false)
  const [status, setStatus] = useState<'idle' | 'loading' | 'ok' | 'err'>(
    'idle',
  )
  const [message, setMessage] = useState('')

  const {
    register,
    handleSubmit,
    control,
    setValue,
    getValues,
    formState: { errors },
    reset,
  } = useForm<ApplicationFormInput>({
    resolver: zodResolver(applicationPayloadSchema),
    defaultValues,
  })

  const garageWatch = useWatch({ control, name: 'garage' })
  const garageId = garageWatch ?? catalog.garagen[0]?.id ?? DEFAULT_GARAGE_ID
  const tarifeAktuell =
    catalog.garagen.find((g) => g.id === garageId)?.tarife ?? []

  useEffect(() => {
    const ids = catalog.garagen.map((g) => g.id)
    let currentGarage = getValues('garage')
    const wanted = requestedGarage.current
    if (!appliedQuery.current && ids.length > 0) {
      appliedQuery.current = true
      if (wanted && ids.includes(wanted)) currentGarage = wanted
    }
    const gid = ids.includes(currentGarage) ? currentGarage : ids[0]
    if (gid && gid !== getValues('garage')) {
      setValue('garage', gid)
    }
    const list =
      catalog.garagen.find((g) => g.id === (gid ?? currentGarage))?.tarife ?? []
    const first = list[0]?.id
    if (!first) return
    const current = getValues('tarif')
    if (!list.some((t) => t.id === current)) {
      setValue('tarif', first, { shouldValidate: true })
    }
  }, [catalog, garageWatch, getValues, setValue])

  const onSubmit = handleSubmit(async (data) => {
    setStatus('loading')
    setMessage('')
    try {
      const res = await fetch(submitEndpoint(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          company_website: companyWebsiteTrapRef.current?.value ?? '',
        }),
      })
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        error?: string
        mailSkipped?: boolean
      }
      if (!res.ok || !json.ok) {
        setStatus('err')
        setMessage(json.error || 'Senden fehlgeschlagen.')
        return
      }
      setStatus('ok')
      setMessage(
        json.mailSkipped
          ? `Ihre Daten wurden gespeichert. Eine E-Mail konnte nicht versendet werden. Bitte schreiben Sie an ${catalog.settings.publicEmail}.`
          : 'Eine Bestätigung wurde an Ihre E-Mail-Adresse gesendet.',
      )
      window.scrollTo({ top: 0, behavior: 'smooth' })
      if (companyWebsiteTrapRef.current) companyWebsiteTrapRef.current.value = ''
      const firstGarage = catalog.garagen[0]
      reset({
        ...defaultValues,
        garage: firstGarage?.id ?? DEFAULT_GARAGE_ID,
        tarif: firstGarage?.tarife[0]?.id ?? DEFAULT_TARIF_ID,
      })
    } catch {
      setStatus('err')
      setMessage('Netzwerkfehler. Bitte später erneut versuchen.')
    }
  })

  if (catalog.garagen.length === 0) {
    return (
      <p className="banner warn">
        Derzeit ist keine Garage für die Online-Anmeldung freigeschaltet.
      </p>
    )
  }

  if (status === 'ok') {
    return (
      <article className="done">
        <h2>Vielen Dank</h2>
        <p>
          Vielen Dank für Ihre Online-Anmeldung eines Dauerparkplatzes bei
          Parkhaus ELBL.
        </p>
        <p>
          Wir haben Ihre Daten erfolgreich erhalten und werden sie
          schnellstmöglich bearbeiten. Bei offenen Punkten oder weiteren
          Schritten meldet sich eine Kollegin oder ein Kollege bei Ihnen.
        </p>
        <p>{message}</p>
        <p>
          <a className="button" href="https://www.parkhaus-elbl.at/">
            Zurück zur Website
          </a>
        </p>
      </article>
    )
  }

  return (
    <form className="form" onSubmit={onSubmit} noValidate>
      <p className="lede">
        Anmeldung Dauerparkplatz — Daten werden an{' '}
        <a href={`mailto:${catalog.settings.publicEmail}`}>
          {catalog.settings.publicEmail}
        </a>{' '}
        gesendet und in der Datenbank gespeichert.
        {catalog.settings.kuendigungHinweis
          ? ` ${catalog.settings.kuendigungHinweis}`
          : ''}
      </p>

      <div className="field-grid">
        <label className="field">
          <span>Name / Firma *</span>
          <input type="text" autoComplete="name" {...register('name_firma')} />
          {errors.name_firma && (
            <span className="err">{errors.name_firma.message}</span>
          )}
        </label>

        <label className="field">
          <span>Adresse *</span>
          <input type="text" autoComplete="street-address" {...register('adresse')} />
          {errors.adresse && (
            <span className="err">{errors.adresse.message}</span>
          )}
        </label>

        <label className="field">
          <span>Telefon *</span>
          <input type="tel" autoComplete="tel" {...register('telefon')} />
          {errors.telefon && (
            <span className="err">{errors.telefon.message}</span>
          )}
        </label>

        <label className="field">
          <span>E-Mail *</span>
          <input type="email" autoComplete="email" {...register('email')} />
          {errors.email && <span className="err">{errors.email.message}</span>}
        </label>

        <label className="field field-wide">
          <span>Stellplatz-Nutzer (optional)</span>
          <input
            type="text"
            autoComplete="name"
            placeholder="Falls andere Person das Fahrzeug nutzt als Name/Firma oben …"
            {...register('stellplatz_nutzer')}
          />
          {errors.stellplatz_nutzer && (
            <span className="err">{errors.stellplatz_nutzer.message}</span>
          )}
        </label>

        <label className="field">
          <span>Beginn (gewünscht) *</span>
          <input type="date" {...register('beginn')} />
          {errors.beginn && (
            <span className="err">{errors.beginn.message}</span>
          )}
        </label>

        <label className="field">
          <span>Garage / Standort *</span>
          <select {...register('garage')}>
            {catalog.garagen.map((g) => (
              <option key={g.id} value={g.id}>
                {g.label}
              </option>
            ))}
          </select>
          {errors.garage && (
            <span className="err">{errors.garage.message}</span>
          )}
        </label>

        <label className="field field-wide">
          <span>Fahrzeug (Marke / Typ) (optional)</span>
          <input type="text" {...register('fahrzeug')} />
          {errors.fahrzeug && (
            <span className="err">{errors.fahrzeug.message}</span>
          )}
        </label>

        <label className="field">
          <span>Kennzeichen (optional)</span>
          <input type="text" autoComplete="off" {...register('kennzeichen')} />
          {errors.kennzeichen && (
            <span className="err">{errors.kennzeichen.message}</span>
          )}
        </label>

        <label className="field">
          <span>Tarif *</span>
          <select {...register('tarif')}>
            {tarifeAktuell.map((t) => (
              <option key={t.id} value={t.id}>
                {t.detail ? `${t.label} — ${t.detail}` : t.label}
              </option>
            ))}
          </select>
          {errors.tarif && <span className="err">{errors.tarif.message}</span>}
        </label>

        <label className="field">
          <span>IBAN *</span>
          <input
            type="text"
            inputMode="text"
            autoComplete="off"
            placeholder="z. B. AT61 …, DE89 … oder GB29 …"
            {...register('iban')}
          />
          {errors.iban && <span className="err">{errors.iban.message}</span>}
        </label>

        <label className="field">
          <span>BIC (optional)</span>
          <input type="text" {...register('bic')} />
          {errors.bic && <span className="err">{errors.bic.message}</span>}
        </label>

        <label className="field field-wide">
          <span>Konto lautend auf *</span>
          <input type="text" {...register('lautend_auf')} />
          {errors.lautend_auf && (
            <span className="err">{errors.lautend_auf.message}</span>
          )}
        </label>
      </div>

      <div className="checks">
        <label className="check">
          <input type="checkbox" {...register('sepa_akzeptiert')} />
          <span>
            Ich akzeptiere die Einzugsermächtigung (SEPA-Lastschrift) gemäß
            Formular.
          </span>
        </label>
        {errors.sepa_akzeptiert && (
          <span className="err">{errors.sepa_akzeptiert.message}</span>
        )}

        <label className="check">
          <input type="checkbox" {...register('agb_akzeptiert')} />
          <span>
            Ich habe die{' '}
            <a
              href={catalog.settings.agbPdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
            >
              Vertragsbedingungen (AGB)
            </a>{' '}
            gelesen und akzeptiere sie.
          </span>
        </label>
        {errors.agb_akzeptiert && (
          <span className="err">{errors.agb_akzeptiert.message}</span>
        )}

        <label className="check">
          <input type="checkbox" {...register('datenschutz_akzeptiert')} />
          <span>
            Ich habe die{' '}
            <a
              href="https://www.parkhaus-elbl.at"
              target="_blank"
              rel="noreferrer"
            >
              Datenschutzhinweise
            </a>{' '}
            gelesen.
          </span>
        </label>
        {errors.datenschutz_akzeptiert && (
          <span className="err">{errors.datenschutz_akzeptiert.message}</span>
        )}
      </div>

      <input
        ref={companyWebsiteTrapRef}
        type="text"
        name="company_website"
        tabIndex={-1}
        autoComplete="off"
        className="hp"
        aria-hidden
        defaultValue=""
      />

      <div className="form-actions">
        <button
          type="submit"
          className="submit"
          disabled={status === 'loading'}
        >
          {status === 'loading' ? 'Wird gesendet…' : 'Antrag senden'}
        </button>
      </div>

      {status === 'err' && <p className="banner err">{message}</p>}
    </form>
  )
}
