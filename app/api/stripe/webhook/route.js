import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { queryCollection, getDocument, setDocument, updateDocument } from '@/lib/firestoreRest'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

export async function POST(request) {
  console.log('Webhook received:', request.headers.get('stripe-signature') ? 'has signature' : 'no signature')
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

  console.log('Webhook event type:', event.type)
  const session     = event.data.object
  const gardenerUid = session.metadata?.gardenerUid || session.subscription_details?.metadata?.gardenerUid

  try {
    switch (event.type) {

      /* ── checkout.session.completed ─────────────── */
      case 'checkout.session.completed': {
        if (!gardenerUid) {
          console.error('Webhook: No gardenerUid found in session metadata – skipping write')
          break
        }

        const subscriptionId = session.subscription
        const customerId     = session.customer

        const subscription = await stripe.subscriptions.retrieve(subscriptionId)
        const priceId      = subscription.items.data[0]?.price?.id
        const plan         = priceId === process.env.STRIPE_PRICE_ANNUAL ? 'annual' : 'monthly'

        await setDocument('subscriptions', gardenerUid, {
          gardenerUid,
          stripeCustomerId:     customerId,
          stripeSubscriptionId: subscriptionId,
          stripePriceId:        priceId,
          plan,
          status:               'active',
          currentPeriodEnd:     new Date(subscription.current_period_end * 1000).toISOString(),
          createdAt:            new Date().toISOString(),
          updatedAt:            new Date().toISOString(),
        })

        await setDocument('users', gardenerUid, {
          subscriptionStatus:   'active',
          subscriptionPlan:     plan,
          stripeCustomerId:     customerId,
          stripeSubscriptionId: subscriptionId,
          updatedAt:            new Date().toISOString(),
        })

        console.log('webhook write complete', { uid: gardenerUid, stripeSubscriptionId: subscriptionId })
        console.log(`Subscription activated for ${gardenerUid} – ${plan}`)

        // Look up gardener name + email for SMS alert
        let gardenerName  = ''
        let gardenerEmail = ''
        try {
          const userDoc = await getDocument('users', gardenerUid)
          if (userDoc) {
            gardenerName  = userDoc.data.name || 'Unknown'
            gardenerEmail = userDoc.data.email || session.customer_email || ''
          }
        } catch { /* best-effort */ }

        await setDocument('users', gardenerUid, {
          setupFeePaid:     true,
          setupPaidAt:      new Date().toISOString(),
          setupContacted:   false,
          setupContactedAt: null,
          setupNotes:       '',
        })

        console.log(`Setup package purchased by ${gardenerUid}`)

        // SMS alert to admin
        const adminPhone = process.env.ADMIN_PHONE_NUMBER
        if (adminPhone) {
          try {
            const twilioSid   = process.env.TWILIO_ACCOUNT_SID
            const twilioToken = process.env.TWILIO_AUTH_TOKEN
            const twilioFrom  = process.env.TWILIO_PHONE_NUMBER
            const digits      = adminPhone.replace(/\D/g, '')
            const to          = digits.startsWith('1') ? `+${digits}` : `+1${digits}`
            const smsBody     = new URLSearchParams({
              To:   to,
              From: twilioFrom,
              Body: `New YardSync setup purchase – ${gardenerName} (${gardenerEmail}). Log in to admin: https://yardsync.vercel.app/admin`,
            })
            await fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`, {
              method:  'POST',
              headers: {
                'Content-Type':  'application/x-www-form-urlencoded',
                'Authorization': 'Basic ' + Buffer.from(`${twilioSid}:${twilioToken}`).toString('base64'),
              },
              body: smsBody.toString(),
            })
            console.log('Admin SMS sent')
          } catch (smsErr) {
            console.error('SMS alert failed:', smsErr.message)
          }
        }

        break
      }

      /* ── invoice.payment_succeeded ──────────────── */
      case 'invoice.payment_succeeded': {
        console.log('invoice.payment_succeeded fired:', { subscription: session.subscription, payment_intent: session.payment_intent })

        // Handle subscription renewal
        const subscriptionId = session.subscription
        if (subscriptionId) {
          const subDoc = await queryCollection('subscriptions', 'stripeSubscriptionId', subscriptionId)
          if (subDoc) {
            const uid = subDoc.data.gardenerUid
            const subscription = await stripe.subscriptions.retrieve(subscriptionId)
            await updateDocument('subscriptions', uid, {
              status:           'active',
              currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
              updatedAt:        new Date().toISOString(),
            })
            await setDocument('users', uid, {
              subscriptionStatus: 'active',
              updatedAt:          new Date().toISOString(),
            })
            console.log(`Subscription renewed for ${uid}`)
          }
        }

        // Also check if this is a Connect invoice payment
        const piId = session.payment_intent
        if (piId) {
          const invDoc = await queryCollection('invoices', 'stripePaymentIntentId', piId)
          console.log('Invoice query result – empty:', !invDoc, 'searching for:', piId)
          if (invDoc) {
            await updateDocument('invoices', invDoc.id, {
              status:    'paid',
              paidAt:    new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            })
            console.log(`Invoice ${invDoc.id} marked paid via PaymentIntent ${piId}`)
          } else {
            console.log('No invoice found for PaymentIntent:', piId)
          }
        }
        break
      }

      /* ── invoice.payment_failed ─────────────────── */
      case 'invoice.payment_failed': {
        const subscriptionId = session.subscription
        if (!subscriptionId) break

        const subDoc = await queryCollection('subscriptions', 'stripeSubscriptionId', subscriptionId)
        if (!subDoc) break

        const uid = subDoc.data.gardenerUid

        await updateDocument('subscriptions', uid, {
          status:    'past_due',
          updatedAt: new Date().toISOString(),
        })
        await setDocument('users', uid, {
          subscriptionStatus: 'past_due',
          updatedAt:          new Date().toISOString(),
        })

        console.log(`Payment failed for ${uid}`)
        break
      }

      /* ── customer.subscription.updated ──────────── */
      case 'customer.subscription.updated': {
        const subscription = event.data.object
        const customerId   = subscription.customer
        const userDoc      = await queryCollection('users', 'stripeCustomerId', customerId)
        if (userDoc) {
          const priceId = subscription.items.data[0]?.price?.id
          const plan    = priceId === process.env.STRIPE_PRICE_ANNUAL ? 'annual' : 'monthly'
          await setDocument('users', userDoc.id, {
            subscriptionPlan:   plan,
            subscriptionStatus: subscription.status,
            updatedAt:          new Date().toISOString(),
          })
          console.log(`Subscription updated for ${userDoc.id}`)
        }
        break
      }

      /* ── customer.subscription.deleted ──────────── */
      case 'customer.subscription.deleted': {
        const subscriptionId = session.id
        const subDoc = await queryCollection('subscriptions', 'stripeSubscriptionId', subscriptionId)
        if (!subDoc) break

        const uid = subDoc.data.gardenerUid

        await updateDocument('subscriptions', uid, {
          status:    'canceled',
          updatedAt: new Date().toISOString(),
        })
        await setDocument('users', uid, {
          subscriptionStatus: 'canceled',
          updatedAt:          new Date().toISOString(),
        })

        console.log(`Subscription canceled for ${uid}`)
        break
      }

      /* ── payment_intent.succeeded ───────────────── */
      case 'payment_intent.succeeded': {
        const pi = event.data.object
        console.log('payment_intent.succeeded fired:', { id: pi.id, gardenerUid: pi.metadata?.gardenerUid })

        const invDoc = await queryCollection('invoices', 'stripePaymentIntentId', pi.id)
        console.log('Invoice query result – empty:', !invDoc, 'searching for:', pi.id)

        if (invDoc) {
          await updateDocument('invoices', invDoc.id, {
            status:    'paid',
            paidAt:    new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          })
          console.log(`Invoice ${invDoc.id} marked paid via PaymentIntent ${pi.id}`)
        } else {
          console.log('No invoice found for PaymentIntent:', pi.id)
        }
        break
      }
    }
  } catch (err) {
    console.error('Webhook handler error:', err.message, err.stack)
    return NextResponse.json({ error: 'Webhook handler failed', message: err.message }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
