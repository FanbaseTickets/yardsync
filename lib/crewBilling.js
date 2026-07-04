import Stripe from 'stripe'
import { getDocument, updateDocument, listCollection } from '@/lib/firestoreRest'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2026-02-25.clover' })
const SEAT_PRICE = process.env.STRIPE_PRICE_CREW_SEAT   // recurring $15/seat/mo (set in Vercel)

/**
 * Sync the owner's crew-seat billing to their ACTIVE worker count. Each active
 * crew member is a per-unit quantity on a second subscription item (alongside
 * the $39/mo base) — so 3 workers = +3×$15/mo, prorated when it changes.
 *
 * Called on accept (a worker joined) and remove (a worker left). Idempotent:
 * it sets the quantity to the current active count, so re-runs are safe.
 * Non-fatal + no-op when STRIPE_PRICE_CREW_SEAT isn't configured yet.
 */
export async function syncCrewSeats(ownerUid) {
  if (!SEAT_PRICE) { console.warn('[crewBilling] STRIPE_PRICE_CREW_SEAT not set — skipping seat sync'); return }
  try {
    const u = await getDocument('users', ownerUid)
    const subId  = u?.data?.stripeSubscriptionId
    const status = u?.data?.subscriptionStatus
    // Seats attach to an ACTIVE subscription. If there's none, nothing to bill
    // (invite is gated on an active sub, so this is a safety net).
    if (!subId || status !== 'active') return

    const count = (await listCollection('memberships', { where: [{ field: 'businessUid', value: ownerUid }] }))
      .filter(m => m.data.status === 'active' && m.data.role === 'worker').length

    const sub = await stripe.subscriptions.retrieve(subId)
    const seatItem = sub.items.data.find(it => it.price?.id === SEAT_PRICE)

    if (count > 0) {
      if (seatItem) {
        if (seatItem.quantity !== count) {
          await stripe.subscriptionItems.update(seatItem.id, { quantity: count, proration_behavior: 'create_prorations' })
        }
      } else {
        await stripe.subscriptionItems.create({ subscription: subId, price: SEAT_PRICE, quantity: count, proration_behavior: 'create_prorations' })
      }
    } else if (seatItem) {
      // No active workers left → drop the seat item (base item remains).
      await stripe.subscriptionItems.del(seatItem.id, { proration_behavior: 'create_prorations' })
    }

    try { await updateDocument('businesses', ownerUid, { seatCount: count, updatedAt: new Date().toISOString() }) } catch {}
    console.log(`[crewBilling] synced ${count} crew seat(s) for ${ownerUid}`)
  } catch (e) {
    console.error('[crewBilling] syncCrewSeats failed (non-fatal):', e.message)
  }
}
