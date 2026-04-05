import { NextResponse } from 'next/server'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

export async function POST(req) {
  try {
    const { stripeSubscriptionId } = await req.json()
    if (!stripeSubscriptionId) {
      return NextResponse.json(
        { error: 'Missing stripeSubscriptionId' },
        { status: 400 }
      )
    }

    const subscription = await stripe.subscriptions.update(
      stripeSubscriptionId,
      { cancel_at_period_end: true }
    )

    return NextResponse.json({
      cancelAt: subscription.cancel_at,
      currentPeriodEnd: subscription.current_period_end,
      status: subscription.status,
    })
  } catch (err) {
    console.error('Cancel subscription error:', err)
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
