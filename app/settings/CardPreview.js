'use client'

/**
 * CardPreview — live tile in Settings showing what /join/{slug} looks
 * like as the contractor edits their card fields.
 *
 * Reads everything from props (the parent Settings page's form state)
 * — no Firestore reads, no Firebase imports. Mirrors the composition
 * order of app/join/[slug]/CardActions.js so "what you see here = what
 * prospects see," scaled down to a 280px-wide tile.
 *
 * The QR is rendered as a static placeholder (a stylized SVG). The real
 * QR is server-generated on /join/{slug} — "Open full card" goes there.
 */

import { Leaf, Phone, MessageSquare, BookmarkPlus, ArrowRight, ExternalLink } from 'lucide-react'

const DEFAULT_ACCENT = '#0F6E56'

function getInitials(name) {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  return (parts[0]?.[0] || '?').toUpperCase() + (parts[1]?.[0] || '').toUpperCase()
}

function PlaceholderQR({ color = '#111827' }) {
  // Stylized QR-ish mosaic — not a real scannable code; conveys "there will
  // be a QR here." The actual QR lives on the public /join/[slug] page.
  return (
    <svg viewBox="0 0 60 60" width="60" height="60" aria-hidden="true">
      <rect width="60" height="60" fill="white" />
      {/* Three position markers */}
      <rect x="4"  y="4"  width="14" height="14" fill={color} />
      <rect x="7"  y="7"  width="8"  height="8"  fill="white" />
      <rect x="9"  y="9"  width="4"  height="4"  fill={color} />
      <rect x="42" y="4"  width="14" height="14" fill={color} />
      <rect x="45" y="7"  width="8"  height="8"  fill="white" />
      <rect x="47" y="9"  width="4"  height="4"  fill={color} />
      <rect x="4"  y="42" width="14" height="14" fill={color} />
      <rect x="7"  y="45" width="8"  height="8"  fill="white" />
      <rect x="9"  y="47" width="4"  height="4"  fill={color} />
      {/* Data-ish dots */}
      <rect x="22" y="6"  width="3" height="3" fill={color} />
      <rect x="28" y="6"  width="3" height="3" fill={color} />
      <rect x="34" y="6"  width="3" height="3" fill={color} />
      <rect x="22" y="12" width="3" height="3" fill={color} />
      <rect x="34" y="12" width="3" height="3" fill={color} />
      <rect x="6"  y="22" width="3" height="3" fill={color} />
      <rect x="12" y="22" width="3" height="3" fill={color} />
      <rect x="22" y="22" width="3" height="3" fill={color} />
      <rect x="28" y="22" width="3" height="3" fill={color} />
      <rect x="34" y="22" width="3" height="3" fill={color} />
      <rect x="40" y="22" width="3" height="3" fill={color} />
      <rect x="46" y="22" width="3" height="3" fill={color} />
      <rect x="22" y="28" width="3" height="3" fill={color} />
      <rect x="28" y="28" width="3" height="3" fill={color} />
      <rect x="34" y="28" width="3" height="3" fill={color} />
      <rect x="22" y="34" width="3" height="3" fill={color} />
      <rect x="40" y="34" width="3" height="3" fill={color} />
      <rect x="46" y="34" width="3" height="3" fill={color} />
      <rect x="22" y="40" width="3" height="3" fill={color} />
      <rect x="28" y="40" width="3" height="3" fill={color} />
      <rect x="34" y="40" width="3" height="3" fill={color} />
      <rect x="40" y="40" width="3" height="3" fill={color} />
      <rect x="22" y="46" width="3" height="3" fill={color} />
      <rect x="34" y="46" width="3" height="3" fill={color} />
      <rect x="40" y="46" width="3" height="3" fill={color} />
      <rect x="46" y="46" width="3" height="3" fill={color} />
    </svg>
  )
}

/**
 * @param {object} p
 * @param {string} p.businessName
 * @param {string} p.tagline
 * @param {string} p.bio
 * @param {string} p.serviceArea
 * @param {string} p.logoUrl
 * @param {string} p.accentColor
 * @param {boolean} p.showContactPhone
 * @param {boolean} p.showContactEmail
 * @param {string} p.cardStatusBadge      'booking' | 'none'
 * @param {string} p.publicSlug           (optional — enables "Open full card")
 * @param {string} p.lang                 'en' | 'es'
 */
export default function CardPreview({
  businessName,
  tagline,
  bio,
  serviceArea,
  logoUrl,
  headshotUrl,
  accentColor,
  phone,
  email,
  showContactPhone,
  showContactEmail,
  cardStatusBadge,
  offersFreeEstimate,
  publicSlug,
  lang = 'en',
}) {
  const accent       = accentColor || DEFAULT_ACCENT
  // Mirror the real card's gating: actions appear only when both the
  // visibility toggle is on AND the underlying contact channel exists.
  // (The real card hides Call/Text whenever phone is missing, regardless
  // of the toggle — preview must match so it isn't misleading.)
  const showCall     = !!(showContactPhone && phone)
  const showEmailBtn = !!(showContactEmail && email)
  const showBadge    = cardStatusBadge === 'booking'
  const showFreeEstimate = offersFreeEstimate === true
  const T = lang === 'es'
    ? {
        requestService: 'Solicitar servicio',
        save:           'Guardar',
        call:           'Llamar',
        text:           'Mensaje',
        nowBooking:     'Reservando ahora',
        freeEstimate:   'Estimado gratis',
        poweredBy:      'Con tecnología de',
        scanToRequest:  'Escanee para solicitar',
        openFullCard:   'Abrir tarjeta completa',
        liveHint:       'Se actualiza mientras editas — no es necesario guardar',
        previewLabel:   'Vista previa',
      }
    : {
        requestService: 'Request service',
        save:           'Save',
        call:           'Call',
        text:           'Text',
        nowBooking:     'Now booking',
        freeEstimate:   'Free estimate',
        poweredBy:      'Powered by',
        scanToRequest:  'Scan to request',
        openFullCard:   'Open full card',
        liveHint:       'Updates live as you edit — no save needed',
        previewLabel:   'Preview',
      }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">
          {T.previewLabel}
        </span>
        {publicSlug && (
          <a
            href={`/join/${publicSlug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] font-medium text-brand-600 hover:text-brand-700 inline-flex items-center gap-1"
          >
            {T.openFullCard} <ExternalLink size={11} />
          </a>
        )}
      </div>

      {/* The card tile itself — bounded width on desktop, full-width on mobile */}
      <div className="mx-auto w-full max-w-[280px] rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-sm">
        {/* Accent header strip */}
        <div className="h-1.5" style={{ backgroundColor: accent }} />

        <div className="px-4 py-4 flex flex-col items-center">
          {/* Avatar — mirror the real card: headshot preferred, then logo, then initials */}
          {headshotUrl ? (
            <img
              src={headshotUrl}
              alt=""
              className="w-16 h-16 rounded-full object-cover border-2 border-white shadow-md"
            />
          ) : logoUrl ? (
            <img
              src={logoUrl}
              alt=""
              className="w-16 h-16 rounded-full object-contain bg-white border-2 border-white shadow-md p-1"
            />
          ) : (
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center text-lg font-bold text-white shadow-md"
              style={{ backgroundColor: accent }}
            >
              {getInitials(businessName)}
            </div>
          )}

          {/* When both exist, the logo rides as a small badge under the headshot
              (mirrors the real /join card + the downloadable assets). */}
          {headshotUrl && logoUrl && (
            <img
              src={logoUrl}
              alt=""
              className="mt-1.5 w-9 h-9 rounded-md object-contain bg-white border border-gray-200 p-1 shadow-sm"
            />
          )}

          {/* Name + tagline */}
          <h3
            className="mt-2 text-[15px] font-bold text-gray-900 text-center leading-tight"
            style={{ fontFamily: 'var(--font-dm-serif), "DM Serif Display", serif' }}
          >
            {businessName || (lang === 'es' ? 'Tu negocio' : 'Your business')}
          </h3>
          {tagline && (
            <p className="text-[11px] text-center mt-0.5" style={{ color: accent }}>
              {tagline}
            </p>
          )}

          {/* Status badges */}
          {(showBadge || showFreeEstimate) && (
            <div className="mt-2 flex flex-wrap justify-center gap-1.5">
              {showBadge && (
                <span
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-semibold uppercase tracking-wide text-white"
                  style={{ backgroundColor: accent }}
                >
                  <span className="w-1 h-1 rounded-full bg-white" />
                  {T.nowBooking}
                </span>
              )}
              {showFreeEstimate && (
                <span
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-semibold uppercase tracking-wide bg-white border"
                  style={{ color: accent, borderColor: accent }}
                >
                  🎁 {T.freeEstimate}
                </span>
              )}
            </div>
          )}

          {/* Bio */}
          {bio && (
            <p className="mt-3 text-[11px] text-gray-700 text-center leading-relaxed line-clamp-3">
              {bio}
            </p>
          )}

          {/* Service area */}
          {serviceArea && (
            <p className="mt-2 text-[10px] text-gray-500 text-center">📍 {serviceArea}</p>
          )}

          {/* Primary CTA */}
          <div
            className="mt-3 w-full flex items-center justify-center gap-1.5 text-white text-[11px] font-semibold py-2 rounded-lg"
            style={{ backgroundColor: accent }}
          >
            {T.requestService} <ArrowRight size={12} />
          </div>

          {/* Secondary actions */}
          <div className="mt-2 w-full flex gap-1.5">
            <div className="flex-1 flex flex-col items-center gap-0.5 bg-gray-50 border border-gray-200 rounded-md py-1.5">
              <BookmarkPlus size={12} className="text-gray-600" />
              <span className="text-[9px] font-medium text-gray-700">{T.save}</span>
            </div>
            {showCall && (
              <>
                <div className="flex-1 flex flex-col items-center gap-0.5 bg-gray-50 border border-gray-200 rounded-md py-1.5">
                  <Phone size={12} className="text-gray-600" />
                  <span className="text-[9px] font-medium text-gray-700">{T.call}</span>
                </div>
                <div className="flex-1 flex flex-col items-center gap-0.5 bg-gray-50 border border-gray-200 rounded-md py-1.5">
                  <MessageSquare size={12} className="text-gray-600" />
                  <span className="text-[9px] font-medium text-gray-700">{T.text}</span>
                </div>
              </>
            )}
            {showEmailBtn && (
              <div className="flex-1 flex flex-col items-center gap-0.5 bg-gray-50 border border-gray-200 rounded-md py-1.5">
                <MessageSquare size={12} className="text-gray-600" />
                <span className="text-[9px] font-medium text-gray-700">@</span>
              </div>
            )}
          </div>

          {/* QR placeholder */}
          <div className="mt-4 p-2 bg-white border border-gray-200 rounded-lg">
            <PlaceholderQR color={accent} />
          </div>
          <p className="mt-1 text-[9px] text-gray-400">{T.scanToRequest}</p>

          {/* Footer */}
          <div className="mt-3 pt-2 border-t border-gray-100 w-full flex items-center justify-center gap-1 text-[9px] text-gray-400">
            <Leaf size={9} className="text-brand-600" />
            <span>{T.poweredBy} <span className="font-semibold text-brand-600">YardSync</span></span>
          </div>
        </div>
      </div>

      <p className="text-[10px] text-gray-400 text-center">{T.liveHint}</p>
    </div>
  )
}
