import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { queryCollection } from '@/lib/firestoreRest'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2026-02-25.clover' })

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Missing payment intent ID' }, { status: 400 })
    }

    // Direct charges live on the CONNECTED account, so the PaymentIntent must be
    // retrieved with that account's context (Stripe-Account header). Resolve the
    // account from the invoice doc. Legacy destination-charge invoices have no
    // stripeAccountId — fall back to a platform retrieve so old links still work.
    let stripeAccountId = null
    try {
      const inv = await queryCollection('invoices', 'stripePaymentIntentId', id)
      stripeAccountId = inv?.data?.stripeAccountId || null
    } catch (lookupErr) {
      console.warn('Pay details — invoice lookup failed, trying platform retrieve:', lookupErr.message)
    }

    const paymentIntent = stripeAccountId
      ? await stripe.paymentIntents.retrieve(id, { stripeAccount: stripeAccountId })
      : await stripe.paymentIntents.retrieve(id)

    return NextResponse.json({
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
      description: paymentIntent.description,
      status: paymentIntent.status,
      clientSecret: paymentIntent.client_secret,
      metadata: paymentIntent.metadata,
      // The client must initialize Stripe.js with this account so confirmCardPayment
      // targets the connected account where the PI was created. Null for legacy.
      connectedAccountId: stripeAccountId,
    })
  } catch (err) {
    console.error('Pay details error:', err)
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
