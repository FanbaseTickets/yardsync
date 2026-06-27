import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { getDocument, updateDocument } from '@/lib/firestoreRest'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

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

// Retry a past_due subscription's open invoice — used after the contractor
// updates their card on file. Pays the latest open invoice with the customer's
// (now updated) default payment method. On success, the invoice.payment_succeeded
// webhook flips the account back to 'active'.
export async function POST(request) {
  try {
    const callerUid = await verifyCallerUid(request)
    if (!callerUid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { gardenerUid } = await request.json()
    if (!gardenerUid || gardenerUid !== callerUid) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const userDoc = await getDocument('users', gardenerUid)
    const subId   = userDoc?.data?.stripeSubscriptionId
    if (!subId) return NextResponse.json({ error: 'No subscription to retry', code: 'no_sub' }, { status: 400 })

    const sub = await stripe.subscriptions.retrieve(subId, { expand: ['latest_invoice'] })
    const inv = sub.latest_invoice
    // 'open' is the only retryable invoice status here (invoice statuses are
    // draft|open|paid|uncollectible|void — 'past_due' is a SUBSCRIPTION status,
    // not an invoice one). A paid invoice falls through to nothing_to_retry.
    if (!inv || !inv.id || inv.status !== 'open') {
      return NextResponse.json({ code: 'nothing_to_retry', subscriptionStatus: sub.status })
    }

    // Pays with the subscription's default PM (the card they just updated).
    // Idempotency key makes a double-click provably safe. Throws on decline.
    const paid = await stripe.invoices.pay(inv.id, {}, { idempotencyKey: `retry_${inv.id}` })

    // Be the source of truth for the success case rather than relying on the
    // optimistic client write + the invoice.payment_succeeded webhook (which
    // only flips 'active' if a subscriptions doc matches). Avoids a paid-but-
    // stuck-past_due state.
    if (paid.status === 'paid') {
      await updateDocument('users', gardenerUid, {
        subscriptionStatus: 'active',
        lastPaymentAt:      new Date().toISOString(),
        updatedAt:          new Date().toISOString(),
      })
    }
    return NextResponse.json({
      ok: paid.status === 'paid',
      invoiceStatus: paid.status,
      subscriptionStatus: paid.status === 'paid' ? 'active' : sub.status,
    })
  } catch (err) {
    console.error('retry-subscription error:', err.message)
    // Card declined again, or other Stripe error.
    return NextResponse.json({ error: err.message || 'Retry failed', code: 'retry_failed' }, { status: 402 })
  }
}
