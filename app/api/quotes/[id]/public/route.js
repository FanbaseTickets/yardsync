import { NextResponse } from 'next/server'
import { getDocument, updateDocument } from '@/lib/firestoreRest'

// GET /api/quotes/[id]/public — public, no auth. Returns the sanitized quote +
// contractor brand for the /quote/[id] page, and records the first view.
export async function GET(_req, { params }) {
  try {
    const { id } = await params
    const qd = await getDocument('quotes', id)
    const q = qd?.data
    if (!q) return NextResponse.json({ error: 'Quote not found' }, { status: 404 })

    // Brand for the page header.
    let businessName = 'YardSync', logoUrl = null
    try {
      const u = await getDocument('users', q.gardenerUid)
      businessName = u?.data?.businessName || u?.data?.name || 'YardSync'
      logoUrl = u?.data?.logoUrl || null
    } catch {}

    // Expire on read if past validity (terminal states untouched).
    const expired = q.validUntil && new Date(q.validUntil).getTime() < Date.now()
    let status = q.status
    if (expired && ['sent', 'viewed'].includes(status)) {
      status = 'expired'
      try { await updateDocument('quotes', id, { status: 'expired', updatedAt: new Date().toISOString() }) } catch {}
    } else if (status === 'sent') {
      // First view: sent → viewed.
      status = 'viewed'
      try { await updateDocument('quotes', id, { status: 'viewed', viewedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }) } catch {}
    }

    return NextResponse.json({
      id,
      title:         q.title || 'Quote',
      recipientName: q.recipientName || '',
      lineItems:     q.lineItems || [],
      subtotalCents: q.subtotalCents || 0,
      coverFees:     q.coverFees === true,
      totalCents:    q.totalCents || 0,
      deposit:       q.deposit || null,
      validUntil:    q.validUntil || null,
      status,
      language:      q.language === 'es' ? 'es' : 'en',
      signature:     q.signature ? { name: q.signature.name, agreedAt: q.signature.agreedAt } : null,
      businessName,
      logoUrl,
    })
  } catch (err) {
    console.error('[quotes] public fetch failed:', err.message)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
