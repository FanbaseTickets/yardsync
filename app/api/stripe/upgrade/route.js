import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { syncCrewSeats } from '@/lib/crewBilling'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2026-02-25.clover' })
const SEAT_PRICE = process.env.STRIPE_PRICE_CREW_SEAT

export async function POST(request) {
  try {
    const { stripeSubscriptionId, gardenerUid } = await request.json()

    console.log('Upgrade request:', { stripeSubscriptionId, gardenerUid })

    if (!stripeSubscriptionId) {
      return NextResponse.json({ error: 'SUBSCRIPTION_NOT_READY', retry: true }, { status: 422 })
    }

    // Retrieve current subscription to get the item ID
    const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId)

    if (!subscription || subscription.status !== 'active') {
      return NextResponse.json({ error: 'Subscription not active' }, { status: 400 })
    }

    // Find the BASE plan item (NOT the crew-seat item — item order isn't
    // guaranteed, so never assume data[0]).
    const baseItem = subscription.items.data.find(it => it.price?.id !== SEAT_PRICE) || subscription.items.data[0]
    const seatItem = SEAT_PRICE ? subscription.items.data.find(it => it.price?.id === SEAT_PRICE) : null
    if (!baseItem?.id) {
      return NextResponse.json({ error: 'No subscription item found' }, { status: 400 })
    }
    if (baseItem.price?.id === process.env.STRIPE_PRICE_ANNUAL) {
      return NextResponse.json({ error: 'Already on annual plan' }, { status: 400 })
    }

    // Switch the base item to annual AND remove any monthly seat item in the same
    // update — Stripe forbids a monthly item on a yearly sub, so leaving it would
    // 500 the upgrade for exactly the crew-paying customers (C1). Seats are then
    // re-created on a dedicated monthly sub by syncCrewSeats below.
    const items = [{ id: baseItem.id, price: process.env.STRIPE_PRICE_ANNUAL }]
    if (seatItem) items.push({ id: seatItem.id, deleted: true })

    const updated = await stripe.subscriptions.update(stripeSubscriptionId, {
      items,
      proration_behavior:   'always_invoice',
      billing_cycle_anchor: 'now',
    })

    // Reconcile seats onto a dedicated monthly sub for the now-annual base.
    if (gardenerUid) { try { await syncCrewSeats(gardenerUid) } catch (e) { console.error('[upgrade] seat reconcile failed (non-fatal):', e.message) } }

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
