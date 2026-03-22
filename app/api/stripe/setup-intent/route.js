import { NextResponse } from 'next/server'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

export async function POST(request) {
  try {
    const { gardenerUid, email, name, stripeCustomerId } = await request.json()

    if (!gardenerUid) {
      return NextResponse.json({ error: 'Missing gardenerUid' }, { status: 400 })
    }

    // Use existing Stripe customer or create new one
    let customerId = stripeCustomerId
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: email || undefined,
        name:  name  || undefined,
        metadata: { gardenerUid },
      })
      customerId = customer.id
    }

    // Create SetupIntent for saving card without charging
    const setupIntent = await stripe.setupIntents.create({
      customer: customerId,
      payment_method_types: ['card'],
      metadata: { gardenerUid },
    })

    return NextResponse.json({
      clientSecret:    setupIntent.client_secret,
      stripeCustomerId: customerId,
    })
  } catch (err) {
    console.error('SetupIntent failed:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
