/**
 * GET /join/[slug] — public digital business card (rev 3, card-first).
 *
 * Server component. **No Firebase client SDK** in this tree (constraint
 * #2 in docs/SMART_BUSINESS_CARD_SPEC.md). All Firestore reads happen
 * via lib/firestoreRest.js; the CardActions client component imports
 * no Firebase — it only renders the card view and fetches the vCard
 * route as a plain anchor.
 *
 * The intake form lives at /join/[slug]/request — both the primary
 * "Request service" CTA and the on-card QR code point there.
 *
 * Flow:
 *  1. Resolve slugs/{slug} → ownerUid (or render "card not active" page)
 *  2. If old slug with live redirect window → 301 to current slug
 *  3. Fetch owner profile + service packages
 *  4. Detect language from Accept-Language; pass as initialLang
 *  5. Server-render a QR SVG encoding /join/{slug}/request (works no-JS)
 *  6. Render CardActions with all of the above
 *
 * No payment/Connect gating — the card is live the moment a slug exists.
 */

import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import QRCode from 'qrcode'
import { getDocument, listCollection } from '@/lib/firestoreRest'
import { isVerifiedBusiness } from '@/lib/verifiedBadge'
import CardActions from './CardActions'

export const dynamic = 'force-dynamic'

const DEFAULT_ACCENT = '#0F6E56'

async function generateQrSvg(text, color) {
  try {
    return await QRCode.toString(text, {
      type:                  'svg',
      margin:                1,
      width:                 200,
      color:                 { dark: color, light: '#ffffff' },
      errorCorrectionLevel:  'M',
    })
  } catch (err) {
    console.error('[join/page] QR generation failed:', err.message)
    return null
  }
}

function resolveBaseUrl(headersList) {
  // Use the inbound request's host so a QR rendered on a Preview deploy
  // encodes the Preview URL — otherwise the QR would lead to production
  // where the slug/route doesn't exist yet.
  const host = headersList?.get?.('host')
  if (host) {
    const proto = host.includes('localhost') ? 'http' : 'https'
    return `${proto}://${host}`
  }
  return (process.env.NEXT_PUBLIC_APP_URL || 'https://yardsyncapp.com').replace(/\/$/, '')
}

export async function generateMetadata({ params }) {
  const { slug } = await params
  if (!slug || typeof slug !== 'string') return { title: 'YardSync' }

  try {
    const slugDoc = await getDocument('slugs', slug)
    if (!slugDoc?.data?.active) return { title: 'YardSync' }
    const ownerDoc = await getDocument('users', slugDoc.data.ownerUid)
    if (!ownerDoc?.data?.businessName) return { title: 'YardSync' }
    return {
      title:       `${ownerDoc.data.businessName} · YardSync`,
      description: ownerDoc.data.tagline || ownerDoc.data.bio || 'Request service from this provider.',
    }
  } catch {
    return { title: 'YardSync' }
  }
}

export default async function CardPage({ params }) {
  const { slug } = await params

  const slugDoc = await getDocument('slugs', slug)
  if (!slugDoc) return <CardNotActive />

  if (slugDoc.data.active === false) {
    const redirectTo = slugDoc.data.redirectTo
    const expiresAt  = slugDoc.data.expiresAt
    if (redirectTo && expiresAt && new Date(expiresAt) > new Date()) {
      redirect(`/join/${redirectTo}`)
    }
    return <CardNotActive />
  }

  const ownerUid = slugDoc.data.ownerUid
  if (!ownerUid) return <CardNotActive />

  const ownerDoc = await getDocument('users', ownerUid)
  if (!ownerDoc?.data) return <CardNotActive />

  const owner = ownerDoc.data

  let services = []
  try {
    const res = await listCollection('services', {
      where: [{ field: 'gardenerUid', op: 'EQUAL', value: ownerUid }],
      limit: 20,
    })
    services = res
      .map(d => d.data)
      .filter(s => s.label || s.name)
  } catch (err) {
    console.error('[join/page] services fetch failed:', err.message)
  }

  const headersList = await headers()
  const acceptLang  = (headersList.get('accept-language') || '').toLowerCase()
  const initialLang = acceptLang.startsWith('es') ? 'es' : 'en'

  const accentColor = owner.accentColor || DEFAULT_ACCENT
  const baseUrl     = resolveBaseUrl(headersList)
  const requestUrl  = `${baseUrl}/join/${slug}/request`
  const qrSvg       = await generateQrSvg(requestUrl, accentColor)

  return (
    <CardActions
      slug={slug}
      owner={{
        businessName:      owner.businessName     || 'Service Provider',
        tagline:           owner.tagline          || '',
        bio:               owner.bio              || '',
        serviceArea:       owner.serviceArea      || '',
        // Profile saves these lowercase (logoUrl / headshotUrl); read both
        // casings so logos/headshots saved via Settings actually render here.
        logoURL:           owner.logoUrl     || owner.logoURL     || '',
        headshotURL:       owner.headshotUrl || owner.headshotURL || '',
        phone:             owner.phone            || '',
        email:             owner.email            || '',
        accentColor,
        showContactPhone:  owner.showContactPhone !== false,
        showContactEmail:  owner.showContactEmail === true,
        cardStatusBadge:   owner.cardStatusBadge  || 'booking',
        offersFreeEstimate: owner.offersFreeEstimate === true,
        verified:          isVerifiedBusiness(owner),
      }}
      services={services}
      qrSvg={qrSvg}
      initialLang={initialLang}
    />
  )
}

function CardNotActive() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 px-6 py-12">
      <div className="max-w-md w-full text-center">
        <div className="w-12 h-12 rounded-xl bg-brand-600 mx-auto mb-4 flex items-center justify-center">
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" opacity="0.3" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l2 2" />
          </svg>
        </div>
        <h1 className="text-xl font-semibold text-gray-900 mb-2">
          This card isn't active yet
        </h1>
        <p className="text-sm text-gray-600 mb-6">
          The service provider hasn't set up their YardSync card yet, or this link is no longer in use.
        </p>
        <a
          href="https://yardsyncapp.com"
          className="inline-block text-sm font-medium text-brand-600 hover:text-brand-700"
        >
          Learn about YardSync →
        </a>
      </div>
    </main>
  )
}
