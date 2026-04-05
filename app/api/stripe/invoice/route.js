import { NextResponse } from 'next/server'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
const BASE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`

function toFirestoreValue(val) {
  if (val === null || val === undefined) return { nullValue: null }
  if (typeof val === 'string')  return { stringValue: val }
  if (typeof val === 'boolean') return { booleanValue: val }
  if (typeof val === 'number')  return Number.isInteger(val)
    ? { integerValue: String(val) }
    : { doubleValue: val }
  if (Array.isArray(val)) return {
    arrayValue: { values: val.map(toFirestoreValue) }
  }
  if (typeof val === 'object') return {
    mapValue: {
      fields: Object.fromEntries(
        Object.entries(val).map(([k, v]) => [k, toFirestoreValue(v)])
      )
    }
  }
  return { stringValue: String(val) }
}

export async function POST(req) {
  try {
    const {
      stripeAccountId,
      totalCents,
      lineItems,
      clientName,
      clientEmail,
      clientPhone,
      description,
      gardenerUid,
      clientId,
    } = await req.json()

    if (!stripeAccountId || !totalCents) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const applicationFeeAmount = Math.round(totalCents * 0.055)

    // Step 1: Create Stripe PaymentIntent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: totalCents,
      currency: 'usd',
      application_fee_amount: applicationFeeAmount,
      transfer_data: {
        destination: stripeAccountId,
      },
      description: description || 'YardSync lawn service invoice',
      receipt_email: clientEmail || undefined,
      metadata: {
        gardenerUid,
        clientId,
        clientName: clientName || '',
        lineItemCount: String(lineItems?.length || 0),
      },
    })

    const paymentUrl =
      `${process.env.NEXT_PUBLIC_APP_URL}/pay/${paymentIntent.id}`

    // Step 2: Write invoice to Firestore server-side via REST API
    const invoiceFields = {
      gardenerUid:           toFirestoreValue(gardenerUid || ''),
      clientId:              toFirestoreValue(clientId || null),
      clientName:            toFirestoreValue(clientName || ''),
      clientEmail:           toFirestoreValue(clientEmail || ''),
      clientPhone:           toFirestoreValue(clientPhone || ''),
      totalCents:            toFirestoreValue(totalCents),
      stripePaymentIntentId: toFirestoreValue(paymentIntent.id),
      stripePaymentUrl:      toFirestoreValue(paymentUrl),
      applicationFee:        toFirestoreValue(applicationFeeAmount),
      contractorReceives:    toFirestoreValue(totalCents - applicationFeeAmount),
      status:                toFirestoreValue('sent'),
      paymentPath:           toFirestoreValue('stripe'),
      createdAt:             toFirestoreValue(new Date().toISOString()),
      lineItems:             toFirestoreValue(lineItems || []),
    }

    const firestoreRes = await fetch(`${BASE_URL}/invoices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: invoiceFields }),
    })

    if (!firestoreRes.ok) {
      const errText = await firestoreRes.text()
      console.error('Firestore invoice write failed:', errText)
      // Don't fail the request — PaymentIntent exists, invoice can be reconciled
    } else {
      const created = await firestoreRes.json()
      const docId = created.name?.split('/').pop()
      console.log('Invoice written to Firestore:', docId, 'PI:', paymentIntent.id)
    }

    // Step 3: Return response
    return NextResponse.json({
      paymentIntentId: paymentIntent.id,
      clientSecret: paymentIntent.client_secret,
      paymentUrl,
      amount: totalCents,
      applicationFee: applicationFeeAmount,
      contractorReceives: totalCents - applicationFeeAmount,
    })
  } catch (err) {
    console.error('Stripe invoice error:', err)
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
