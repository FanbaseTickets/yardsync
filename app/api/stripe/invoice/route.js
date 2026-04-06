import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createDocument, toFirestoreValue } from '@/lib/firestoreRest'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

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
      invoiceType,
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

    // Step 2: Write invoice to Firestore server-side (authenticated as admin)
    try {
      const docId = await createDocument('invoices', {
        gardenerUid:           gardenerUid || '',
        clientId:              clientId || null,
        clientName:            clientName || '',
        clientEmail:           clientEmail || '',
        clientPhone:           clientPhone || '',
        totalCents:            totalCents,
        stripePaymentIntentId: paymentIntent.id,
        stripePaymentUrl:      paymentUrl,
        applicationFee:        applicationFeeAmount,
        contractorReceives:    totalCents - applicationFeeAmount,
        status:                'sent',
        paymentPath:           'stripe',
        invoiceType:           invoiceType || 'recurring',
        createdAt:             new Date().toISOString(),
        lineItems:             lineItems || [],
      })
      console.log('Invoice written to Firestore:', docId, 'PI:', paymentIntent.id)
    } catch (fsErr) {
      console.error('Firestore invoice write failed:', fsErr.message)
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
