import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createDocument } from '@/lib/firestoreRest'
import { sendClientEmail } from '@/lib/email'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

function buildInvoiceEmail({ clientName, totalCents, paymentUrl, contractorName, lang }) {
  const amount = `$${(totalCents / 100).toFixed(2)}`
  const name = clientName || (lang === 'es' ? 'Cliente' : 'Client')
  const from = contractorName || 'YardSync'
  if (lang === 'es') {
    return {
      subject: `Factura de ${from} — ${amount}`,
      text: `Hola ${name},\n\nTu factura de ${amount} de ${from} está lista.\n\nPaga aquí: ${paymentUrl}\n\nGracias,\n${from} vía YardSync`,
      html: `
        <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 520px; margin: 0 auto; color: #111;">
          <h2 style="color: #0E7C66; margin: 0 0 16px;">${from}</h2>
          <p>Hola ${name},</p>
          <p>Tu factura de <strong>${amount}</strong> está lista.</p>
          <p style="margin: 24px 0;">
            <a href="${paymentUrl}" style="background: #0E7C66; color: #fff; padding: 12px 20px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600;">Pagar ahora</a>
          </p>
          <p style="color: #666; font-size: 12px;">O copia este enlace: ${paymentUrl}</p>
          <p style="color: #666; font-size: 12px; margin-top: 32px;">${from} vía YardSync</p>
        </div>`,
    }
  }
  return {
    subject: `Invoice from ${from} — ${amount}`,
    text: `Hi ${name},\n\nYour invoice for ${amount} from ${from} is ready.\n\nPay here: ${paymentUrl}\n\nThanks,\n${from} via YardSync`,
    html: `
      <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 520px; margin: 0 auto; color: #111;">
        <h2 style="color: #0E7C66; margin: 0 0 16px;">${from}</h2>
        <p>Hi ${name},</p>
        <p>Your invoice for <strong>${amount}</strong> is ready.</p>
        <p style="margin: 24px 0;">
          <a href="${paymentUrl}" style="background: #0E7C66; color: #fff; padding: 12px 20px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600;">Pay now</a>
        </p>
        <p style="color: #666; font-size: 12px;">Or copy this link: ${paymentUrl}</p>
        <p style="color: #666; font-size: 12px; margin-top: 32px;">${from} via YardSync</p>
      </div>`,
  }
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
      invoiceType,
      contractorName,
      contractorEmail,
      lang,
      channels,
    } = await req.json()

    if (!stripeAccountId) {
      return NextResponse.json({ error: 'Stripe Connect not completed', code: 'no_connect' }, { status: 400 })
    }
    if (!totalCents) {
      return NextResponse.json({ error: 'Invoice total is required', code: 'no_total' }, { status: 400 })
    }

    const applicationFeeAmount = Math.round(totalCents * 0.055)

    // Step 1: Create Stripe PaymentIntent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: totalCents,
      currency: 'usd',
      application_fee_amount: applicationFeeAmount,
      transfer_data: { destination: stripeAccountId },
      description: description || 'YardSync lawn service invoice',
      receipt_email: clientEmail || undefined,
      metadata: {
        gardenerUid,
        clientId,
        clientName: clientName || '',
        lineItemCount: String(lineItems?.length || 0),
      },
    })

    const paymentUrl = `${process.env.NEXT_PUBLIC_APP_URL}/pay/${paymentIntent.id}`

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

    // Step 2.5: Email the client if we have an address and channel allows it.
    // Non-fatal: SendGrid issues are logged but never fail the request.
    const emailChannel = (channels || 'both') !== 'sms'
    const smsChannel   = (channels || 'both') !== 'email'
    if (emailChannel && clientEmail) {
      const tmpl = buildInvoiceEmail({
        clientName,
        totalCents,
        paymentUrl,
        contractorName,
        lang: lang === 'es' ? 'es' : 'en',
      })
      await sendClientEmail({
        to:       clientEmail,
        subject:  tmpl.subject,
        html:     tmpl.html,
        text:     tmpl.text,
        replyTo:  contractorEmail || undefined,
        fromName: contractorName || 'YardSync',
      })
    }

    // Step 3: Return response
    return NextResponse.json({
      paymentIntentId: paymentIntent.id,
      clientSecret: paymentIntent.client_secret,
      paymentUrl,
      amount: totalCents,
      applicationFee: applicationFeeAmount,
      contractorReceives: totalCents - applicationFeeAmount,
      emailNotified: !!(emailChannel && clientEmail),
      smsRequested:  !!smsChannel,
    })
  } catch (err) {
    console.error('Stripe invoice error:', err)
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
