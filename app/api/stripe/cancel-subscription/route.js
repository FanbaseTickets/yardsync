import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { getSubscriptionPeriodEndEpoch } from '@/lib/stripeHelpers'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2026-02-25.clover' })

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
      currentPeriodEnd: getSubscriptionPeriodEndEpoch(subscription),
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
