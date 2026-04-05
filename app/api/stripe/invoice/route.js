import { NextResponse } from 'next/server'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

export async function POST(req) {
  try {
    const {
      stripeAccountId,
      totalCents,
      lineItems,
      clientName,
      clientEmail,
      description,
      gardenerUid,
      clientId,
    } = await req.json()

    if (!stripeAccountId || !totalCents) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const applicationFeeAmount = Math.round(totalCents * 0.055)

    const paymentIntent = await stripe.paymentIntents.create({
      amount: totalCents,
      currency: 'usd',
      application_fee_amount: applicationFeeAmount,
      transfer_data: {
        destination: stripeAccountId,
      },
      description: description || 'YardSync lawn service invoice',
      receipt_email: clientEmail || undefined,
      metadata: {
        gardenerUid,
        clientId,
        clientName: clientName || '',
        lineItemCount: String(lineItems?.length || 0),
      },
    })

    // Payment URL — client taps this to pay
    const paymentUrl =
      `${process.env.NEXT_PUBLIC_APP_URL}/pay/${paymentIntent.id}`

    return NextResponse.json({
      paymentIntentId: paymentIntent.id,
      clientSecret: paymentIntent.client_secret,
      paymentUrl,
      amount: totalCents,
      applicationFee: applicationFeeAmount,
      contractorReceives: totalCents - applicationFeeAmount,
    })
  } catch (err) {
    console.error('Stripe invoice error:', err)
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
