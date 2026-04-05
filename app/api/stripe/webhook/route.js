import { NextResponse } from 'next/server'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
const BASE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`

/* ────────────────────────────────────────────
   Firestore REST API helpers
   (bypass security rules — no auth needed)
   ──────────────────────────────────────────── */

function toFirestoreValue(val) {
  if (val === null || val === undefined) return { nullValue: null }
  if (typeof val === 'string')  return { stringValue: val }
  if (typeof val === 'boolean') return { booleanValue: val }
  if (typeof val === 'number')  return Number.isInteger(val)
    ? { integerValue: String(val) }
    : { doubleValue: val }
  return { stringValue: String(val) }
}

function fromFirestoreFields(fields) {
  const out = {}
  for (const [k, v] of Object.entries(fields)) {
    if ('stringValue'  in v) out[k] = v.stringValue
    else if ('booleanValue' in v) out[k] = v.booleanValue
    else if ('integerValue' in v) out[k] = Number(v.integerValue)
    else if ('doubleValue'  in v) out[k] = v.doubleValue
    else if ('nullValue'    in v) out[k] = null
    else out[k] = v
  }
  return out
}

// Query a collection with a single field == value filter
async function queryCollection(collectionId, fieldPath, value) {
  const url = `${BASE_URL}:runQuery`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId }],
        where: {
          fieldFilter: {
            field: { fieldPath },
            op: 'EQUAL',
            value: { stringValue: value }
          }
        },
        limit: 1
      }
    })
  })
  const data = await res.json()
  const doc = data[0]?.document
  if (!doc) return null
  // Extract doc ID from the full name path
  const parts = doc.name.split('/')
  const id = parts[parts.length - 1]
  return { id, name: doc.name, data: fromFirestoreFields(doc.fields || {}) }
}

// Get a single document by collection/docId
async function getDoc(collectionId, docId) {
  const url = `${BASE_URL}/${collectionId}/${docId}`
  const res = await fetch(url)
  if (!res.ok) return null
  const doc = await res.json()
  if (!doc.fields) return null
  return { id: docId, name: doc.name, data: fromFirestoreFields(doc.fields) }
}

// Set (create/merge) a document — uses PATCH with updateMask for merge behavior
async function setDoc(collectionId, docId, fields) {
  const fieldPaths = Object.keys(fields).map(k => `updateMask.fieldPaths=${k}`).join('&')
  const url = `${BASE_URL}/${collectionId}/${docId}?${fieldPaths}`

  const firestoreFields = {}
  for (const [key, value] of Object.entries(fields)) {
    firestoreFields[key] = toFirestoreValue(value)
  }

  const res = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: firestoreFields })
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`Firestore PATCH ${collectionId}/${docId} failed (${res.status}): ${errText}`)
  }
}

// Update a document (alias for setDoc since PATCH with updateMask is merge)
async function updateDoc(collectionId, docId, fields) {
  return setDoc(collectionId, docId, fields)
}


/* ────────────────────────────────────────────
   Webhook handler
   ──────────────────────────────────────────── */

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

        await setDoc('subscriptions', gardenerUid, {
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

        await setDoc('users', gardenerUid, {
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
          const userDoc = await getDoc('users', gardenerUid)
          if (userDoc) {
            gardenerName  = userDoc.data.name || 'Unknown'
            gardenerEmail = userDoc.data.email || session.customer_email || ''
          }
        } catch { /* best-effort */ }

        await setDoc('users', gardenerUid, {
          setupFeePaid:     true,
          setupPaidAt:      new Date().toISOString(),
          setupContacted:   false,
          setupContactedAt: null,
          setupNotes:       '',
        })

        console.log(`Setup package purchased by ${gardenerUid}`)

        // SMS alert to admin — fail silently if ADMIN_PHONE_NUMBER not set
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
            await updateDoc('subscriptions', uid, {
              status:           'active',
              currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
              updatedAt:        new Date().toISOString(),
            })

            await setDoc('users', uid, {
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
            await updateDoc('invoices', invDoc.id, {
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

        await updateDoc('subscriptions', uid, {
          status:    'past_due',
          updatedAt: new Date().toISOString(),
        })

        await setDoc('users', uid, {
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
          await setDoc('users', userDoc.id, {
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

        await updateDoc('subscriptions', uid, {
          status:    'canceled',
          updatedAt: new Date().toISOString(),
        })

        await setDoc('users', uid, {
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

        // Find matching invoice by stripePaymentIntentId
        const invDoc = await queryCollection('invoices', 'stripePaymentIntentId', pi.id)
        console.log('Invoice query result – empty:', !invDoc, 'searching for:', pi.id)

        if (invDoc) {
          await updateDoc('invoices', invDoc.id, {
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
