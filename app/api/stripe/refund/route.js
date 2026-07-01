import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { getDocument, updateDocument } from '@/lib/firestoreRest'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2026-02-25.clover' })

const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY || process.env.NEXT_PUBLIC_FIREBASE_API_KEY

async function verifyCallerUid(req) {
  const auth = req.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) return null
  try {
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_API_KEY}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken: auth.slice(7) }) }
    )
    if (!res.ok) return null
    const data = await res.json()
    return data.users?.[0]?.localId || null
  } catch {
    return null
  }
}

// In-app refund of a paid client invoice. The charge is a DIRECT charge on the
// contractor's connected account, with a 5.5% application fee owned by the
// platform. The refund is created ON the connected account (that's where the
// charge lives — a platform-context call gets "No such charge"). For a direct
// charge, refunding the charge does NOT refund the platform's application fee by
// default, so YardSync keeps its 5.5% (Terms §5: the app fee is non-refundable
// even when a client payment is refunded).
// VERIFY in a test refund that the platform's application fee is retained (the
// 5.5% stays in the platform balance, not returned to the contractor). If a test
// shows it IS refunded, we'd instead keep it explicitly via a separate
// applicationFees refund decision — but the direct-charge default is to retain.
export async function POST(request) {
  try {
    const callerUid = await verifyCallerUid(request)
    if (!callerUid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { gardenerUid, invoiceId } = await request.json()
    if (!gardenerUid || gardenerUid !== callerUid) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (!invoiceId) return NextResponse.json({ error: 'Missing invoiceId' }, { status: 400 })

    const invDoc = await getDocument('invoices', invoiceId)
    const inv    = invDoc?.data
    if (!inv) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    if (inv.gardenerUid !== gardenerUid) {
      return NextResponse.json({ error: 'Not your invoice' }, { status: 403 })
    }
    if (inv.status !== 'paid') {
      return NextResponse.json({ error: 'Only a paid invoice can be refunded', code: 'not_paid' }, { status: 400 })
    }

    const piId = inv.stripePaymentIntentId
    const acct = inv.stripeAccountId
    if (!piId || !acct) {
      return NextResponse.json({ error: 'Invoice is missing payment info', code: 'no_payment' }, { status: 400 })
    }

    // Refund on the CONNECTED account (where the direct charge lives — a
    // platform-context call can't see a connected-account charge). For a DIRECT
    // charge, refunding does NOT refund the platform's application fee by
    // default, so YardSync keeps its 5.5% (Terms §5) without any extra param.
    // Idempotent per invoice.
    let refund
    try {
      refund = await stripe.refunds.create(
        { payment_intent: piId },
        { stripeAccount: acct, idempotencyKey: `refund_${invoiceId}` }
      )
    } catch (e) {
      // Already refunded (e.g. a stale retry or a dashboard refund beat us) —
      // treat as success and make sure the doc reflects it.
      if (e.code === 'charge_already_refunded') {
        await updateDocument('invoices', invoiceId, {
          status: 'refunded', refundedAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        })
        return NextResponse.json({ ok: true, alreadyRefunded: true })
      }
      throw e
    }

    // The charge.refunded webhook (connected account) flips the invoice to
    // 'refunded' + reverses trust-state. Reflect status here too so the UI
    // updates immediately even if the webhook lags.
    await updateDocument('invoices', invoiceId, {
      status:              'refunded',
      refundedAmountCents: refund.amount || inv.totalCents || 0,
      refundedAt:          new Date().toISOString(),
      updatedAt:           new Date().toISOString(),
    })

    return NextResponse.json({ ok: true, refundId: refund.id, amount: refund.amount })
  } catch (err) {
    console.error('refund error:', err.message)
    return NextResponse.json({ error: err.message || 'Refund failed', code: 'refund_failed' }, { status: 402 })
  }
}
