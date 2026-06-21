'use client'

/**
 * GrowContent — client view for the /grow referral card.
 *
 * Imports only React + lucide-react (no Firebase). Renders a YardSync-branded
 * pitch with a primary CTA to the homepage, a Share/Copy row, and the
 * server-rendered QR. Bilingual EN/ES toggle.
 */

import { useState } from 'react'
import { Leaf, Share2, Copy, Calendar, MessageSquare, CreditCard, QrCode, Check } from 'lucide-react'

const STRINGS = {
  en: {
    sharedBy:     'Shared by a YardSync partner',
    headline:     'Run your whole field-service business from your phone',
    sub:          'Schedule jobs, send Stripe invoices, get paid, and text bilingual reminders — built for lawn care, landscaping, pressure washing, and more.',
    p1:           'Bilingual app & text reminders — English and Spanish',
    p2:           '$39/mo — or earn it free as your invoice volume grows',
    p3:           '5.5% per invoice. No quarterly bills, no hidden fees.',
    p4:           'Your own free digital business card with a QR code',
    cta:          'Get started free',
    scan:         'Scan to get started with YardSync',
    copy:         'Copy link',
    copied:       'Copied',
    share:        'Share',
    poweredBy:    'Powered by',
  },
  es: {
    sharedBy:     'Compartido por un socio de YardSync',
    headline:     'Maneje todo su negocio de servicios desde su teléfono',
    sub:          'Programe trabajos, envíe facturas con Stripe, reciba pagos y mande recordatorios bilingües por mensaje — para jardinería, paisajismo, lavado a presión y más.',
    p1:           'App y recordatorios por mensaje bilingües — inglés y español',
    p2:           '$39/mes — o gánelo gratis al crecer su volumen de facturas',
    p3:           '5.5% por factura. Sin cobros trimestrales ni cargos ocultos.',
    p4:           'Su propia tarjeta de presentación digital gratis con código QR',
    cta:          'Empieza gratis',
    scan:         'Escanee para empezar con YardSync',
    copy:         'Copiar enlace',
    copied:       'Copiado',
    share:        'Compartir',
    poweredBy:    'Con tecnología de',
  },
}

function getInitials(name) {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean)
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || '★'
}

export default function GrowContent({ qrSvg, growUrl, homeUrl, initialLang, founder }) {
  const [lang, setLang]     = useState(initialLang === 'es' ? 'es' : 'en')
  const [copied, setCopied] = useState(false)
  const t = STRINGS[lang]

  async function handleShare() {
    const shareData = {
      title: 'YardSync',
      text: lang === 'es'
        ? 'YardSync — maneje su negocio de servicios desde su teléfono:'
        : 'YardSync — run your field-service business from your phone:',
      url: growUrl,
    }
    try {
      if (navigator.share) await navigator.share(shareData)
      else handleCopy()
    } catch { /* user cancelled the share sheet */ }
  }

  function handleCopy() {
    navigator.clipboard.writeText(growUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  const points = [
    { icon: MessageSquare, text: t.p1 },
    { icon: CreditCard,    text: t.p3 },
    { icon: Calendar,      text: t.p2 },
    { icon: QrCode,        text: t.p4 },
  ]

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="h-2 bg-brand-600" />

      <div className="max-w-md mx-auto px-5 py-6">
        {/* Top row: brand + language toggle */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-1.5 font-bold text-brand-700">
            <Leaf size={18} className="text-brand-600" />
            <span className="text-[17px]">YardSync</span>
          </div>
          <div className="inline-flex bg-white border border-gray-200 rounded-full p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setLang('en')}
              className={`px-3 py-1 rounded-full font-semibold transition-colors ${lang === 'en' ? 'bg-brand-600 text-white' : 'text-gray-500 hover:text-gray-700'}`}
            >EN</button>
            <button
              type="button"
              onClick={() => setLang('es')}
              className={`px-3 py-1 rounded-full font-semibold transition-colors ${lang === 'es' ? 'bg-brand-600 text-white' : 'text-gray-500 hover:text-gray-700'}`}
            >ES</button>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          {/* Founder identity block — only when set + toggled on in admin */}
          {founder ? (
            <div className="flex items-center gap-3 mb-4">
              {founder.headshot ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={founder.headshot} alt={founder.name || 'Founder'} className="w-14 h-14 rounded-full object-cover border-2 border-white shadow-md flex-shrink-0" />
              ) : founder.name ? (
                <div className="w-14 h-14 rounded-full bg-brand-600 text-white flex items-center justify-center text-lg font-bold flex-shrink-0">{getInitials(founder.name)}</div>
              ) : null}
              <div className="min-w-0">
                {founder.name && <p className="text-[15px] font-bold text-gray-900 leading-tight truncate">{founder.name}</p>}
                {founder.title && <p className="text-[12px] text-brand-600 font-medium truncate">{founder.title}</p>}
                <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mt-0.5">{t.sharedBy}</p>
              </div>
            </div>
          ) : (
            <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-600 mb-2">{t.sharedBy}</p>
          )}
          <h1 className="text-2xl font-bold text-gray-900 leading-tight mb-2">{t.headline}</h1>
          <p className="text-sm text-gray-600 leading-relaxed mb-5">{t.sub}</p>

          <ul className="space-y-2.5 mb-6">
            {points.map(({ icon: Icon, text }, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <Icon size={16} className="text-brand-600 flex-shrink-0 mt-0.5" />
                <span className="text-[13px] text-gray-700 leading-snug">{text}</span>
              </li>
            ))}
          </ul>

          <a
            href={homeUrl}
            className="block w-full text-center bg-brand-600 text-white font-semibold py-3.5 rounded-xl hover:bg-brand-700 transition-colors"
          >
            {t.cta} →
          </a>

          {/* Share / copy */}
          <div className="flex justify-center gap-2 mt-4">
            <button
              type="button"
              onClick={handleShare}
              className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-lg px-4 py-2 hover:border-gray-300 transition-colors text-[12px] font-medium text-gray-700"
            >
              <Share2 size={14} className="text-gray-600" /> {t.share}
            </button>
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-lg px-4 py-2 hover:border-gray-300 transition-colors text-[12px] font-medium text-gray-700"
            >
              {copied ? <Check size={14} className="text-brand-600" /> : <Copy size={14} className="text-gray-600" />}
              {copied ? t.copied : t.copy}
            </button>
          </div>

          {/* QR — encodes the homepage (scan routes the prospect to YardSync).
              The svg arrives sized 200px; force it to fit the container so it
              doesn't overflow onto the caption below. */}
          {qrSvg && (
            <div className="mt-6 pt-5 border-t border-gray-100 flex flex-col items-center">
              <div className="w-44 [&>svg]:block [&>svg]:w-full [&>svg]:h-auto" dangerouslySetInnerHTML={{ __html: qrSvg }} />
              <p className="text-[11px] text-gray-400 mt-3 text-center">{t.scan}</p>
            </div>
          )}
        </div>

        {/* Powered-by mark */}
        <div className="mt-6 flex items-center justify-center gap-1.5 text-xs text-gray-400">
          <Leaf size={12} className="text-brand-600" />
          <span>{t.poweredBy} <strong className="text-brand-600">YardSync</strong></span>
        </div>
      </div>
    </main>
  )
}
