import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createDocument, getDocument } from '@/lib/firestoreRest'
import { sendClientEmail } from '@/lib/email'
import { getBaseUrl } from '@/lib/baseUrl'
import { computeInvoiceType } from '@/lib/stripeHelpers'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY || process.env.NEXT_PUBLIC_FIREBASE_API_KEY
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Verify the caller's Firebase ID token and return their uid (localId), or null.
// This is an unauthenticated-by-default route otherwise: without this, anyone
// who knows a connected-account ID could mint fee-bearing payment links that
// route funds to that account.
async function verifyCallerUid(req) {
  const auth = req.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) return null
  try {
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: auth.slice(7) }),
      }
    )
    if (!res.ok) return null
    const data = await res.json()
    return data.users?.[0]?.localId || null
  } catch {
    return null
  }
}

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

    // Auth: require a valid Firebase ID token whose uid matches gardenerUid, so
    // a caller can only mint payment links that route to their OWN account.
    const callerUid = await verifyCallerUid(req)
    if (!callerUid) {
      return NextResponse.json({ error: 'Unauthorized', code: 'unauthorized' }, { status: 401 })
    }
    if (!gardenerUid || callerUid !== gardenerUid) {
      return NextResponse.json({ error: 'Forbidden', code: 'forbidden' }, { status: 403 })
    }

    // Derive the connected account from the VERIFIED gardener's profile — never
    // trust a client-supplied account id, or a caller could mint a direct charge
    // on someone else's account. Require charges enabled so we fail clearly
    // instead of with a raw Stripe "card_payments not active" error.
    const gardenerDoc     = await getDocument('users', gardenerUid)
    const stripeAccountId = gardenerDoc?.data?.stripeAccountId
    // Direct charges need card_payments ACTIVE. Block when charges aren't
    // enabled, or when card_payments is explicitly inactive. (The field is
    // populated by the account.updated webhook; treat absent as "rely on
    // charges_enabled" so accounts that haven't re-synced since this change
    // aren't falsely locked out — Stripe still rejects the charge if it's
    // genuinely inactive.)
    const chargesEnabled    = gardenerDoc?.data?.stripeChargesEnabled === true
    const cardPaymentsActive = gardenerDoc?.data?.stripeCardPaymentsActive
    if (!stripeAccountId || !chargesEnabled || cardPaymentsActive === false) {
      return NextResponse.json({ error: 'Finish payment setup before sending invoices', code: 'no_connect' }, { status: 400 })
    }

    // Free-access model (docs/FREE_ACCESS_SPEC.md): a 'free_until_paid'
    // contractor must have a card on file before sending their first invoice.
    // This guarantees we can create + bill the $39/mo subscription when that
    // invoice is paid (the activation trigger). Already-active subscribers are
    // past this gate and skip it.
    const subStatus = gardenerDoc?.data?.subscriptionStatus
    if (subStatus === 'free_until_paid' && gardenerDoc?.data?.pmOnFile !== true) {
      return NextResponse.json({ error: 'Add a card on file to start invoicing', code: 'card_required' }, { status: 402 })
    }

    // Amount: when line items are provided, recompute the total server-side from
    // them (don't trust the client's total) and charge that; otherwise fall back
    // to the provided totalCents. Require a whole number of cents at/above
    // Stripe's 50¢ minimum so a tampered or buggy client can't charge a
    // mismatched / negative / fractional amount.
    const itemsTotal = Array.isArray(lineItems) && lineItems.length > 0
      ? lineItems.reduce((sum, it) => sum + (Number.isFinite(it?.amountCents) ? it.amountCents : 0), 0)
      : null
    const chargeCents = itemsTotal != null ? itemsTotal : totalCents
    if (!Number.isInteger(chargeCents) || chargeCents < 50) {
      return NextResponse.json({ error: 'Invoice total must be a whole number of cents ≥ 50', code: 'bad_total' }, { status: 400 })
    }
    if (itemsTotal != null && Number.isInteger(totalCents) && itemsTotal !== totalCents) {
      console.warn(`[invoice] client totalCents (${totalCents}) != sum(lineItems) (${itemsTotal}); charging server-computed total`)
    }
    if (clientEmail && !EMAIL_RE.test(clientEmail)) {
      return NextResponse.json({ error: 'Invalid client email', code: 'bad_email' }, { status: 400 })
    }

    const applicationFeeAmount = Math.round(chargeCents * 0.055)
    // Direct charge: the contractor also bears Stripe's processing fee
    // (≈2.9% + $0.30), so their take is the total minus our 5.5% AND minus the
    // Stripe fee. Estimated here for the "you receive" display at send time; the
    // webhook overwrites contractorReceives with the same formula on payment.
    const estStripeFee     = Math.round(chargeCents * 0.029) + 30
    const contractorNet    = Math.max(0, chargeCents - applicationFeeAmount - estStripeFee)

    // Step 1: Create Stripe PaymentIntent as a DIRECT CHARGE on the connected
    // account (the `stripeAccount` request option). See
    // docs/DIRECT_CHARGES_AND_RECEIPTS.md.
    //
    // The CONTRACTOR (connected account) is the merchant of record: the charge
    // settles on their account, the receipt + card statement are theirs, and
    // refund/dispute liability falls on them (ToS §5). YardSync takes its 5.5%
    // as application_fee_amount; Stripe's processing fee is borne by the
    // connected account. Requires card_payments active on the account (gated at
    // onboarding). NOTE: no transfer_data — that's for destination charges where
    // the platform is merchant of record (the model we moved away from).
    const paymentIntent = await stripe.paymentIntents.create(
      {
        amount: chargeCents,
        currency: 'usd',
        application_fee_amount: applicationFeeAmount,
        description: description || 'YardSync invoice',
        receipt_email: clientEmail || undefined,
        metadata: {
          gardenerUid,
          clientId,
          clientName: clientName || '',
          lineItemCount: String(lineItems?.length || 0),
        },
      },
      { stripeAccount: stripeAccountId }
    )

    const paymentUrl = `${getBaseUrl(req)}/pay/${paymentIntent.id}`

    // Step 2: Write invoice to Firestore server-side (authenticated as admin).
    // If this fails we'd have a live PaymentIntent the client could pay with NO
    // invoice record — the webhook could never reconcile it and the contractor's
    // history would be missing the charge. So cancel the PaymentIntent and fail
    // loudly rather than hand back an untracked payment link.
    try {
      const docId = await createDocument('invoices', {
        gardenerUid:           gardenerUid || '',
        clientId:              clientId || null,
        clientName:            clientName || '',
        clientEmail:           clientEmail || '',
        clientPhone:           clientPhone || '',
        totalCents:            chargeCents,
        stripePaymentIntentId: paymentIntent.id,
        // The connected account the PaymentIntent lives on (direct charge). The
        // pay page + webhook need this to retrieve the PI with the right
        // Stripe-Account context.
        stripeAccountId:       stripeAccountId,
        stripePaymentUrl:      paymentUrl,
        applicationFee:        applicationFeeAmount,
        contractorReceives:    contractorNet,
        status:                'sent',
        paymentPath:           'stripe',
        // Compute invoiceType from lineItem categories so a "recurring" client
        // sending an addon-only invoice (e.g., base covered by the recurring
        // plan, only extras/materials charged this visit) is correctly tagged
        // 'addon' rather than inheriting 'recurring' from the client schedule.
        // Caller can still override via the invoiceType param when needed
        // (walk-in invoices explicitly pass 'addon').
        invoiceType:           invoiceType || computeInvoiceType(lineItems),
        createdAt:             new Date().toISOString(),
        lineItems:             lineItems || [],
      })
      console.log('Invoice written to Firestore:', docId, 'PI:', paymentIntent.id)
    } catch (fsErr) {
      console.error('Firestore invoice write failed:', fsErr.message)
      try {
        await stripe.paymentIntents.cancel(paymentIntent.id)
      } catch (cancelErr) {
        console.error('PaymentIntent cancel after Firestore failure also failed:', cancelErr.message)
      }
      return NextResponse.json(
        { error: 'Could not save the invoice — please try again', code: 'invoice_write_failed' },
        { status: 500 }
      )
    }

    // Step 2.5: Email the client if we have an address and channel allows it.
    // Non-fatal: SendGrid issues are logged but never fail the request.
    const emailChannel = (channels || 'both') !== 'sms'
    const smsChannel   = (channels || 'both') !== 'email'
    if (emailChannel && clientEmail) {
      const tmpl = buildInvoiceEmail({
        clientName,
        totalCents: chargeCents,
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
      amount: chargeCents,
      applicationFee: applicationFeeAmount,
      contractorReceives: contractorNet,
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
