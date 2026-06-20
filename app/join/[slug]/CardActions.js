'use client'

/**
 * CardActions — client component for the /join/[slug] digital business card.
 *
 * Renders the whole card (hero, bio, contact line, primary CTA, secondary
 * icon row, QR, footer). Server-side `page.js` fetches the data and the
 * server-rendered QR SVG, and passes them in as props.
 *
 * Constraint #2 (no Firebase in this tree): this component imports only
 * React + lucide-react. No Firebase Client SDK, no AuthContext. The
 * "Save contact" button is a plain anchor to /api/join/[slug]/vcard
 * (server route) — works without client JS.
 */

import { useState } from 'react'
import { Leaf, Phone, MessageSquare, BookmarkPlus, ArrowRight } from 'lucide-react'

const STRINGS = {
  en: {
    requestService:    'Request service',
    saveContact:       'Save',
    call:              'Call',
    text:              'Text',
    scanToRequest:     'Scan to request service',
    nowBooking:        'Now booking',
    poweredBy:         'Powered by',
    serviceAreaLabel:  'Service area',
    servicesLabel:     'Services',
  },
  es: {
    requestService:    'Solicitar servicio',
    saveContact:       'Guardar',
    call:              'Llamar',
    text:              'Mensaje',
    scanToRequest:     'Escanee para solicitar servicio',
    nowBooking:        'Reservando ahora',
    poweredBy:         'Con tecnología de',
    serviceAreaLabel:  'Área de servicio',
    servicesLabel:     'Servicios',
  },
}

function getInitials(name) {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  return (parts[0]?.[0] || '?').toUpperCase() + (parts[1]?.[0] || '').toUpperCase()
}

function stripPhone(p) {
  return (p || '').replace(/\D/g, '')
}

export default function CardActions({ slug, owner, services, qrSvg, initialLang }) {
  const [lang, setLang] = useState(initialLang === 'es' ? 'es' : 'en')
  const t = STRINGS[lang]

  const accent     = owner.accentColor || '#0F6E56'
  const showPhone  = owner.showContactPhone !== false && !!owner.phone
  const showEmail  = owner.showContactEmail === true && !!owner.email
  const showBadge  = owner.cardStatusBadge !== 'none'
  const phoneDigits = stripPhone(owner.phone)
  const servicesList = (services || [])
    .map(s => s.label || s.name)
    .filter(Boolean)
    .slice(0, 4)
    .join(' · ')

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="h-2" style={{ backgroundColor: accent }} />

      <div className="max-w-md mx-auto px-5 py-6">
        {/* ── Language toggle (top-right) ────────────────────────────── */}
        <div className="flex justify-end mb-6">
          <div className="inline-flex bg-white border border-gray-200 rounded-full p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setLang('en')}
              className={`px-3 py-1 rounded-full font-semibold transition-colors ${
                lang === 'en' ? 'text-white' : 'text-gray-500 hover:text-gray-700'
              }`}
              style={lang === 'en' ? { backgroundColor: accent } : {}}
            >
              EN
            </button>
            <button
              type="button"
              onClick={() => setLang('es')}
              className={`px-3 py-1 rounded-full font-semibold transition-colors ${
                lang === 'es' ? 'text-white' : 'text-gray-500 hover:text-gray-700'
              }`}
              style={lang === 'es' ? { backgroundColor: accent } : {}}
            >
              ES
            </button>
          </div>
        </div>

        {/* ── Hero (avatar + logo) ─────────────────────────────────────── */}
        <div className="flex flex-col items-center mb-4">
          {owner.headshotURL ? (
            <img
              src={owner.headshotURL}
              alt={owner.businessName}
              className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-lg"
            />
          ) : owner.logoURL ? (
            <img
              src={owner.logoURL}
              alt={owner.businessName}
              className="w-24 h-24 rounded-full object-contain bg-white border-4 border-white shadow-lg p-2"
            />
          ) : (
            <div
              className="w-24 h-24 rounded-full flex items-center justify-center text-3xl font-bold text-white shadow-lg"
              style={{ backgroundColor: accent }}
            >
              {getInitials(owner.businessName)}
            </div>
          )}
          {owner.headshotURL && owner.logoURL && (
            <img
              src={owner.logoURL}
              alt=""
              className="mt-2 w-14 h-14 rounded-lg object-contain bg-white border border-gray-200 p-1.5 shadow-sm"
            />
          )}
        </div>

        {/* ── Business name + tagline ─────────────────────────────────── */}
        <h1
          className="text-3xl font-bold text-gray-900 text-center mb-1"
          style={{ fontFamily: 'var(--font-dm-serif), "DM Serif Display", serif' }}
        >
          {owner.businessName}
        </h1>
        {owner.tagline && (
          <p className="text-sm text-center mb-4" style={{ color: accent }}>
            {owner.tagline}
          </p>
        )}

        {/* ── Status badge ─────────────────────────────────────────────── */}
        {showBadge && (
          <div className="flex justify-center mb-4">
            <span
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wide text-white"
              style={{ backgroundColor: accent }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              {t.nowBooking}
            </span>
          </div>
        )}

        {/* ── Bio ──────────────────────────────────────────────────────── */}
        {owner.bio && (
          <p className="text-sm text-gray-700 text-center mb-5 leading-relaxed whitespace-pre-line">
            {owner.bio}
          </p>
        )}

        {/* ── Service area + services line ─────────────────────────────── */}
        {(owner.serviceArea || servicesList) && (
          <div className="space-y-1.5 mb-6 text-center">
            {owner.serviceArea && (
              <p className="text-xs text-gray-500">📍 {owner.serviceArea}</p>
            )}
            {servicesList && (
              <p className="text-xs text-gray-500">🍃 {servicesList}</p>
            )}
          </div>
        )}

        {/* ── Primary CTA: Request service ─────────────────────────────── */}
        <a
          href={`/join/${slug}/request`}
          className="flex items-center justify-center gap-2 w-full text-white font-semibold py-3.5 rounded-xl hover:opacity-90 transition-opacity shadow-md"
          style={{ backgroundColor: accent }}
        >
          {t.requestService} <ArrowRight size={18} />
        </a>

        {/* ── Secondary icon row ──────────────────────────────────────── */}
        <div className="flex justify-center gap-2 mt-4">
          <a
            href={`/api/join/${slug}/vcard`}
            className="flex-1 flex flex-col items-center gap-1 bg-white border border-gray-200 rounded-xl py-3 hover:border-gray-300 transition-colors"
          >
            <BookmarkPlus size={18} className="text-gray-600" />
            <span className="text-[11px] font-medium text-gray-700">{t.saveContact}</span>
          </a>
          {showPhone && (
            <>
              <a
                href={`tel:${phoneDigits}`}
                className="flex-1 flex flex-col items-center gap-1 bg-white border border-gray-200 rounded-xl py-3 hover:border-gray-300 transition-colors"
              >
                <Phone size={18} className="text-gray-600" />
                <span className="text-[11px] font-medium text-gray-700">{t.call}</span>
              </a>
              <a
                href={`sms:${phoneDigits}`}
                className="flex-1 flex flex-col items-center gap-1 bg-white border border-gray-200 rounded-xl py-3 hover:border-gray-300 transition-colors"
              >
                <MessageSquare size={18} className="text-gray-600" />
                <span className="text-[11px] font-medium text-gray-700">{t.text}</span>
              </a>
            </>
          )}
          {showEmail && (
            <a
              href={`mailto:${owner.email}`}
              className="flex-1 flex flex-col items-center gap-1 bg-white border border-gray-200 rounded-xl py-3 hover:border-gray-300 transition-colors"
            >
              <MessageSquare size={18} className="text-gray-600" />
              <span className="text-[11px] font-medium text-gray-700">Email</span>
            </a>
          )}
        </div>

        {/* ── QR code ──────────────────────────────────────────────────── */}
        {qrSvg && (
          <div className="mt-8 flex flex-col items-center">
            <div
              className="bg-white p-3 rounded-2xl shadow-sm border border-gray-200"
              dangerouslySetInnerHTML={{ __html: qrSvg }}
            />
            <p className="mt-2 text-xs text-gray-500">{t.scanToRequest}</p>
          </div>
        )}

        {/* ── Footer mark ─────────────────────────────────────────────── */}
        <div className="mt-8 pt-6 border-t border-gray-200 flex items-center justify-center gap-1.5 text-xs text-gray-400">
          <Leaf size={12} className="text-brand-600" />
          <span>
            {t.poweredBy}{' '}
            <a href="https://yardsyncapp.com" className="font-semibold text-brand-600 hover:text-brand-700">
              YardSync
            </a>
          </span>
        </div>
      </div>
    </main>
  )
}
