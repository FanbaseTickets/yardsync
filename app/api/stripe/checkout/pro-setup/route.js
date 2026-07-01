import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { getBaseUrl } from '@/lib/baseUrl'
import { getDocument } from '@/lib/firestoreRest'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2026-02-25.clover' })
const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY || process.env.NEXT_PUBLIC_FIREBASE_API_KEY

// Verify the caller's Firebase ID token → uid, so a contractor can only start a
// Pro Setup purchase for their OWN account.
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

// Standalone one-time $99 Pro Setup purchase. Decoupled from the subscription so
// it fits the free-access model — a contractor (typically a switcher with an
// existing client book) can buy the white-glove import ANY time. The charge is a
// mode:'payment' Checkout on the PLATFORM account (YardSync billing the
// contractor), not a Connect charge. The webhook marks setupFeePaid + flags the
// admin Pro Setup queue on completion.
export async function POST(req) {
  try {
    const callerUid = await verifyCallerUid(req)
    if (!callerUid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    if (!process.env.STRIPE_PRICE_SETUP) {
      return NextResponse.json({ error: 'Pro Setup is not configured', code: 'not_configured' }, { status: 400 })
    }

    const userDoc = await getDocument('users', callerUid)
    if (userDoc?.data?.setupFeePaid === true) {
      return NextResponse.json({ error: 'Pro Setup already purchased', code: 'already_purchased' }, { status: 400 })
    }

    const baseUrl = getBaseUrl(req)
    const session = await stripe.checkout.sessions.create({
      mode:                 'payment',
      payment_method_types: ['card'],
      line_items:           [{ price: process.env.STRIPE_PRICE_SETUP, quantity: 1 }],
      customer_email:       userDoc?.data?.email || undefined,
      success_url:          `${baseUrl}/dashboard?prosetup=success`,
      cancel_url:           `${baseUrl}/dashboard?prosetup=cancelled`,
      metadata: {
        gardenerUid: callerUid,
        kind:        'pro_setup',
      },
    })

    return NextResponse.json({ url: session.url })
  } catch (err) {
    console.error('checkout/pro-setup error:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
