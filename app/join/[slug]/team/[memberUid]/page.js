/**
 * GET /join/[slug]/team/[memberUid] — a CREW MEMBER's digital card (Phase 1e).
 *
 * Server component, no Firebase client SDK (same constraint as the owner card).
 * A crew member is a funnel for the OWNER: this card shows the OWNER's business
 * branding (name + logo + accent) alongside the member's own headshot + name, and
 * its "Request service" CTA + QR point to the OWNER's intake form
 * (/join/[slug]/request) — so every lead a member drums up is captured + assigned
 * out by the owner, never billed by the member.
 *
 * Flow:
 *  1. Resolve slugs/{slug} → ownerUid (business)
 *  2. Verify memberships/{ownerUid}_{memberUid} is ACTIVE (else "not on this crew")
 *  3. Fetch owner (branding) + member (name + headshot)
 *  4. Server-render a QR → /join/{slug}/request
 */

import { headers } from 'next/headers'
import QRCode from 'qrcode'
import { getDocument } from '@/lib/firestoreRest'
import { membershipId } from '@/lib/crew'
import CrewMemberCard from './CrewMemberCard'

export const dynamic = 'force-dynamic'

const DEFAULT_ACCENT = '#0F6E56'

async function generateQrSvg(text, color) {
  try {
    return await QRCode.toString(text, { type: 'svg', margin: 1, width: 200, color: { dark: color, light: '#ffffff' }, errorCorrectionLevel: 'M' })
  } catch (err) {
    console.error('[crew-card] QR generation failed:', err.message)
    return null
  }
}

function resolveBaseUrl(headersList) {
  const host = headersList?.get?.('host')
  if (host) return `${host.includes('localhost') ? 'http' : 'https'}://${host}`
  return (process.env.NEXT_PUBLIC_APP_URL || 'https://yardsyncapp.com').replace(/\/$/, '')
}

export async function generateMetadata({ params }) {
  const { slug, memberUid } = await params
  try {
    const slugDoc = await getDocument('slugs', slug)
    if (!slugDoc?.data?.ownerUid) return { title: 'YardSync' }
    const owner = await getDocument('users', slugDoc.data.ownerUid)
    return { title: `${owner?.data?.businessName || 'YardSync'} · Team member` }
  } catch { return { title: 'YardSync' } }
}

export default async function CrewCardPage({ params }) {
  const { slug, memberUid } = await params

  const slugDoc = await getDocument('slugs', slug)
  const ownerUid = slugDoc?.data?.active !== false ? slugDoc?.data?.ownerUid : null
  if (!ownerUid) return <NotOnCrew />

  // Must be an ACTIVE member of THIS business.
  const membership = await getDocument('memberships', membershipId(ownerUid, memberUid))
  if (membership?.data?.status !== 'active') return <NotOnCrew />

  const ownerDoc  = await getDocument('users', ownerUid)
  const memberDoc = await getDocument('users', memberUid)
  if (!ownerDoc?.data) return <NotOnCrew />
  const owner  = ownerDoc.data
  const member = memberDoc?.data || {}

  const headersList = await headers()
  const acceptLang  = (headersList.get('accept-language') || '').toLowerCase()
  const initialLang = acceptLang.startsWith('es') ? 'es' : 'en'

  const accentColor = owner.accentColor || DEFAULT_ACCENT
  const baseUrl     = resolveBaseUrl(headersList)
  const requestUrl  = `${baseUrl}/join/${slug}/request`
  const qrSvg       = await generateQrSvg(requestUrl, accentColor)

  return (
    <CrewMemberCard
      business={{
        name:        owner.businessName || 'Service Provider',
        // Owner's logo is the card's branding (read both casings); the member
        // supplies their own headshot.
        logoURL:     owner.logoUrl || owner.logoURL || '',
        accentColor,
        serviceArea: owner.serviceArea || '',
        offersFreeEstimate: owner.offersFreeEstimate === true,
      }}
      member={{
        name:        membership.data.inviteName || member.name || 'Team member',
        headshotURL: member.headshotUrl || member.headshotURL || '',
      }}
      requestUrl={requestUrl}
      qrSvg={qrSvg}
      initialLang={initialLang}
    />
  )
}

function NotOnCrew() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 px-6 py-12">
      <div className="max-w-md w-full text-center">
        <h1 className="text-xl font-semibold text-gray-900 mb-2">This card isn’t active</h1>
        <p className="text-sm text-gray-600 mb-6">This team member’s card isn’t available, or the link is no longer in use.</p>
        <a href="https://yardsyncapp.com" className="inline-block text-sm font-medium text-brand-600 hover:text-brand-700">Learn about YardSync →</a>
      </div>
    </main>
  )
}
