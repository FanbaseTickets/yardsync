import { NextResponse } from 'next/server'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

export async function POST(request) {
  try {
    const { priceId, setupFee, gardenerUid, gardenerEmail } = await request.json()

    const lineItems = [
      {
        price:    priceId,
        quantity: 1,
      }
    ]

    // Add setup fee as a one-time line item if selected
    if (setupFee) {
      lineItems.push({
        price:    process.env.STRIPE_PRICE_SETUP,
        quantity: 1,
      })
    }

    const session = await stripe.checkout.sessions.create({
      mode:                 'subscription',
      payment_method_types: ['card'],
      line_items:           lineItems,
      success_url:          `${process.env.NEXT_PUBLIC_APP_URL}/subscribe?session_id={CHECKOUT_SESSION_ID}&plan=${priceId === process.env.STRIPE_PRICE_ANNUAL ? 'annual' : 'monthly'}`,
      cancel_url:           `${process.env.NEXT_PUBLIC_APP_URL}/subscribe?cancelled=true`,
      customer_email:       gardenerEmail || undefined,
      metadata: {
        gardenerUid,
      },
      subscription_data: {
        metadata: {
          gardenerUid,
        },
      },
    })

    return NextResponse.json({ url: session.url })
  } catch (err) {
    console.error('Stripe checkout error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}