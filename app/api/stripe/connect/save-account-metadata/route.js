import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { getDocument } from '@/lib/firestoreRest'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2026-02-25.clover' })

// Retry the users/{uid} read until stripeSubscriptionId is present.
// The webhook that writes stripeSubscriptionId (checkout.session.completed)
// runs asynchronously after Stripe Checkout — if the contractor completes
// Connect onboarding fast, the webhook may not have fired yet.
// 500ms → 1s → 2s → 4s → 8s = ~15.5s worst case across 5 attempts.
async function getUserWithSubscription(uid, maxAttempts = 5) {
  for (let i = 0; i < maxAttempts; i++) {
    const userDoc = await getDocument('users', uid)
    const subId = userDoc?.data?.stripeSubscriptionId
    if (subId) return userDoc

    if (i < maxAttempts - 1) {
      const delay = Math.pow(2, i) * 500
      console.log(`[save-account-metadata] stripeSubscriptionId not yet written, retry ${i + 1}/${maxAttempts} in ${delay}ms`)
      await new Promise(r => setTimeout(r, delay))
    }
  }
  return await getDocument('users', uid)
}

export async function POST(req) {
  try {
    const body = await req.json()
    console.log('[save-account-metadata] called, body:', JSON.stringify(body))

    const { uid } = body
    if (!uid) {
      return NextResponse.json({ error: 'Missing uid' }, { status: 400 })
    }

    const userDoc = await getUserWithSubscription(uid)
    console.log('[save-account-metadata] User doc found:', !!userDoc, 'fields:', Object.keys(userDoc?.data || {}))

    const stripeSubscriptionId = userDoc?.data?.stripeSubscriptionId
    const stripeAccountId      = userDoc?.data?.stripeAccountId
    console.log('[save-account-metadata] stripeSubscriptionId:', stripeSubscriptionId || 'MISSING')
    console.log('[save-account-metadata] stripeAccountId:',      stripeAccountId      || 'MISSING')

    if (!userDoc || !stripeSubscriptionId) {
      console.warn('[save-account-metadata] stripeSubscriptionId not available after retries — skipping metadata write')
      return NextResponse.json(
        { status: 'skipped', reason: 'stripeSubscriptionId not yet available' },
        { status: 202 }
      )
    }

    if (!stripeAccountId) {
      console.warn('[save-account-metadata] stripeAccountId not in user doc — may not be written yet')
      return NextResponse.json(
        { status: 'skipped', reason: 'stripeAccountId not yet available' },
        { status: 202 }
      )
    }

    console.log('[save-account-metadata] Updating Stripe sub metadata, subId:', stripeSubscriptionId, 'accountId:', stripeAccountId)
    await stripe.subscriptions.update(stripeSubscriptionId, {
      metadata: { stripeAccountId },
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[save-account-metadata] error:', err.message, err.stack)
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
