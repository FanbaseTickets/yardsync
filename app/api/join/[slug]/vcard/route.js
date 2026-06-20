/**
 * GET /api/join/[slug]/vcard — vCard download for the digital business card.
 *
 * Public, unauthenticated. Resolves the slug, fetches the owner profile,
 * and returns a vCard 3.0 file. TEL / EMAIL are gated by the contractor's
 * showContactPhone / showContactEmail flags. Plain anchor on the card
 * (no client JS required).
 */

import { getDocument } from '@/lib/firestoreRest'
import { buildVCard } from '@/lib/vcard'

export const dynamic = 'force-dynamic'

function resolveBaseUrl(request) {
  try {
    const host = request.headers.get('host')
    if (host) {
      const proto = host.includes('localhost') ? 'http' : 'https'
      return `${proto}://${host}`
    }
  } catch {
    /* fall through */
  }
  return (process.env.NEXT_PUBLIC_APP_URL || 'https://yardsyncapp.com').replace(/\/$/, '')
}

export async function GET(request, { params }) {
  const { slug } = await params
  if (!slug) {
    return new Response('Missing slug', { status: 400 })
  }

  try {
    const slugDoc = await getDocument('slugs', slug)
    if (!slugDoc?.data?.active || !slugDoc.data.ownerUid) {
      return new Response('Card not active', { status: 404 })
    }

    const ownerDoc = await getDocument('users', slugDoc.data.ownerUid)
    if (!ownerDoc?.data) {
      return new Response('Owner not found', { status: 404 })
    }
    const owner = ownerDoc.data

    const baseUrl = resolveBaseUrl(request)

    const vcard = buildVCard({
      businessName: owner.businessName || 'Service Provider',
      phone:        owner.phone || null,
      email:        owner.email || null,
      showPhone:    owner.showContactPhone !== false,
      showEmail:    owner.showContactEmail === true,
      url:          `${baseUrl}/join/${slug}`,
      photoURL:     owner.headshotURL || owner.logoURL || null,
      tagline:      owner.tagline || null,
      serviceArea:  owner.serviceArea || null,
    })

    return new Response(vcard, {
      status: 200,
      headers: {
        'Content-Type':         'text/vcard; charset=utf-8',
        'Content-Disposition':  `attachment; filename="${slug}.vcf"`,
        'Cache-Control':        'no-store',
      },
    })
  } catch (err) {
    console.error('[vcard] error:', err.message)
    return new Response('Server error', { status: 500 })
  }
}
