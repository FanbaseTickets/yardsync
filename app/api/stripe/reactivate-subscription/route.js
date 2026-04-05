import { NextResponse } from 'next/server'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

export async function POST(req) {
  try {
    const { stripeSubscriptionId, stripeCustomerId, plan } = await req.json()

    // Case 1: Subscription still exists (cancel_at_period_end)
    // Just remove the cancellation
    if (stripeSubscriptionId) {
      try {
        const subscription = await stripe.subscriptions.update(
          stripeSubscriptionId,
          { cancel_at_period_end: false }
        )
        return NextResponse.json({
          reactivated: true,
          subscriptionId: subscription.id,
        })
      } catch {
        // Subscription may be fully deleted — fall through to new sub
      }
    }

    // Case 2: Subscription fully ended — create new one
    if (!stripeCustomerId) {
      return NextResponse.json(
        { error: 'Missing stripeCustomerId' },
        { status: 400 }
      )
    }

    const priceId = plan === 'annual'
      ? process.env.STRIPE_ANNUAL_PRICE_ID
      : process.env.STRIPE_MONTHLY_PRICE_ID

    const subscription = await stripe.subscriptions.create({
      customer: stripeCustomerId,
      items: [{ price: priceId }],
      payment_behavior: 'default_incomplete',
      expand: ['latest_invoice.payment_intent'],
    })

    return NextResponse.json({
      reactivated: false,
      subscriptionId: subscription.id,
      clientSecret: subscription.latest_invoice
        ?.payment_intent?.client_secret || null,
    })
  } catch (err) {
    console.error('Reactivate subscription error:', err)
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
