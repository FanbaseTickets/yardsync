import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { getDocument, updateDocument } from '@/lib/firestoreRest'
import { getBaseUrl } from '@/lib/baseUrl'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY || process.env.NEXT_PUBLIC_FIREBASE_API_KEY

// Verify the caller's Firebase ID token and return their uid (localId), or null.
// Same pattern as the invoice route — this mints a card-capture session tied to
// a Stripe customer, so it must be the authenticated account owner.
async function verifyCallerUid(req) {
  const auth = req.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) return null
  try {
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: auth.slice(7) }),
      }
    )
    if (!res.ok) return null
    const data = await res.json()
    return data.users?.[0]?.localId || null
  } catch {
    return null
  }
}

// Free-access model (docs/FREE_ACCESS_SPEC.md): captures a card on file WITHOUT
// charging, via a Stripe Checkout session in mode:'setup'. Used at the "get
// paid" setup step (Connect / first invoice). The card is charged $39/mo only
// when the contractor's first client invoice is paid (see the webhook's
// payment_intent.succeeded first-paid activation).
export async function POST(request) {
  try {
    const callerUid = await verifyCallerUid(request)
    if (!callerUid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { gardenerUid, returnPath } = await request.json()
    if (!gardenerUid || gardenerUid !== callerUid) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const baseUrl = getBaseUrl(request)

    // Reuse the contractor's Stripe customer if one exists; otherwise create it
    // now and persist the id so the first-paid activation can find it.
    const userDoc  = await getDocument('users', gardenerUid)
    const profile  = userDoc?.data || {}
    let customerId = profile.stripeCustomerId || null

    if (!customerId) {
      const customer = await stripe.customers.create({
        email:    profile.email || undefined,
        name:     profile.businessName || profile.name || undefined,
        metadata: { gardenerUid },
      })
      customerId = customer.id
      await updateDocument('users', gardenerUid, {
        stripeCustomerId: customerId,
        updatedAt:        new Date().toISOString(),
      })
    }

    // mode:'setup' saves a card with no charge. The checkout.session.completed
    // webhook (mode==='setup') sets pmOnFile + the customer's default PM.
    const safeReturn = typeof returnPath === 'string' && returnPath.startsWith('/') ? returnPath : '/dashboard'
    const sep        = safeReturn.includes('?') ? '&' : '?'
    const session = await stripe.checkout.sessions.create({
      mode:                 'setup',
      payment_method_types: ['card'],
      customer:             customerId,
      success_url:          `${baseUrl}${safeReturn}${sep}card=saved`,
      cancel_url:           `${baseUrl}${safeReturn}${sep}card=cancelled`,
      metadata:             { gardenerUid },
    })

    return NextResponse.json({ url: session.url })
  } catch (err) {
    console.error('setup-card error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
