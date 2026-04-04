import { NextResponse } from 'next/server'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

export async function POST(req) {
  try {
    const { uid } = await req.json()
    if (!uid) {
      return NextResponse.json({ error: 'Missing uid' }, { status: 400 })
    }

    // Create new Express account
    const account = await stripe.accounts.create({
      type: 'express',
      capabilities: {
        transfers: { requested: true },
      },
    })

    // Create account session for embedded onboarding
    const accountSession = await stripe.accountSessions.create({
      account: account.id,
      components: {
        account_onboarding: { enabled: true },
      },
    })

    return NextResponse.json({
      accountId: account.id,
      clientSecret: accountSession.client_secret,
    })
  } catch (err) {
    console.error('Connect create-account error:', err)
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
