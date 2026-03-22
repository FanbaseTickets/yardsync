import { NextResponse } from 'next/server'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

export async function POST(request) {
  try {
    const { gardenerUid, quarter, year, amountCents, stripeCustomerId, stripePaymentMethodId } = await request.json()

    if (!gardenerUid || !quarter || !year || !amountCents) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (!stripeCustomerId || !stripePaymentMethodId) {
      return NextResponse.json({ error: 'No payment method on file' }, { status: 400 })
    }

    // Create PaymentIntent and charge immediately
    const paymentIntent = await stripe.paymentIntents.create({
      amount:                amountCents,
      currency:              'usd',
      customer:              stripeCustomerId,
      payment_method:        stripePaymentMethodId,
      off_session:           true,
      confirm:               true,
      description:           `YardSync platform fees — ${quarter} ${year}`,
      metadata: {
        gardenerUid,
        quarter,
        year: String(year),
        type: 'quarterly_fee',
      },
    })

    if (paymentIntent.status !== 'succeeded') {
      return NextResponse.json({
        error: `Payment ${paymentIntent.status}`,
        paymentIntentId: paymentIntent.id,
      }, { status: 402 })
    }

    // Return success — client handles Firestore writes
    return NextResponse.json({
      success:          true,
      paymentIntentId:  paymentIntent.id,
      amountCents:      paymentIntent.amount,
    })
  } catch (err) {
    console.error('Charge fees failed:', err)
    const msg = err.type === 'StripeCardError' ? 'Card declined' : err.message
    return NextResponse.json({ error: msg }, { status: err.statusCode || 500 })
  }
}
