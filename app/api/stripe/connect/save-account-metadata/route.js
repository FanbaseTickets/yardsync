import { NextResponse } from 'next/server'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

export async function POST(req) {
  try {
    const { uid } = await req.json()
    if (!uid) {
      return NextResponse.json({ error: 'Missing uid' }, { status: 400 })
    }

    // Read user doc from Firestore via REST API — no Firebase SDK
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
    const res = await fetch(
      `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${uid}`
    )

    if (!res.ok) {
      return NextResponse.json({ error: 'Failed to read user doc' }, { status: 500 })
    }

    const doc = await res.json()
    const fields = doc.fields || {}
    const stripeSubscriptionId = fields.stripeSubscriptionId?.stringValue
    const stripeAccountId = fields.stripeAccountId?.stringValue

    if (!stripeSubscriptionId || !stripeAccountId) {
      return NextResponse.json(
        { error: 'Missing stripeSubscriptionId or stripeAccountId' },
        { status: 400 }
      )
    }

    // Write stripeAccountId into subscription metadata
    await stripe.subscriptions.update(stripeSubscriptionId, {
      metadata: { stripeAccountId },
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Save account metadata error:', err)
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
