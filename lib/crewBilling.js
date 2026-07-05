import Stripe from 'stripe'
import { getDocument, updateDocument, listCollection } from '@/lib/firestoreRest'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2026-02-25.clover' })
const SEAT_PRICE = process.env.STRIPE_PRICE_CREW_SEAT   // recurring MONTHLY $15/seat (set in Vercel)
export const SEAT_PRICE_CENTS = 1500

async function activeWorkerCount(ownerUid) {
  const mems = await listCollection('memberships', { where: [{ field: 'businessUid', value: ownerUid }] })
  return mems.filter(m => m.data.status === 'active' && m.data.role === 'worker').length
}

/**
 * Sync the owner's crew-seat billing to their ACTIVE worker count. Each active
 * crew member is a per-unit quantity of the $15/mo seat price.
 *
 * Billing model (Jay, 2026-07-05):
 *  - **Monthly base plan** → seats ride the SAME monthly subscription (a second
 *    item), so the contractor gets ONE combined monthly charge ($39 + N×$15).
 *  - **Annual base plan** → Stripe forbids a monthly item on a yearly
 *    subscription, so seats live on a SEPARATE, dedicated MONTHLY subscription
 *    (`stripeSeatSubscriptionId`). The base still bills once a year; seats bill
 *    monthly. This is the ONLY way to honor "annual = one yearly charge, seats
 *    monthly."
 *
 * Idempotent: sets the quantity to the current active count; safe to re-run.
 * Non-fatal + no-op when STRIPE_PRICE_CREW_SEAT isn't configured yet.
 * Reconciles across plan switches (annual↔monthly) by cleaning up the path it
 * isn't using.
 */
export async function syncCrewSeats(ownerUid) {
  if (!SEAT_PRICE) { console.warn('[crewBilling] STRIPE_PRICE_CREW_SEAT not set — skipping seat sync'); return }
  try {
    const u = await getDocument('users', ownerUid)
    const baseSubId = u?.data?.stripeSubscriptionId
    const status    = u?.data?.subscriptionStatus
    // Seats attach to an ACTIVE base plan. If there's none, nothing to bill
    // (invite is gated on an active sub, so this is a safety net).
    if (!baseSubId || status !== 'active') return

    const count   = await activeWorkerCount(ownerUid)
    const baseSub = await stripe.subscriptions.retrieve(baseSubId)
    // The base plan's interval — 'month' or 'year'. Ignore any seat item when
    // reading it (defensive; seats shouldn't be on an annual base).
    const baseInterval = baseSub.items.data.find(it => it.price?.id !== SEAT_PRICE)?.price?.recurring?.interval || 'month'
    let seatSubId = u?.data?.stripeSeatSubscriptionId || null

    if (baseInterval === 'month') {
      // ── Seats ride the base MONTHLY subscription (one combined charge) ──
      // If a stray dedicated seat sub exists (e.g. they switched annual→monthly),
      // cancel it so seats don't double-bill.
      if (seatSubId) {
        try { await stripe.subscriptions.cancel(seatSubId) } catch {}
        await updateDocument('users', ownerUid, { stripeSeatSubscriptionId: null })
        seatSubId = null
      }
      const seatItem = baseSub.items.data.find(it => it.price?.id === SEAT_PRICE)
      if (count > 0) {
        if (seatItem) {
          if (seatItem.quantity !== count) {
            await stripe.subscriptionItems.update(seatItem.id, { quantity: count, proration_behavior: 'create_prorations' })
          }
        } else {
          try {
            await stripe.subscriptionItems.create({ subscription: baseSubId, price: SEAT_PRICE, quantity: count, proration_behavior: 'create_prorations' })
          } catch (createErr) {
            // Race: a concurrent accept created the seat item first. Re-fetch +
            // reconcile the quantity so we never under-bill.
            const sub2  = await stripe.subscriptions.retrieve(baseSubId)
            const item2 = sub2.items.data.find(it => it.price?.id === SEAT_PRICE)
            if (item2) {
              if (item2.quantity !== count) await stripe.subscriptionItems.update(item2.id, { quantity: count, proration_behavior: 'create_prorations' })
            } else { throw createErr }
          }
        }
      } else if (seatItem) {
        // No active workers → drop the seat item (base item remains).
        await stripe.subscriptionItems.del(seatItem.id, { proration_behavior: 'create_prorations' })
      }
    } else {
      // ── Annual base: seats on a SEPARATE dedicated MONTHLY subscription ──
      // Also strip any seat item that somehow landed on the annual base sub.
      const strayOnBase = baseSub.items.data.find(it => it.price?.id === SEAT_PRICE)
      if (strayOnBase && baseSub.items.data.length > 1) {
        try { await stripe.subscriptionItems.del(strayOnBase.id, { proration_behavior: 'create_prorations' }) } catch {}
      }

      // Validate any recorded seat sub is still live.
      let seatSub = null
      if (seatSubId) {
        try {
          seatSub = await stripe.subscriptions.retrieve(seatSubId)
          if (seatSub.status === 'canceled') { seatSub = null; seatSubId = null }
        } catch { seatSub = null; seatSubId = null }
      }

      if (count > 0) {
        if (seatSub) {
          const item = seatSub.items.data.find(it => it.price?.id === SEAT_PRICE) || seatSub.items.data[0]
          if (item.quantity !== count) {
            await stripe.subscriptionItems.update(item.id, { quantity: count, proration_behavior: 'create_prorations' })
          }
        } else {
          // Create the dedicated monthly seat subscription on the same customer,
          // charged to the base plan's payment method.
          const created = await stripe.subscriptions.create({
            customer: baseSub.customer,
            items: [{ price: SEAT_PRICE, quantity: count }],
            default_payment_method: baseSub.default_payment_method || undefined,
            proration_behavior: 'create_prorations',
            metadata: { yardsync: 'crew_seats', ownerUid },
          })
          seatSubId = created.id
          await updateDocument('users', ownerUid, { stripeSeatSubscriptionId: seatSubId })
        }
      } else if (seatSub) {
        // No active workers → cancel the dedicated seat subscription.
        try { await stripe.subscriptions.cancel(seatSubId) } catch {}
        await updateDocument('users', ownerUid, { stripeSeatSubscriptionId: null })
        seatSubId = null
      }
    }

    // Denormalize the seat count + monthly cents for the Billing tab display.
    const seatCents = count * SEAT_PRICE_CENTS
    try { await updateDocument('users', ownerUid, { seatCount: count, seatCents }) } catch {}
    try { await updateDocument('businesses', ownerUid, { seatCount: count, updatedAt: new Date().toISOString() }) } catch {}
    console.log(`[crewBilling] synced ${count} crew seat(s) for ${ownerUid} (base=${baseInterval}${seatSubId ? ', dedicated seat sub' : ''})`)
  } catch (e) {
    console.error('[crewBilling] syncCrewSeats failed (non-fatal):', e.message)
  }
}
