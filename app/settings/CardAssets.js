'use client'

/**
 * Download buttons for the YardSync card's marketing assets, shown in
 * Settings → Card tab beneath the live preview. Composes everything client-
 * side via lib/cardTemplate.js:
 *   - QR code (PNG)   — encodes the card URL so clients scan → request service
 *   - Social post     — 1080×1080 image for feeds
 *   - Social story    — 1080×1920 image for stories/status (WhatsApp/IG)
 *
 * Reflects the current (possibly unsaved) form state, matching the live
 * CardPreview tile above it.
 */

import { useState } from 'react'
import { QrCode, Image as ImageIcon, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import {
  loadImage, qrPngDataUrl, composeSocial, downloadCanvas, downloadDataUrl, fileStem,
} from '@/lib/cardTemplate'

export default function CardAssets({
  businessName, tagline, accentColor, logoUrl, headshotUrl,
  cardStatusBadge, offersFreeEstimate, cardUrl, cardUrlLabel, lang,
}) {
  const [busy, setBusy] = useState(null) // 'qr' | 'post' | 'story'
  const accent = accentColor || '#0F6E56'

  async function buildData() {
    const [logoImg, headshotImg] = await Promise.all([loadImage(logoUrl), loadImage(headshotUrl)])
    return {
      businessName, tagline, accentColor: accent, logoImg, headshotImg,
      cardStatusBadge, offersFreeEstimate, cardUrlLabel,
    }
  }

  async function handleQr() {
    setBusy('qr')
    try {
      const dataUrl = await qrPngDataUrl(cardUrl, { size: 1024, color: accent })
      downloadDataUrl(dataUrl, `${fileStem(businessName)}-qr.png`)
    } catch (e) {
      console.error('QR generation failed:', e)
      toast.error(lang === 'es' ? 'No se pudo generar el QR' : 'Could not generate the QR')
    } finally { setBusy(null) }
  }

  async function handleSocial(kind) {
    setBusy(kind)
    try {
      const data = await buildData()
      const canvas = document.createElement('canvas')
      const dims = kind === 'story' ? { width: 1080, height: 1920 } : { width: 1080, height: 1080 }
      await composeSocial(canvas, { ...dims, data, qrUrl: cardUrl, lang })
      downloadCanvas(canvas, `${fileStem(businessName)}-${kind}.png`)
    } catch (e) {
      console.error('Social image generation failed:', e)
      toast.error(lang === 'es' ? 'No se pudo generar la imagen' : 'Could not generate the image')
    } finally { setBusy(null) }
  }

  const Btn = ({ id, icon: Icon, label, onClick }) => (
    <button
      type="button"
      onClick={onClick}
      disabled={busy !== null}
      className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-[13px] font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60 transition-colors"
    >
      {busy === id ? <Loader2 size={15} className="animate-spin text-brand-600" /> : <Icon size={15} className="text-brand-600" />}
      {label}
    </button>
  )

  return (
    <div className="pt-3 border-t border-gray-100">
      <p className="text-[11px] text-gray-500 mb-2">
        {lang === 'es' ? 'Descargar para compartir o imprimir' : 'Download to share or print'}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <Btn id="qr"    icon={QrCode}    label={lang === 'es' ? 'Código QR (PNG)'   : 'QR code (PNG)'} onClick={handleQr} />
        <Btn id="post"  icon={ImageIcon} label={lang === 'es' ? 'Imagen para redes' : 'Social post'}  onClick={() => handleSocial('post')} />
        <Btn id="story" icon={ImageIcon} label={lang === 'es' ? 'Historia'          : 'Social story'} onClick={() => handleSocial('story')} />
      </div>
      <p className="text-[10px] text-gray-400 mt-1.5">
        {lang === 'es'
          ? 'El código QR abre su tarjeta para que los clientes soliciten servicio.'
          : 'The QR opens your card so clients can request service.'}
      </p>
    </div>
  )
}
