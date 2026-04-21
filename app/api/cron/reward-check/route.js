import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { queryCollection, getDocument, updateDocument } from '@/lib/firestoreRest'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

export async function GET(req) {
  // Security check
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get previous month date range (UTC)
  const now = new Date()
  const firstOfLastMonth = new Date(Date.UTC(
    now.getUTCMonth() === 0 ? now.getUTCFullYear() - 1 : now.getUTCFullYear(),
    now.getUTCMonth() === 0 ? 11 : now.getUTCMonth() - 1,
    1
  ))
  const firstOfThisMonth = new Date(Date.UTC(
    now.getUTCFullYear(), now.getUTCMonth(), 1
  ))
  const periodStart = Math.floor(firstOfLastMonth.getTime() / 1000)
  const periodEnd = Math.floor(firstOfThisMonth.getTime() / 1000)

  // List all active subscriptions
  const subscriptions = await stripe.subscriptions.list({
    status: 'active',
    limit: 100,
  })

  const results = []

  for (const sub of subscriptions.data) {
    // Look up stripeAccountId via Firestore (subscription metadata is unreliable —
    // the save-account-metadata endpoint fire-and-forget races with Connect completion)
    const subDoc = await queryCollection('subscriptions', 'stripeSubscriptionId', sub.id)
    if (!subDoc) {
      console.warn(`[reward-check] No subscriptions doc for ${sub.id} — skipping`)
      continue
    }
    const uid = subDoc.data.gardenerUid
    const userDoc = await getDocument('users', uid)
    if (!userDoc) {
      console.warn(`[reward-check] No users doc for uid=${uid} — skipping`)
      continue
    }
    const stripeAccountId = userDoc.data.stripeAccountId
    if (!stripeAccountId) {
      console.log(`[reward-check] ${uid} has no stripeAccountId (Connect not complete) — skipping`)
      continue
    }

    // Sum paid charges on connected account for previous month
    const charges = await stripe.charges.list(
      {
        created: { gte: periodStart, lt: periodEnd },
        limit: 100,
      },
      { stripeAccount: stripeAccountId }
    )

    const volume = charges.data
      .filter(c => c.paid && !c.refunded)
      .reduce((sum, c) => sum + c.amount, 0)

    const volumeDollars = volume / 100

    // Determine tier
    let tier = 'base'
    if (volumeDollars >= 3000) tier = 'free'
    else if (volumeDollars >= 1500) tier = 'half'

    // Read current streak from metadata
    const currentStreak = parseInt(sub.metadata?.rewardStreak || '0')
    const currentTierHeld = sub.metadata?.rewardTierHeld || 'base'

    let newStreak = 0
    let newTierHeld = tier

    if (tier !== 'base' && tier === currentTierHeld) {
      // Same tier held — increment streak
      newStreak = currentStreak + 1
    } else if (tier !== 'base') {
      // New tier reached — start streak at 1
      newStreak = 1
    } else {
      // Fell below threshold — reset
      newStreak = 0
      newTierHeld = 'base'
    }

    // Update metadata
    await stripe.subscriptions.update(sub.id, {
      metadata: {
        ...sub.metadata,
        rewardStreak: String(newStreak),
        rewardTierHeld: newTierHeld,
        lastVolumeCheck: firstOfLastMonth.toISOString().slice(0, 7),
        lastVolumeAmount: String(volumeDollars),
      },
    })

    // Write reward status to Firestore user doc so Settings can display it
    await updateDocument('users', uid, {
      rewardTier:       newTierHeld,
      rewardStreak:     newStreak,
      lastVolumeCheck:  firstOfLastMonth.toISOString().slice(0, 7),
      lastVolumeAmount: volumeDollars,
      updatedAt:        new Date().toISOString(),
    })

    // Apply discount at streak = 2.
    // Stripe 2025+ subscriptions use flexible billing mode which requires
    // `discounts: [{ coupon }]` instead of the legacy `coupon` parameter.
    if (newStreak >= 2) {
      const couponId = tier === 'free'
        ? 'YARDSYNC_FREE'
        : 'YARDSYNC_50OFF'

      // Read existing discounts (array in flexible mode, single object in legacy)
      const existingCouponIds = (sub.discounts || []).map(d => d?.coupon?.id).filter(Boolean)
      const legacyCouponId    = sub.discount?.coupon?.id
      const alreadyApplied    = existingCouponIds.includes(couponId) || legacyCouponId === couponId

      if (!alreadyApplied) {
        await stripe.subscriptions.update(sub.id, {
          discounts: [{ coupon: couponId }],
        })
      }
    }

    // If fell back below threshold, remove any active discount.
    // Note: in flexible billing mode, `update({ discounts: [] })` silently no-ops;
    // must use deleteDiscount to actually clear.
    const hasActiveDiscount = (sub.discounts && sub.discounts.length > 0) || !!sub.discount
    if (tier === 'base' && hasActiveDiscount) {
      await stripe.subscriptions.deleteDiscount(sub.id)
      await updateDocument('users', uid, {
        rewardTier:       'base',
        rewardStreak:     0,
        lastVolumeCheck:  firstOfLastMonth.toISOString().slice(0, 7),
        lastVolumeAmount: volumeDollars,
        updatedAt:        new Date().toISOString(),
      })
    }

    results.push({
      subscriptionId: sub.id,
      stripeAccountId,
      volumeDollars,
      tier,
      newStreak,
      couponApplied: newStreak >= 2 ? (tier === 'free' ? 'YARDSYNC_FREE' : 'YARDSYNC_50OFF') : null,
    })
  }

  console.log(`[reward-check] Processed ${results.length} subscriptions:`, JSON.stringify(results))
  return NextResponse.json({ processed: results.length, results })
}
