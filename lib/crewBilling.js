import Stripe from 'stripe'
import { getDocument, updateDocument, listCollection } from '@/lib/firestoreRest'
import { sendAdminEmail } from '@/lib/email'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2026-02-25.clover' })
const SEAT_PRICE = process.env.STRIPE_PRICE_CREW_SEAT   // recurring MONTHLY $15/seat (set in Vercel)
export const SEAT_PRICE_CENTS = 1500

async function activeWorkerCount(ownerUid) {
  const mems = await listCollection('memberships', { where: [{ field: 'businessUid', value: ownerUid }] })
  return mems.filter(m => m.data.status === 'active' && m.data.role === 'worker').length
}

// Cancel a subscription treating "already gone/canceled" as success. Returns
// true only when the sub is confirmed no longer billing, so callers only clear
// the stored pointer on a real success (C3 — never orphan a live sub).
async function safeCancel(subId) {
  try { await stripe.subscriptions.cancel(subId); return true }
  catch (e) {
    if (e?.code === 'resource_missing' || /no such subscription|already canceled/i.test(e?.message || '')) return true
    console.error('[crewBilling] seat sub cancel failed (kept pointer for retry):', e.message)
    return false
  }
}

// All dedicated crew-seat subscriptions on a customer (metadata-tagged), that are
// still in a billable/soon-billable state. Used to adopt + de-duplicate (C2).
async function findSeatSubs(customerId) {
  const list = await stripe.subscriptions.list({ customer: customerId, status: 'all', limit: 100 })
  return list.data.filter(s =>
    s.metadata?.yardsync === 'crew_seats' &&
    ['active', 'trialing', 'past_due', 'incomplete', 'unpaid'].includes(s.status)
  )
}

// The payment method the seat sub should charge: the base sub's, else the
// customer's default (C4 — base subs are frequently created without a sub-level PM).
async function resolvePaymentMethod(baseSub) {
  if (baseSub.default_payment_method) return baseSub.default_payment_method
  try {
    const cust = await stripe.customers.retrieve(baseSub.customer)
    return cust?.invoice_settings?.default_payment_method || null
  } catch { return null }
}

/**
 * Sync the owner's crew-seat billing to their ACTIVE worker count. Each active
 * crew member is a per-unit quantity of the $15/mo seat price.
 *
 * Billing model (Jay, 2026-07-05):
 *  - **Monthly base plan** → seats ride the SAME monthly subscription (a second
 *    item), so the contractor gets ONE combined monthly charge ($39 + N×$15).
 *  - **Annual base plan** → Stripe forbids a monthly item on a yearly sub, so
 *    seats live on a SEPARATE dedicated MONTHLY subscription
 *    (`stripeSeatSubscriptionId`, metadata `yardsync:crew_seats`). Base bills
 *    yearly; seats bill monthly.
 *
 * Idempotent; reconciles across plan switches. Call it on crew accept/remove AND
 * on any base-plan interval change (upgrade route + subscription.updated webhook)
 * — otherwise billing drifts into the wrong shape.
 */
export async function syncCrewSeats(ownerUid) {
  if (!SEAT_PRICE) { console.warn('[crewBilling] STRIPE_PRICE_CREW_SEAT not set — skipping seat sync'); return }
  try {
    const u = await getDocument('users', ownerUid)
    const baseSubId = u?.data?.stripeSubscriptionId
    const status    = u?.data?.subscriptionStatus
    if (!baseSubId || status !== 'active') return

    const count   = await activeWorkerCount(ownerUid)
    const baseSub = await stripe.subscriptions.retrieve(baseSubId)
    const baseInterval = baseSub.items.data.find(it => it.price?.id !== SEAT_PRICE)?.price?.recurring?.interval || 'month'
    let seatSubId = u?.data?.stripeSeatSubscriptionId || null

    if (baseInterval === 'month') {
      // ── Seats ride the base MONTHLY subscription (one combined charge) ──
      // Cancel any stray dedicated seat sub (e.g. after an annual→monthly switch)
      // so seats don't double-bill. Only clear the pointer on a confirmed cancel.
      if (seatSubId) {
        if (await safeCancel(seatSubId)) { await updateDocument('users', ownerUid, { stripeSeatSubscriptionId: null }); seatSubId = null }
      }
      // Belt-and-suspenders: catch any dedicated seat subs not tracked in Firestore.
      for (const extra of await findSeatSubs(baseSub.customer)) { await safeCancel(extra.id) }

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
        await stripe.subscriptionItems.del(seatItem.id, { proration_behavior: 'create_prorations' })
      }
    } else {
      // ── Annual base: seats on a SEPARATE dedicated MONTHLY subscription ──
      // Strip any seat item that somehow landed on the annual base sub.
      const strayOnBase = baseSub.items.data.find(it => it.price?.id === SEAT_PRICE)
      if (strayOnBase && baseSub.items.data.length > 1) {
        try { await stripe.subscriptionItems.del(strayOnBase.id, { proration_behavior: 'create_prorations' }) } catch {}
      }

      // Adopt any existing dedicated seat sub (recovers a lost pointer + collapses
      // a create-race: keep the first, cancel duplicates) — C2.
      const existing = await findSeatSubs(baseSub.customer)
      let seatSub = existing[0] || null
      if (seatSub) {
        seatSubId = seatSub.id
        for (const dup of existing.slice(1)) await safeCancel(dup.id)
        if ((u?.data?.stripeSeatSubscriptionId || null) !== seatSubId) {
          await updateDocument('users', ownerUid, { stripeSeatSubscriptionId: seatSubId })
        }
      } else {
        seatSubId = null
      }

      if (count > 0) {
        if (seatSub) {
          const item = seatSub.items.data.find(it => it.price?.id === SEAT_PRICE) || seatSub.items.data[0]
          if (item.quantity !== count) {
            await stripe.subscriptionItems.update(item.id, { quantity: count, proration_behavior: 'create_prorations' })
          }
        } else {
          const pm = await resolvePaymentMethod(baseSub)
          // error_if_incomplete + off_session: a genuinely unbillable state throws
          // (→ admin alert below) instead of silently creating a dead `incomplete`
          // sub that never bills the seats (C4).
          const created = await stripe.subscriptions.create({
            customer: baseSub.customer,
            items: [{ price: SEAT_PRICE, quantity: count }],
            default_payment_method: pm || undefined,
            off_session: true,
            payment_behavior: 'error_if_incomplete',
            proration_behavior: 'create_prorations',
            metadata: { yardsync: 'crew_seats', ownerUid },
          })
          seatSubId = created.id
          await updateDocument('users', ownerUid, { stripeSeatSubscriptionId: seatSubId })
        }
      } else if (seatSub) {
        if (await safeCancel(seatSubId)) { await updateDocument('users', ownerUid, { stripeSeatSubscriptionId: null }); seatSubId = null }
      }
    }

    // Denormalize the seat count + monthly cents for the Billing tab display.
    const seatCents = count * SEAT_PRICE_CENTS
    try { await updateDocument('users', ownerUid, { seatCount: count, seatCents }) } catch {}
    try { await updateDocument('businesses', ownerUid, { seatCount: count, updatedAt: new Date().toISOString() }) } catch {}
    console.log(`[crewBilling] synced ${count} crew seat(s) for ${ownerUid} (base=${baseInterval}${seatSubId ? ', dedicated seat sub' : ''})`)
  } catch (e) {
    console.error('[crewBilling] syncCrewSeats failed (non-fatal):', e.message)
    // Fail loud to the operator — a swallowed sync means billing drift.
    try {
      await sendAdminEmail({
        subject: `⚠️ Crew seat sync failed for ${ownerUid}`,
        text: `syncCrewSeats(${ownerUid}) threw: ${e.message}\n\nSeat billing may be out of sync (member active-but-unbilled or removed-but-billed). The reconcile cron will retry.`,
        html: `<p><strong>syncCrewSeats(${ownerUid})</strong> threw: ${e.message}</p><p>Seat billing may be out of sync. The reconcile cron will retry.</p>`,
      })
    } catch {}
  }
}
