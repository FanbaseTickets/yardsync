/**
 * GET /join/[slug] — public business card + intake form
 *
 * Server component. **No Firebase client SDK in this file's component
 * tree** (constraint #2 in docs/SMART_BUSINESS_CARD_SPEC.md): all
 * Firestore reads happen via lib/firestoreRest.js; the IntakeForm
 * client component below only fetch()es /api/join/submit and never
 * touches Firebase directly.
 *
 * Flow:
 *  1. Resolve slugs/{slug} → ownerUid (or render branded "not active" page)
 *  2. If old slug with live redirect window → 301 to current slug
 *  3. Fetch owner profile (users/{uid}) for the public-facing fields
 *  4. Fetch owner's service packages for the "Service interest" dropdown
 *  5. Detect language from Accept-Language; render with EN/ES toggle
 *  6. Render the bilingual landing page + IntakeForm
 *
 * No payment/Connect gating — the page is live the moment a slug exists.
 */

import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { getDocument, listCollection } from '@/lib/firestoreRest'
import IntakeForm from './IntakeForm'

export const dynamic = 'force-dynamic'

const DEFAULT_ACCENT = '#0F6E56' // YardSync primary (matches Tailwind brand-600)

export async function generateMetadata({ params }) {
  const { slug } = await params
  // Best-effort: skip the lookup if the slug is malformed.
  if (!slug || typeof slug !== 'string') return { title: 'YardSync' }

  try {
    const slugDoc = await getDocument('slugs', slug)
    if (!slugDoc?.data?.active) return { title: 'YardSync' }
    const ownerDoc = await getDocument('users', slugDoc.data.ownerUid)
    if (!ownerDoc?.data?.businessName) return { title: 'YardSync' }
    return {
      title: `${ownerDoc.data.businessName} · YardSync`,
      description: ownerDoc.data.tagline || ownerDoc.data.bio || 'Request service from this provider.',
    }
  } catch {
    return { title: 'YardSync' }
  }
}

export default async function JoinPage({ params }) {
  const { slug } = await params

  // ── 1. Resolve the slug ───────────────────────────────────────────────
  const slugDoc = await getDocument('slugs', slug)

  if (!slugDoc) {
    return <CardNotActive />
  }

  // ── 2. Handle old-slug redirect (30-day window after a slug change) ──
  if (slugDoc.data.active === false) {
    const redirectTo = slugDoc.data.redirectTo
    const expiresAt  = slugDoc.data.expiresAt
    if (redirectTo && expiresAt && new Date(expiresAt) > new Date()) {
      redirect(`/join/${redirectTo}`)
    }
    return <CardNotActive />
  }

  // ── 3. Fetch owner profile ────────────────────────────────────────────
  const ownerUid = slugDoc.data.ownerUid
  if (!ownerUid) return <CardNotActive />
  const ownerDoc = await getDocument('users', ownerUid)
  if (!ownerDoc?.data) return <CardNotActive />

  const owner = ownerDoc.data

  // ── 4. Fetch service packages (for the dropdown — optional) ───────────
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
    // Non-fatal — the dropdown just won't render
    console.error('join page: services fetch failed:', err.message)
  }

  // ── 5. Detect language from Accept-Language header ────────────────────
  const headersList = await headers()
  const acceptLang = (headersList.get('accept-language') || '').toLowerCase()
  const initialLang = acceptLang.startsWith('es') ? 'es' : 'en'

  // ── 6. Render ─────────────────────────────────────────────────────────
  const accentColor = owner.accentColor || DEFAULT_ACCENT

  return (
    <IntakeForm
      slug={slug}
      owner={{
        businessName:  owner.businessName  || 'Service Provider',
        tagline:       owner.tagline       || '',
        bio:           owner.bio           || '',
        serviceArea:   owner.serviceArea   || '',
        logoURL:       owner.logoURL       || '',
        headshotURL:   owner.headshotURL   || '',
        phone:         owner.phone         || '',
        accentColor,
      }}
      services={services}
      initialLang={initialLang}
    />
  )
}

/**
 * Branded "card not active" page. Replaces the raw Next.js 404 so a
 * scanned-but-not-yet-generated QR code shows something explanatory
 * rather than a generic browser error.
 */
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
