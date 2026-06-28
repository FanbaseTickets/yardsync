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
import { createDocument } from '@/lib/firestoreRest'
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
 * Charge a client's card-on-file for one recurring visit.
 * @returns one of:
 *   { ok:true, charged:true,  invoiceId, piId, billedCents }   — card charged
 *   { ok:true, charged:false, fallback:true, invoiceId, piId, billedCents, code } — declined/3DS → payment link sent
 *   { ok:false, code }  — 'no_amount' | 'no_card' | 'no_connect' | 'error'
 */
export async function chargeClientForVisit({ contractor, gardenerUid, client, clientId, visit, baseUrl }) {
  // ── Gates ──────────────────────────────────────────────
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

    // 3) Confirm OFF-SESSION (merchant-initiated). Success → webhook marks it paid.
    try {
      await stripe.paymentIntents.confirm(pi.id, { off_session: true }, { stripeAccount: stripeAccountId })
      return { ok: true, charged: true, invoiceId, piId: pi.id, billedCents }
    } catch (confirmErr) {
      // Declined / needs authentication (3DS) / etc. The invoice stays 'sent'
      // with a live payment link — send it to the client so they can pay (and
      // complete any auth) manually. The PI can be paid via /pay.
      const code = confirmErr?.code || 'card_declined'
      const lang = (client.language === 'es') ? 'es' : 'en'
      try {
        if (client.phone) {
          const body = buildInvoiceSms({ client, contractor, totalCents: billedCents, paymentUrl, lang })
          await sendSms({ to: client.phone, body, context: 'auto_charge_fallback', refIds: { gardenerUid, clientId } })
        }
        if (client.email) {
          const amount = `$${(billedCents / 100).toFixed(2)}`
          await sendClientEmail({
            to: client.email,
            subject: lang === 'es' ? `Factura de ${contractorName || 'tu servicio'} — ${amount}` : `Invoice from ${contractorName || 'your service'} — ${amount}`,
            text: lang === 'es'
              ? `Hola ${client.name || ''},\n\nNo pudimos cobrar tu tarjeta automáticamente. Paga aquí: ${paymentUrl}`
              : `Hi ${client.name || ''},\n\nWe couldn't charge your card automatically. Pay here: ${paymentUrl}`,
            html: `<p>${lang === 'es' ? `No pudimos cobrar tu tarjeta automáticamente.` : `We couldn't charge your card automatically.`}</p><p><a href="${paymentUrl}">${lang === 'es' ? 'Pagar ahora' : 'Pay now'}</a></p>`,
            fromName: contractorName || 'YardSync',
          })
        }
      } catch (e) { console.error('[autoCharge] fallback link send failed:', e.message) }
      console.warn(`[autoCharge] off-session charge failed (${code}) for client ${clientId} — sent payment link fallback`)
      return { ok: true, charged: false, fallback: true, invoiceId, piId: pi.id, billedCents, code }
    }
  } catch (err) {
    console.error('[autoCharge] failed:', err.message)
    return { ok: false, code: 'error', error: err.message }
  }
}
