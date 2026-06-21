/**
 * GET /grow — public "sell YardSync" referral card.
 *
 * A shareable, YardSync-branded pitch card the founder (and anyone they share
 * it with) can hand out to recruit contractors. Scanning/tapping shows this
 * pitch; the primary CTA routes to the homepage to sign up. No Firebase in this
 * route (public marketing page, same constraint as the landing page).
 *
 * The on-card QR encodes the HOMEPAGE — when the founder shows their phone to a
 * prospect in person, scanning routes the prospect straight to YardSync to sign
 * up. The Share/Copy buttons share the /grow card URL (to send the pitch to
 * someone). No referral attribution yet (fast follow-up).
 */

import { headers } from 'next/headers'
import QRCode from 'qrcode'
import GrowContent from './GrowContent'

export const dynamic = 'force-dynamic'

const ACCENT = '#0F6E56'

export const metadata = {
  title: 'YardSync — Run your field-service business from your phone',
  description: 'Bilingual scheduling, Stripe invoicing, and SMS reminders for lawn care and field-service contractors. Get started free.',
}

async function generateQrSvg(text) {
  try {
    return await QRCode.toString(text, {
      type:                 'svg',
      margin:               1,
      width:                200,
      color:                { dark: ACCENT, light: '#ffffff' },
      errorCorrectionLevel: 'M',
    })
  } catch (err) {
    console.error('[grow] QR generation failed:', err.message)
    return null
  }
}

function resolveBaseUrl(headersList) {
  const host = headersList?.get?.('host')
  if (host) {
    const proto = host.includes('localhost') ? 'http' : 'https'
    return `${proto}://${host}`
  }
  return (process.env.NEXT_PUBLIC_APP_URL || 'https://yardsyncapp.com').replace(/\/$/, '')
}

export default async function GrowPage() {
  const headersList = await headers()
  const baseUrl     = resolveBaseUrl(headersList)
  const growUrl     = `${baseUrl}/grow`
  const homeUrl     = `${baseUrl}/`
  const acceptLang  = (headersList.get('accept-language') || '').toLowerCase()
  const initialLang = acceptLang.startsWith('es') ? 'es' : 'en'
  // QR routes a scanning prospect straight to YardSync (homepage), not back to
  // this card. Share/Copy still hand out the /grow card URL.
  const qrSvg       = await generateQrSvg(homeUrl)

  return (
    <GrowContent
      qrSvg={qrSvg}
      growUrl={growUrl}
      homeUrl={homeUrl}
      initialLang={initialLang}
    />
  )
}
