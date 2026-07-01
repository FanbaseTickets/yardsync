import { NextResponse } from 'next/server'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2026-02-25.clover' })

export async function POST(req) {
  try {
    const { stripeAccountId } = await req.json()
    if (!stripeAccountId) {
      return NextResponse.json({ error: 'Missing stripeAccountId' }, { status: 400 })
    }

    // Create fresh account session
    const accountSession = await stripe.accountSessions.create({
      account: stripeAccountId,
      components: {
        account_onboarding: { enabled: true },
      },
    })

    return NextResponse.json({
      clientSecret: accountSession.client_secret,
    })
  } catch (err) {
    console.error('Connect account-session error:', err)
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
