import { NextResponse } from 'next/server'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

export async function POST(request) {
  try {
    const { stripeSubscriptionId } = await request.json()

    if (!stripeSubscriptionId) {
      return NextResponse.json({ error: 'Missing subscription ID' }, { status: 400 })
    }

    // Retrieve current subscription to get the item ID
    const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId)

    if (!subscription || subscription.status !== 'active') {
      return NextResponse.json({ error: 'Subscription not active' }, { status: 400 })
    }

    const currentItemId = subscription.items.data[0]?.id
    if (!currentItemId) {
      return NextResponse.json({ error: 'No subscription item found' }, { status: 400 })
    }

    // Check if already on annual
    const currentPriceId = subscription.items.data[0]?.price?.id
    if (currentPriceId === process.env.STRIPE_PRICE_ANNUAL) {
      return NextResponse.json({ error: 'Already on annual plan' }, { status: 400 })
    }

    // Update subscription to annual plan
    const updated = await stripe.subscriptions.update(stripeSubscriptionId, {
      items: [{
        id:    currentItemId,
        price: process.env.STRIPE_PRICE_ANNUAL,
      }],
      proration_behavior:   'always_invoice',
      billing_cycle_anchor: 'now',
    })

    return NextResponse.json({
      success: true,
      status:  updated.status,
      plan:    'annual',
    })
  } catch (err) {
    console.error('Stripe upgrade error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
