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
  GARAGEN,
  AGB_PDF_URL,
  getTarifeForGarage,
  KAUTION_EUR,
  KUENDIGUNG_HINWEIS,
  MIN_VERTRAG_MONATE,
} from '../lib/constants'

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

export function ApplicationForm() {
  /** Honeypot: Wert nur beim Submit lesen (vermeidet Autofill/State-Fehler). */
  const companyWebsiteTrapRef = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState<'idle' | 'loading' | 'ok' | 'err'>(
    'idle',
  )
  const [message, setMessage] = useState('')
  /** Server hat gespeichert, aber kein SMTP/Resend (Netlify env). */
  const [mailSkipped, setMailSkipped] = useState(false)

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
  const garageId = garageWatch ?? DEFAULT_GARAGE_ID
  const tarifeAktuell = getTarifeForGarage(garageId)

  useEffect(() => {
    const gid = garageWatch ?? DEFAULT_GARAGE_ID
    const list = getTarifeForGarage(gid)
    const first = list[0]?.id
    if (!first) return
    const current = getValues('tarif')
    if (!list.some((t) => t.id === current)) {
      setValue('tarif', first, { shouldValidate: true })
    }
  }, [garageWatch, getValues, setValue])

  const onSubmit = handleSubmit(async (data) => {
    setStatus('loading')
    setMessage('')
    setMailSkipped(false)
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
      setMailSkipped(Boolean(json.mailSkipped))
      setStatus('ok')
      setMessage(
        json.mailSkipped
          ? 'Ihre Daten wurden gespeichert. Es konnte keine E-Mail versendet werden (Server-Konfiguration: in Netlify unter „Environment variables“ → Production SMTP oder Resend eintragen, dann neu deployen).'
          : 'Vielen Dank! Ihre Angaben wurden übermittelt.',
      )
      if (companyWebsiteTrapRef.current) companyWebsiteTrapRef.current.value = ''
      reset(defaultValues)
    } catch {
      setStatus('err')
      setMessage('Netzwerkfehler. Bitte später erneut versuchen.')
    }
  })

  return (
    <form className="form" onSubmit={onSubmit} noValidate>
      <p className="lede">
        Anmeldung Dauerparkplatz — Daten werden an{' '}
        <a href="mailto:office@parkhaus-elbl.at">office@parkhaus-elbl.at</a>{' '}
        gesendet und in der Datenbank gespeichert. Kaution {KAUTION_EUR} €.
        Mindestvertragsdauer {MIN_VERTRAG_MONATE} Monate. {KUENDIGUNG_HINWEIS}
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
            {GARAGEN.map((g) => (
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
          <span>Fahrzeug (Marke / Typ) *</span>
          <input type="text" {...register('fahrzeug')} />
          {errors.fahrzeug && (
            <span className="err">{errors.fahrzeug.message}</span>
          )}
        </label>

        <label className="field">
          <span>Kennzeichen *</span>
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
                {t.label} — {t.detail}
              </option>
            ))}
          </select>
          {errors.tarif && <span className="err">{errors.tarif.message}</span>}
        </label>

        <label className="field">
          <span>IBAN (EU) *</span>
          <input
            type="text"
            inputMode="text"
            autoComplete="off"
            placeholder="z. B. AT61 … oder DE89 …"
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
              href={AGB_PDF_URL}
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

      {status === 'ok' && (
        <p className={`banner ${mailSkipped ? 'warn' : 'ok'}`}>{message}</p>
      )}
      {status === 'err' && <p className="banner err">{message}</p>}
    </form>
  )
}
