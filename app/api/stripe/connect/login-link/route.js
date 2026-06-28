import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { getDocument } from '@/lib/firestoreRest'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY || process.env.NEXT_PUBLIC_FIREBASE_API_KEY

// Verify the caller's Firebase ID token → uid, so a contractor can only mint a
// login link to their OWN Stripe Express dashboard.
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

// One-time link to the contractor's Stripe Express dashboard — used to respond
// to a dispute (submit evidence) in-app, the strongest protection against
// losing a chargeback.
export async function POST(req) {
  try {
    const callerUid = await verifyCallerUid(req)
    if (!callerUid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const userDoc = await getDocument('users', callerUid)
    const acctId  = userDoc?.data?.stripeAccountId
    if (!acctId) return NextResponse.json({ error: 'No Stripe account', code: 'no_account' }, { status: 400 })

    const link = await stripe.accounts.createLoginLink(acctId)
    return NextResponse.json({ url: link.url })
  } catch (err) {
    console.error('connect/login-link error:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
