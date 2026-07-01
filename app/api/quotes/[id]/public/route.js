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

    // Brand for the page header + whether the contractor can actually collect
    // (Connect active + free-access card-on-file invariant), so the page only
    // shows Pay buttons when a charge would succeed.
    let businessName = 'YardSync', logoUrl = null, canCollect = false
    try {
      const u = await getDocument('users', q.gardenerUid)
      const g = u?.data || {}
      businessName = g.businessName || g.name || 'YardSync'
      logoUrl = g.logoUrl || null
      const connectReady = !!g.stripeAccountId && g.stripeChargesEnabled === true && g.stripeCardPaymentsActive !== false
      const freeAccessBlocked = g.subscriptionStatus === 'free_until_paid' && g.pmOnFile !== true
      canCollect = connectReady && !freeAccessBlocked
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
      language:        q.language === 'es' ? 'es' : 'en',
      signature:       q.signature ? { name: q.signature.name, agreedAt: q.signature.agreedAt } : null,
      deposit:         q.deposit || null,
      depositPaid:     q.depositPaid === true,
      amountPaidCents: q.amountPaidCents || 0,
      canCollect,
      businessName,
      logoUrl,
    })
  } catch (err) {
    console.error('[quotes] public fetch failed:', err.message)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
