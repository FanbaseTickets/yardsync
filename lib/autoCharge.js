// lib/autoCharge.js
// AUTO-CHARGE engine: charge a client's saved card off-session for a recurring
// visit, on the contractor's connected account (direct charge). Falls back to a
// payment link if the card declines or needs authentication (3DS).
//
// Safety: writes the invoice doc BEFORE confirming the charge, so the connect
// webhook's payment_intent.succeeded always finds it to reconcile (mark paid,
// activation, completedJobsCount). Idempotency (one charge per visit) is the
// CALLER's job — claim the schedule before calling this.

import Stripe from 'stripe'
import { createDocument, updateDocument, listCollection } from '@/lib/firestoreRest'
import { formatDate } from '@/lib/date'
import { grossUpForFees, calcApplicationFee } from '@/lib/fee'
import { computeInvoiceType } from '@/lib/stripeHelpers'
import { buildInvoiceSms } from '@/lib/invoiceSms'
import { sendSms } from '@/lib/sms'
import { sendClientEmail } from '@/lib/email'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

// Build the line items for a recurring auto-charge: the client's recurring base
// price + any per-visit extras/materials on the schedule doc.
function buildLineItems(client, visit) {
  const items = []
  const baseCents = client.basePriceCents || 0
  if (baseCents > 0) items.push({ label: client.packageLabel || 'Recurring service', amountCents: baseCents, category: 'base' })
  for (const a of (visit.addons || [])) items.push({ label: a.label, amountCents: a.amountCents || 0, category: 'addon' })
  for (const m of (visit.materials || [])) items.push({ label: m.name, amountCents: m.totalCents || 0, category: 'material' })
  return items
}

/**
 * Cancel a client's recurring auto-billing: turn it off and mark all upcoming
 * not-yet-charged visits cancelled so the charge cron skips them. Shared by the
 * inbound-SMS CANCEL handler and the email cancel link.
 */
export async function cancelClientAutoBilling(clientId) {
  await updateDocument('clients', clientId, {
    autoBilling:            false,
    autoBillingCancelledAt: new Date().toISOString(),
    updatedAt:              new Date().toISOString(),
  })
  try {
    const today = formatDate(new Date())
    const ups = await listCollection('schedules', { where: [
      { field: 'clientId', value: clientId },
      { field: 'status',   value: 'scheduled' },
    ] })
    for (const s of ups) {
      const d = s.data || {}
      // Only future, not-yet-claimed/charged visits — never touch a charged one.
      if (!d.autoChargedAt && !d.autoChargeCancelledAt && (d.serviceDate || '') >= today) {
        await updateDocument('schedules', s.id, { autoChargeCancelledAt: new Date().toISOString() })
      }
    }
  } catch (e) {
    console.error('[cancelClientAutoBilling] schedule sweep failed:', e.message)
  }
}

/**
 * Charge a client's card-on-file for one recurring visit.
 * @returns one of:
 *   { ok:true, charged:true,  invoiceId, piId, billedCents }   — card charged
 *   { ok:true, charged:false, fallback:true, invoiceId, piId, billedCents, code } — declined/3DS → payment link sent
 *   { ok:false, code }  — 'no_amount' | 'no_card' | 'no_connect' | 'error'
 */
export async function chargeClientForVisit({ contractor, gardenerUid, client, clientId, visit, baseUrl }) {
  // ── Gates ──────────────────────────────────────────────
  // ⚠️ INVARIANT (load-bearing): 'no_connect' and 'no_card' MUST only ever be
  // returned from HERE — BEFORE any PaymentIntent is created. The cron treats
  // them as safe-to-retry and CLEARS the visit's claim so it re-charges next day.
  // If a post-charge path ever returned these codes, clearing the claim would
  // re-charge an already-charged card. Keep these returns pre-PI-creation.
  const stripeAccountId = contractor?.stripeAccountId
  const chargesEnabled  = contractor?.stripeChargesEnabled === true
  const cardPaymentsActive = contractor?.stripeCardPaymentsActive
  if (!stripeAccountId || !chargesEnabled || cardPaymentsActive === false) {
    return { ok: false, code: 'no_connect' }
  }
  const customerId = client?.clientStripeCustomerId
  const pmId       = client?.clientPaymentMethodId
  if (!customerId || !pmId) return { ok: false, code: 'no_card' }

  // ── Amount + fee math (mirrors app/api/stripe/invoice/route.js) ──
  const lineItems  = buildLineItems(client, visit)
  const totalCents = lineItems.reduce((s, it) => s + (Number.isInteger(it.amountCents) ? it.amountCents : 0), 0)
  if (!Number.isInteger(totalCents) || totalCents < 50) return { ok: false, code: 'no_amount' }

  const coverFees   = (client.coverFees ?? contractor.coverFees) === true
  const listedPriceCents = totalCents
  const billedCents = coverFees ? grossUpForFees(listedPriceCents) : totalCents
  const applicationFeeAmount = calcApplicationFee(billedCents)
  const estStripeFee  = Math.round(billedCents * 0.029) + 30
  const contractorNet = Math.max(0, billedCents - applicationFeeAmount - estStripeFee)
  const contractorName = contractor.businessName || contractor.displayName || ''

  try {
    // 1) Create the PaymentIntent UNCONFIRMED (so we can write the doc first).
    const pi = await stripe.paymentIntents.create(
      {
        amount: billedCents,
        currency: 'usd',
        customer: customerId,
        payment_method: pmId,
        application_fee_amount: applicationFeeAmount,
        confirm: false,
        description: `${contractorName || 'YardSync'} — recurring service`,
        metadata: {
          gardenerUid, clientId,
          clientName: client.name || '',
          autoCharge: 'true',
          scheduleId: visit.id || '',
          feesCovered: coverFees ? 'true' : 'false',
        },
      },
      { stripeAccount: stripeAccountId }
    )

    const paymentUrl = `${baseUrl}/pay/${pi.id}`

    // 2) Write the invoice doc BEFORE confirming (webhook-reconcile race guard).
    let invoiceId
    try {
      invoiceId = await createDocument('invoices', {
        gardenerUid:           gardenerUid || '',
        clientId:              clientId || null,
        clientName:            client.name || '',
        clientEmail:           client.email || '',
        clientPhone:           client.phone || '',
        totalCents:            billedCents,
        feesCovered:           coverFees,
        listedPriceCents:      listedPriceCents,
        stripePaymentIntentId: pi.id,
        stripeAccountId:       stripeAccountId,
        stripePaymentUrl:      paymentUrl,
        applicationFee:        applicationFeeAmount,
        contractorReceives:    contractorNet,
        status:                'sent',
        paymentPath:           'stripe',
        source:                'auto_charge',
        invoiceType:           computeInvoiceType(lineItems),
        createdAt:             new Date().toISOString(),
        lineItems,
      })
    } catch (fsErr) {
      console.error('[autoCharge] invoice doc write failed, cancelling PI:', fsErr.message)
      try { await stripe.paymentIntents.cancel(pi.id, { stripeAccount: stripeAccountId }) } catch {}
      return { ok: false, code: 'error' }
    }

    // 3) Confirm OFF-SESSION (merchant-initiated). Treat BOTH a throw AND any
    //    non-'succeeded' status as a failed charge — never assume "didn't throw
    //    == charged". On real success the connect webhook marks the invoice paid.
    let failCode = null
    try {
      const confirmed = await stripe.paymentIntents.confirm(pi.id, { off_session: true }, { stripeAccount: stripeAccountId })
      if (confirmed?.status === 'succeeded') {
        return { ok: true, charged: true, invoiceId, piId: pi.id, billedCents }
      }
      failCode = confirmed?.status || 'not_succeeded'
    } catch (confirmErr) {
      failCode = confirmErr?.code || 'card_declined'
    }

    // FALLBACK: the off-session charge didn't go through (decline / 3DS / other).
    // The FAILED off_session PI has the declined PM attached and is NOT reliably
    // payable on /pay, so mint a FRESH unconfirmed PI exactly like a manual
    // invoice (no PM — the client enters any card), repoint the invoice doc at
    // it, cancel the dead PI, and send the payment link.
    let payUrl = paymentUrl
    let payPiId = pi.id
    try {
      const fresh = await stripe.paymentIntents.create(
        {
          amount: billedCents,
          currency: 'usd',
          application_fee_amount: applicationFeeAmount,
          description: `${contractorName || 'YardSync'} — recurring service`,
          receipt_email: client.email || undefined,
          metadata: { gardenerUid, clientId, clientName: client.name || '', autoCharge: 'fallback', scheduleId: visit.id || '', feesCovered: coverFees ? 'true' : 'false' },
        },
        { stripeAccount: stripeAccountId }
      )
      payPiId = fresh.id
      payUrl  = `${baseUrl}/pay/${fresh.id}`
      await updateDocument('invoices', invoiceId, { stripePaymentIntentId: fresh.id, stripePaymentUrl: payUrl, updatedAt: new Date().toISOString() })
      try { await stripe.paymentIntents.cancel(pi.id, { stripeAccount: stripeAccountId }) } catch {}
    } catch (e) {
      console.error('[autoCharge] fresh fallback PI failed; original PI left in place:', e.message)
    }

    const lang = (client.language === 'es') ? 'es' : 'en'
    try {
      if (client.phone) {
        const body = buildInvoiceSms({ client, contractor, totalCents: billedCents, paymentUrl: payUrl, lang })
        await sendSms({ to: client.phone, body, context: 'auto_charge_fallback', refIds: { gardenerUid, clientId } })
      }
      if (client.email) {
        const amount = `$${(billedCents / 100).toFixed(2)}`
        await sendClientEmail({
          to: client.email,
          subject: lang === 'es' ? `Factura de ${contractorName || 'tu servicio'} — ${amount}` : `Invoice from ${contractorName || 'your service'} — ${amount}`,
          text: lang === 'es'
            ? `Hola ${client.name || ''},\n\nNo pudimos cobrar tu tarjeta automáticamente. Paga aquí: ${payUrl}`
            : `Hi ${client.name || ''},\n\nWe couldn't charge your card automatically. Pay here: ${payUrl}`,
          html: `<p>${lang === 'es' ? `No pudimos cobrar tu tarjeta automáticamente.` : `We couldn't charge your card automatically.`}</p><p><a href="${payUrl}">${lang === 'es' ? 'Pagar ahora' : 'Pay now'}</a></p>`,
          fromName: contractorName || 'YardSync',
        })
      }
    } catch (e) { console.error('[autoCharge] fallback link send failed:', e.message) }
    console.warn(`[autoCharge] off-session charge failed (${failCode}) for client ${clientId} — sent payment link fallback`)
    return { ok: true, charged: false, fallback: true, invoiceId, piId: payPiId, billedCents, code: failCode }
  } catch (err) {
    console.error('[autoCharge] failed:', err.message)
    return { ok: false, code: 'error', error: err.message }
  }
}
