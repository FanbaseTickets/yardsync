import { NextResponse } from 'next/server'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

export async function POST(req) {
  try {
    const { amount, currency = 'usd', stripeAccountId, description, customerEmail } = await req.json()

    if (!amount || !stripeAccountId) {
      return NextResponse.json(
        { error: 'Missing required fields: amount, stripeAccountId' },
        { status: 400 }
      )
    }

    const amountInCents = Math.round(amount * 100)
    const applicationFeeAmount = Math.round(amountInCents * 0.055)

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency,
      application_fee_amount: applicationFeeAmount,
      transfer_data: {
        destination: stripeAccountId,
      },
      description: description || 'YardSync lawn service invoice',
      receipt_email: customerEmail || undefined,
    })

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amount: amountInCents,
      applicationFee: applicationFeeAmount,
      contractorReceives: amountInCents - applicationFeeAmount,
    })
  } catch (err) {
    console.error('Create charge error:', err)
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
