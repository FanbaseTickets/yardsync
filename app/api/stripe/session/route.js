import { NextResponse } from 'next/server'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('sessionId')

    if (!sessionId) {
      return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 })
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId)

    return NextResponse.json({
      customerId:     session.customer,
      subscriptionId: session.subscription,
    })
  } catch (err) {
    console.error('Stripe session retrieve error:', err.message)
    return NextResponse.json({ error: 'Failed to retrieve session' }, { status: 500 })
  }
}
