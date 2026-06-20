'use client'

/**
 * IntakeForm — client component for the /join/[slug] public intake page.
 *
 * Constraint #2 (no Firebase in this tree): this component imports
 * **only** React, lucide-react, and the global stylesheet. It POSTs to
 * /api/join/submit and never touches Firebase directly.
 *
 * Renders:
 *   - Bilingual page header (logo + headshot + business name + tagline + bio)
 *   - Language toggle (initial value from server-detected Accept-Language)
 *   - Intake form with honeypot, soft-required address confirm, consent
 *     checkbox for the thank-you SMS
 *   - Confirmation screen replaces the form on success
 *   - "Call instead" tel: link doubles as the no-JS fallback CTA
 *
 * No-JS fallback: the <form> has native action + method attributes so a
 * client without JS still submits to /api/join/submit. JS uses
 * preventDefault() to intercept and submit via fetch+JSON. The submit
 * route handles both JSON and form-encoded bodies (see C5).
 */

import { useState } from 'react'
import { Leaf, Phone, MessageSquare, BookmarkPlus } from 'lucide-react'

const STRINGS = {
  en: {
    requestService:    'Request service',
    servicesOffered:   'Services we offer',
    serviceArea:       'Service area',
    fullName:          'Full name',
    phone:             'Phone',
    address:           'Service address',
    email:             'Email (optional)',
    serviceInterest:   'Service interest',
    notes:             'Notes (optional)',
    notesPlaceholder:  'Anything we should know? (gate code, days available…)',
    smsConsent:        'Text me updates about my request',
    smsFinePrint:      'Reply STOP to opt out. Msg & data rates may apply.',
    submit:            'Send request',
    sending:           'Sending…',
    callInstead:       'Prefer to call?',
    selectOption:      'Select…',
    required:          'Required',
    optional:          'Optional',
    errNameRequired:   'Please enter your name.',
    errPhoneRequired:  'Please enter a valid phone number.',
    errPhoneInvalid:   "That phone number doesn't look right.",
    errEmailInvalid:   "That email doesn't look right.",
    confirmSkipAddress: "Without an address we can't visit or quote you. Skip anyway?",
    errRateLimited:    'Please try again in a few minutes.',
    errGeneric:        'Something went wrong. Please try again or call us.',
    confirmThanks:     'Thanks! {businessName} will be in touch.',
    confirmSmsSent:    "We've texted a confirmation to your phone.",
    callNow:           'Call now',
    poweredBy:         'Powered by',
    addressPlaceholder: 'Street, City, State ZIP',
    viewFullCard:      'View full card',
    save:              'Save',
    call:              'Call',
    text:              'Text',
  },
  es: {
    requestService:    'Solicitar servicio',
    servicesOffered:   'Servicios que ofrecemos',
    serviceArea:       'Área de servicio',
    fullName:          'Nombre completo',
    phone:             'Teléfono',
    address:           'Dirección de servicio',
    email:             'Correo electrónico (opcional)',
    serviceInterest:   'Servicio de interés',
    notes:             'Notas (opcional)',
    notesPlaceholder:  '¿Algo que debamos saber? (código de puerta, días disponibles…)',
    smsConsent:        'Envíenme mensajes sobre mi solicitud',
    smsFinePrint:      'Responda STOP para cancelar. Pueden aplicarse tarifas de mensajes y datos.',
    submit:            'Enviar solicitud',
    sending:           'Enviando…',
    callInstead:       '¿Prefiere llamar?',
    selectOption:      'Seleccione…',
    required:          'Requerido',
    optional:          'Opcional',
    errNameRequired:   'Por favor ingrese su nombre.',
    errPhoneRequired:  'Por favor ingrese un número de teléfono válido.',
    errPhoneInvalid:   'Ese número de teléfono no parece correcto.',
    errEmailInvalid:   'Ese correo no parece correcto.',
    confirmSkipAddress: 'Sin una dirección no podemos visitarlo ni cotizarle. ¿Omitir de todos modos?',
    errRateLimited:    'Por favor intente de nuevo en unos minutos.',
    errGeneric:        'Algo salió mal. Intente de nuevo o llámenos.',
    confirmThanks:     '¡Gracias! {businessName} se pondrá en contacto.',
    confirmSmsSent:    'Le enviamos una confirmación por mensaje de texto.',
    callNow:           'Llamar ahora',
    poweredBy:         'Con tecnología de',
    addressPlaceholder: 'Calle, Ciudad, Estado CP',
    viewFullCard:      'Ver tarjeta completa',
    save:              'Guardar',
    call:              'Llamar',
    text:              'Mensaje',
  },
}

/**
 * Normalize an arbitrary phone string to E.164 (+1XXXXXXXXXX) — matches
 * the existing PhoneInput logic in app/clients/ClientsContent.js. Strips
 * non-digits, drops a leading 1 if input is 11 digits, validates length
 * is exactly 10 after that, then prepends +1.
 *
 * Returns the normalized string or null if invalid.
 */
function normalizePhone(raw) {
  if (typeof raw !== 'string') return null
  const digits = raw.replace(/\D/g, '')
  // Strip a leading 1 from inputs like "+1 (210) 555-0100" or "1-210-555-0100"
  const local = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits
  if (local.length !== 10) return null
  return `+1${local}`
}

function isValidEmailish(email) {
  if (!email) return true // optional
  // Permissive — server does the final check
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function getInitials(name) {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  return (parts[0]?.[0] || '?').toUpperCase() + (parts[1]?.[0] || '').toUpperCase()
}

export default function IntakeForm({ slug, owner, services, initialLang, backLinkHref }) {
  const [lang, setLang] = useState(initialLang === 'es' ? 'es' : 'en')
  const t = STRINGS[lang]

  const [name,            setName]            = useState('')
  const [phone,           setPhone]           = useState('')
  const [address,         setAddress]         = useState('')
  const [email,           setEmail]           = useState('')
  const [serviceInterest, setServiceInterest] = useState('')
  const [note,            setNote]            = useState('')
  const [smsConsent,      setSmsConsent]      = useState(false)
  const [websiteUrl,      setWebsiteUrl]      = useState('') // honeypot — should stay empty

  const [errors,    setErrors]    = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [submitted,  setSubmitted]  = useState(false)
  const [serverError, setServerError] = useState(null)

  function validateClientSide() {
    const e = {}
    if (!name.trim()) e.name = t.errNameRequired
    if (!phone.trim()) e.phone = t.errPhoneRequired
    else if (!normalizePhone(phone)) e.phone = t.errPhoneInvalid
    if (email && !isValidEmailish(email)) e.email = t.errEmailInvalid
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit(ev) {
    ev?.preventDefault?.()
    if (submitting) return
    if (!validateClientSide()) return

    // Soft-required address — confirm before submitting if empty
    if (!address.trim()) {
      if (!window.confirm(t.confirmSkipAddress)) return
    }

    setSubmitting(true)
    setServerError(null)
    try {
      const normalizedPhone = normalizePhone(phone)
      const res = await fetch('/api/join/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug,
          name:             name.trim(),
          phone:            normalizedPhone,
          email:            email.trim() || undefined,
          address:          address.trim() || undefined,
          serviceInterest:  serviceInterest || undefined,
          note:             note.trim() || undefined,
          language:         lang,
          smsConsent,
          website_url:      websiteUrl, // honeypot — server silently drops if non-empty
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.status === 429) {
        setServerError(t.errRateLimited)
      } else if (!res.ok) {
        setServerError(data?.error || t.errGeneric)
      } else {
        setSubmitted(true)
      }
    } catch {
      setServerError(t.errGeneric)
    } finally {
      setSubmitting(false)
    }
  }

  // ── Confirmation screen ───────────────────────────────────────────────
  if (submitted) {
    return (
      <Page owner={owner} lang={lang} setLang={setLang} t={t} backLinkHref={backLinkHref}>
        <div className="text-center py-8">
          <div className="w-16 h-16 rounded-full bg-green-100 mx-auto mb-4 flex items-center justify-center">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            {t.confirmThanks.replace('{businessName}', owner.businessName)}
          </h2>
          {smsConsent && (
            <p className="text-sm text-gray-600 mb-6">{t.confirmSmsSent}</p>
          )}
          {owner.phone && (
            <a
              href={`tel:${owner.phone.replace(/\D/g, '')}`}
              className="inline-block bg-brand-600 text-white font-semibold px-6 py-3 rounded-xl hover:bg-brand-700 transition-colors"
            >
              📞 {t.callNow}
            </a>
          )}
        </div>
      </Page>
    )
  }

  // ── Form ──────────────────────────────────────────────────────────────
  return (
    <Page owner={owner} lang={lang} setLang={setLang} t={t} backLinkHref={backLinkHref}>
      <h2 className="text-lg font-semibold text-gray-900 mb-4 text-center border-t border-gray-200 pt-6">
        {t.requestService}
      </h2>

      {/* Native form action+method for no-JS fallback; JS hijacks via onSubmit */}
      <form
        action="/api/join/submit"
        method="POST"
        onSubmit={handleSubmit}
        noValidate
        className="space-y-4"
      >
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="language" value={lang} />

        {/* Honeypot — hidden from humans, bots fill all fields they see.
            display:none + tabIndex=-1 + autoComplete=off + aria-hidden so
            assistive tech also skips it. */}
        <div aria-hidden="true" style={{ position: 'absolute', left: '-9999px', height: 0, width: 0, overflow: 'hidden' }}>
          <label>
            Website URL
            <input
              type="text"
              name="website_url"
              tabIndex={-1}
              autoComplete="off"
              value={websiteUrl}
              onChange={e => setWebsiteUrl(e.target.value)}
            />
          </label>
        </div>

        <Field label={`${t.fullName} *`} error={errors.name}>
          <input
            type="text"
            name="name"
            required
            value={name}
            onChange={e => setName(e.target.value)}
            className="form-input"
            autoComplete="name"
            maxLength={80}
          />
        </Field>

        <Field label={`${t.phone} *`} error={errors.phone}>
          <input
            type="tel"
            name="phone"
            required
            inputMode="tel"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            className="form-input"
            autoComplete="tel"
            placeholder="(210) 555-0100"
            maxLength={20}
          />
        </Field>

        <Field label={t.address} error={errors.address}>
          <input
            type="text"
            name="address"
            value={address}
            onChange={e => setAddress(e.target.value)}
            className="form-input"
            autoComplete="street-address"
            placeholder={t.addressPlaceholder}
            maxLength={200}
          />
        </Field>

        <Field label={t.email} error={errors.email}>
          <input
            type="email"
            name="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="form-input"
            autoComplete="email"
            maxLength={120}
          />
        </Field>

        {services?.length > 0 && (
          <Field label={t.serviceInterest}>
            <select
              name="serviceInterest"
              value={serviceInterest}
              onChange={e => setServiceInterest(e.target.value)}
              className="form-input"
            >
              <option value="">{t.selectOption}</option>
              {services.map((s, i) => (
                <option key={i} value={s.label || s.name}>
                  {s.label || s.name}
                </option>
              ))}
            </select>
          </Field>
        )}

        <Field label={t.notes}>
          <textarea
            name="note"
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder={t.notesPlaceholder}
            rows={3}
            maxLength={500}
            className="form-input resize-none"
          />
        </Field>

        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            name="smsConsent"
            checked={smsConsent}
            onChange={e => setSmsConsent(e.target.checked)}
            className="mt-1 w-4 h-4 accent-brand-600"
          />
          <span className="text-sm text-gray-700 flex-1">
            {t.smsConsent}
            <span className="block text-xs text-gray-400 mt-1">{t.smsFinePrint}</span>
          </span>
        </label>

        {serverError && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2.5 text-sm text-red-700">
            {serverError}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-brand-600 text-white font-semibold py-3.5 rounded-xl hover:bg-brand-700 transition-colors disabled:opacity-60"
          style={{ backgroundColor: owner.accentColor }}
        >
          {submitting ? t.sending : t.submit}
        </button>
      </form>

      {/* Call-instead fallback — also the no-JS visible CTA */}
      {owner.phone && (
        <div className="mt-6 text-center text-sm text-gray-600">
          {t.callInstead}{' '}
          <a
            href={`tel:${owner.phone.replace(/\D/g, '')}`}
            className="font-semibold text-brand-600 hover:text-brand-700"
          >
            {owner.phone}
          </a>
        </div>
      )}

      {/* Inline form-input styles — local-only so this page stays
          isolated from the rest of the app's Tailwind setup. */}
      <style jsx>{`
        :global(.form-input) {
          width: 100%;
          border: 1px solid #e5e7eb;
          background: white;
          border-radius: 0.75rem;
          padding: 0.625rem 0.875rem;
          font-size: 14px;
          color: #111827;
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        :global(.form-input:focus) {
          outline: none;
          border-color: ${owner.accentColor};
          box-shadow: 0 0 0 3px ${owner.accentColor}33;
        }
      `}</style>
    </Page>
  )
}

/**
 * Shared page chrome — language toggle, contractor identity block,
 * footer mark. Used by both the form view and the post-submit
 * confirmation view so the two share visual scaffolding.
 */
function Page({ owner, lang, setLang, t, children, backLinkHref }) {
  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header strip with accent color */}
      <div className="h-2" style={{ backgroundColor: owner.accentColor }} />

      <div className="max-w-md mx-auto px-5 py-6">
        {/* Top row: back link (left) + language toggle (right) */}
        <div className={`flex items-center mb-4 ${backLinkHref ? 'justify-between' : 'justify-end'}`}>
          {backLinkHref && (
            <a
              href={backLinkHref}
              className="text-xs font-medium text-gray-500 hover:text-gray-700 inline-flex items-center gap-1"
            >
              ‹ {t.viewFullCard}
            </a>
          )}
          <div className="inline-flex bg-white border border-gray-200 rounded-full p-0.5 text-xs">
            <button
              onClick={() => setLang('en')}
              className={`px-3 py-1 rounded-full font-semibold transition-colors ${
                lang === 'en' ? 'bg-brand-600 text-white' : 'text-gray-500 hover:text-gray-700'
              }`}
              style={lang === 'en' ? { backgroundColor: owner.accentColor } : {}}
              type="button"
            >
              EN
            </button>
            <button
              onClick={() => setLang('es')}
              className={`px-3 py-1 rounded-full font-semibold transition-colors ${
                lang === 'es' ? 'bg-brand-600 text-white' : 'text-gray-500 hover:text-gray-700'
              }`}
              style={lang === 'es' ? { backgroundColor: owner.accentColor } : {}}
              type="button"
            >
              ES
            </button>
          </div>
        </div>

        {/* Identity block */}
        <div className="flex items-center gap-4 mb-4">
          {/* Headshot OR logo OR initials fallback */}
          {owner.headshotURL ? (
            <img
              src={owner.headshotURL}
              alt={owner.businessName}
              className="w-16 h-16 rounded-full object-cover border-2 border-white shadow-md"
            />
          ) : owner.logoURL ? (
            <img
              src={owner.logoURL}
              alt={owner.businessName}
              className="w-16 h-16 rounded-full object-contain bg-white border-2 border-white shadow-md p-1"
            />
          ) : (
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold text-white shadow-md"
              style={{ backgroundColor: owner.accentColor }}
            >
              {getInitials(owner.businessName)}
            </div>
          )}
          {owner.headshotURL && owner.logoURL && (
            <img
              src={owner.logoURL}
              alt=""
              className="w-12 h-12 rounded-lg object-contain bg-white border border-gray-200 p-1"
            />
          )}
        </div>

        {/* Name + tagline + bio + service area */}
        <h1 className="text-2xl font-bold text-gray-900 mb-1">{owner.businessName}</h1>
        {owner.tagline && (
          <p className="text-sm font-medium mb-3" style={{ color: owner.accentColor }}>
            {owner.tagline}
          </p>
        )}
        {owner.bio && (
          <p className="text-sm text-gray-700 mb-3 leading-relaxed whitespace-pre-line">
            {owner.bio}
          </p>
        )}
        {owner.serviceArea && (
          <p className="text-xs text-gray-500 mb-4">
            📍 {t.serviceArea}: {owner.serviceArea}
          </p>
        )}

        {/* Persistent contact row — keeps Call/Text/Save reachable from the
            form page (matches the secondary actions on the card) so a
            prospect who scanned a QR can still call directly. */}
        {(owner.phone || owner.headshotURL) && (
          <div className="flex justify-center gap-2 mb-5">
            <a
              href={`/api/join/${slug}/vcard`}
              className="flex flex-col items-center gap-0.5 bg-white border border-gray-200 rounded-lg px-4 py-2 hover:border-gray-300 transition-colors"
            >
              <BookmarkPlus size={14} className="text-gray-600" />
              <span className="text-[10px] font-medium text-gray-700">{t.save || 'Save'}</span>
            </a>
            {owner.phone && (
              <>
                <a
                  href={`tel:${owner.phone.replace(/\D/g, '')}`}
                  className="flex flex-col items-center gap-0.5 bg-white border border-gray-200 rounded-lg px-4 py-2 hover:border-gray-300 transition-colors"
                >
                  <Phone size={14} className="text-gray-600" />
                  <span className="text-[10px] font-medium text-gray-700">{t.call || 'Call'}</span>
                </a>
                <a
                  href={`sms:${owner.phone.replace(/\D/g, '')}`}
                  className="flex flex-col items-center gap-0.5 bg-white border border-gray-200 rounded-lg px-4 py-2 hover:border-gray-300 transition-colors"
                >
                  <MessageSquare size={14} className="text-gray-600" />
                  <span className="text-[10px] font-medium text-gray-700">{t.text || 'Text'}</span>
                </a>
              </>
            )}
          </div>
        )}

        {children}

        {/* Powered-by mark */}
        <div className="mt-8 pt-6 border-t border-gray-200 flex items-center justify-center gap-1.5 text-xs text-gray-400">
          <Leaf size={12} className="text-brand-600" />
          <span>{t.poweredBy} <strong className="text-brand-600">YardSync</strong></span>
        </div>
      </div>
    </main>
  )
}

/**
 * Field wrapper — label + child input + error message in a consistent
 * vertical stack.
 */
function Field({ label, error, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      {children}
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  )
}
