import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { doc, setDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

export async function POST(request) {
  const body      = await request.text()
  const signature = request.headers.get('stripe-signature')

  let event
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    )
  } catch (err) {
    console.error('Webhook signature error:', err.message)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const session     = event.data.object
  const gardenerUid = session.metadata?.gardenerUid || session.subscription_details?.metadata?.gardenerUid

  try {
    switch (event.type) {

      case 'checkout.session.completed': {
        if (!gardenerUid) break
        const subscriptionId = session.subscription
        const customerId     = session.customer

        const subscription = await stripe.subscriptions.retrieve(subscriptionId)
        const priceId      = subscription.items.data[0]?.price?.id
        const plan         = priceId === process.env.STRIPE_PRICE_ANNUAL ? 'annual' : 'monthly'

        await setDoc(
          doc(db, 'subscriptions', gardenerUid),
          {
            gardenerUid,
            stripeCustomerId:     customerId,
            stripeSubscriptionId: subscriptionId,
            stripePriceId:        priceId,
            plan,
            status:               'active',
            currentPeriodEnd:     new Date(subscription.current_period_end * 1000).toISOString(),
            createdAt:            new Date().toISOString(),
            updatedAt:            new Date().toISOString(),
          },
          { merge: true }
        )

        // Use setDoc with merge so it works even if user doc doesn't exist yet
        await setDoc(
          doc(db, 'users', gardenerUid),
          {
            subscriptionStatus: 'active',
            subscriptionPlan:   plan,
            stripeCustomerId:   customerId,
            updatedAt:          new Date().toISOString(),
          },
          { merge: true }
        )

        console.log(`Subscription activated for ${gardenerUid} — ${plan}`)
        break
      }

      case 'invoice.payment_succeeded': {
        const subscriptionId = session.subscription
        if (!subscriptionId) break

        const q    = query(collection(db, 'subscriptions'), where('stripeSubscriptionId', '==', subscriptionId))
        const snap = await getDocs(q)
        if (snap.empty) break

        const subDoc = snap.docs[0]
        const uid    = subDoc.data().gardenerUid

        const subscription = await stripe.subscriptions.retrieve(subscriptionId)
        await updateDoc(doc(db, 'subscriptions', uid), {
          status:           'active',
          currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
          updatedAt:        new Date().toISOString(),
        })

        await setDoc(
          doc(db, 'users', uid),
          { subscriptionStatus: 'active', updatedAt: new Date().toISOString() },
          { merge: true }
        )

        console.log(`Subscription renewed for ${uid}`)
        break
      }

      case 'invoice.payment_failed': {
        const subscriptionId = session.subscription
        if (!subscriptionId) break

        const q    = query(collection(db, 'subscriptions'), where('stripeSubscriptionId', '==', subscriptionId))
        const snap = await getDocs(q)
        if (snap.empty) break

        const subDoc = snap.docs[0]
        const uid    = subDoc.data().gardenerUid

        await updateDoc(doc(db, 'subscriptions', uid), {
          status:    'past_due',
          updatedAt: new Date().toISOString(),
        })

        await setDoc(
          doc(db, 'users', uid),
          { subscriptionStatus: 'past_due', updatedAt: new Date().toISOString() },
          { merge: true }
        )

        console.log(`Payment failed for ${uid}`)
        break
      }

      case 'customer.subscription.deleted': {
        const subscriptionId = session.id
        const q    = query(collection(db, 'subscriptions'), where('stripeSubscriptionId', '==', subscriptionId))
        const snap = await getDocs(q)
        if (snap.empty) break

        const subDoc = snap.docs[0]
        const uid    = subDoc.data().gardenerUid

        await updateDoc(doc(db, 'subscriptions', uid), {
          status:    'cancelled',
          updatedAt: new Date().toISOString(),
        })

        await setDoc(
          doc(db, 'users', uid),
          { subscriptionStatus: 'cancelled', updatedAt: new Date().toISOString() },
          { merge: true }
        )

        console.log(`Subscription cancelled for ${uid}`)
        break
      }
    }
  } catch (err) {
    console.error('Webhook handler error:', err)
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}