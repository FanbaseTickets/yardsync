/**
 * GET /join/[slug]/request — public intake form (rev 3).
 *
 * Server component. **No Firebase client SDK** in this tree (constraint
 * #2 in docs/SMART_BUSINESS_CARD_SPEC.md). All Firestore reads happen
 * via lib/firestoreRest.js; the IntakeForm client component imports no
 * Firebase — it only POSTs to /api/join/submit.
 *
 * This is where the on-card QR + printed/social QR codes land, and
 * where the card's primary "Request service" button sends visitors.
 * The form is the same component that previously lived under the card
 * route; only its host page is new.
 *
 * Flow:
 *  1. Resolve slugs/{slug} — 404 / 301 same as the card route
 *  2. Fetch minimal owner profile + service packages
 *  3. Detect language from Accept-Language
 *  4. Render IntakeForm (which carries its own bilingual chrome)
 */

import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { getDocument, listCollection } from '@/lib/firestoreRest'
import IntakeForm from '../IntakeForm'

export const dynamic = 'force-dynamic'

const DEFAULT_ACCENT = '#0F6E56'

export async function generateMetadata({ params }) {
  const { slug } = await params
  if (!slug || typeof slug !== 'string') return { title: 'Request service · YardSync' }

  try {
    const slugDoc = await getDocument('slugs', slug)
    if (!slugDoc?.data?.active) return { title: 'Request service · YardSync' }
    const ownerDoc = await getDocument('users', slugDoc.data.ownerUid)
    const businessName = ownerDoc?.data?.businessName
    return {
      title: businessName ? `Request service · ${businessName}` : 'Request service · YardSync',
    }
  } catch {
    return { title: 'Request service · YardSync' }
  }
}

export default async function RequestPage({ params }) {
  const { slug } = await params

  const slugDoc = await getDocument('slugs', slug)
  if (!slugDoc) return <CardNotActive />

  if (slugDoc.data.active === false) {
    const redirectTo = slugDoc.data.redirectTo
    const expiresAt  = slugDoc.data.expiresAt
    if (redirectTo && expiresAt && new Date(expiresAt) > new Date()) {
      redirect(`/join/${redirectTo}/request`)
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
    console.error('[join/request] services fetch failed:', err.message)
  }

  const headersList = await headers()
  const acceptLang  = (headersList.get('accept-language') || '').toLowerCase()
  const initialLang = acceptLang.startsWith('es') ? 'es' : 'en'

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
      backLinkHref={`/join/${slug}`}
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
