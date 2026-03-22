import { NextResponse } from 'next/server'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

export async function POST(request) {
  try {
    const { stripeCustomerId, paymentMethodId } = await request.json()

    if (!stripeCustomerId || !paymentMethodId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Attach payment method to customer
    await stripe.paymentMethods.attach(paymentMethodId, {
      customer: stripeCustomerId,
    })

    // Set as default payment method
    await stripe.customers.update(stripeCustomerId, {
      invoice_settings: { default_payment_method: paymentMethodId },
    })

    // Get card details for display (safe — no sensitive data)
    const pm = await stripe.paymentMethods.retrieve(paymentMethodId)

    return NextResponse.json({
      success:   true,
      last4:     pm.card?.last4 || '',
      brand:     pm.card?.brand || '',
      paymentMethodId: pm.id,
    })
  } catch (err) {
    console.error('Save payment method failed:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(request) {
  try {
    const { paymentMethodId } = await request.json()

    if (!paymentMethodId) {
      return NextResponse.json({ error: 'Missing paymentMethodId' }, { status: 400 })
    }

    await stripe.paymentMethods.detach(paymentMethodId)

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Delete payment method failed:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
