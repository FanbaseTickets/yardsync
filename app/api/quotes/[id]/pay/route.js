import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { getDocument, updateDocument, createDocument, queryCollection } from '@/lib/firestoreRest'
import { getBaseUrl } from '@/lib/baseUrl'
import { calcApplicationFee } from '@/lib/fee'
import { sendSms } from '@/lib/sms'
import { sendClientEmail } from '@/lib/email'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2026-02-25.clover' })

// POST /api/quotes/[id]/pay — public. Body { mode:'deposit'|'full', notify?:bool }.
// The SINGLE charge-creating endpoint for a quote. 'deposit' charges the
// configured deposit; 'full' charges the entire REMAINING balance. A quote has
// AT MOST ONE live pending charge at a time — a new request reuses the pending
// PI when the amount matches, else cancels + voids it and mints a fresh one — so
// the client can never be double-charged across deposit/full or across the
// client self-paying and the contractor billing the balance (which routes here
// with notify:true). `notify` texts/emails the client the pay link.
export async function POST(req, { params }) {
  try {
    const { id } = await params
    const { mode, notify } = await req.json().catch(() => ({}))
    if (mode !== 'deposit' && mode !== 'full') {
      return NextResponse.json({ error: 'Bad mode', code: 'bad_mode' }, { status: 400 })
    }

    const qd = await getDocument('quotes', id)
    const q = qd?.data
    if (!q) return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
    if (!q.signature) return NextResponse.json({ error: 'Accept the quote first', code: 'not_accepted' }, { status: 409 })
    if (['declined', 'void'].includes(q.status)) return NextResponse.json({ error: `Quote is ${q.status}`, code: q.status }, { status: 409 })

    const total      = q.totalCents || 0
    const amountPaid = q.amountPaidCents || 0
    const depCents   = q.deposit?.depositCents || 0

    let amount
    if (mode === 'deposit') {
      if (q.depositPaid) return NextResponse.json({ error: 'Deposit already paid', code: 'deposit_paid' }, { status: 409 })
      amount = Math.min(depCents, Math.max(0, total - amountPaid))
    } else {
      amount = Math.max(0, total - amountPaid)   // remaining balance
    }
    if (amount < 50) return NextResponse.json({ error: 'Nothing due', code: 'nothing_due' }, { status: 409 })

    // Contractor must be able to collect (Connect active + free-access invariant).
    const gardenerDoc      = await getDocument('users', q.gardenerUid)
    const g                = gardenerDoc?.data || {}
    const stripeAccountId  = g.stripeAccountId
    const connectReady     = !!stripeAccountId && g.stripeChargesEnabled === true && g.stripeCardPaymentsActive !== false
    const freeAccessBlocked = g.subscriptionStatus === 'free_until_paid' && g.pmOnFile !== true
    if (!connectReady || freeAccessBlocked) {
      return NextResponse.json({ error: `${g.businessName || 'The contractor'} hasn't finished payment setup yet`, code: 'cannot_collect' }, { status: 409 })
    }

    const biz = g.businessName || 'YardSync'
    const lang = q.language === 'es' ? 'es' : 'en'
    const clientId = q.convertedClientId || q.clientId || null
    const nowIso = new Date().toISOString()

    // ── Single pending charge: reuse if the amount still matches, else replace ──
    let payUrl = null, piId = null
    if (q.pendingPayIntentId) {
      try {
        const existing = await stripe.paymentIntents.retrieve(q.pendingPayIntentId, { stripeAccount: stripeAccountId })
        if (existing?.status === 'succeeded') {
          // Already paid but webhook hasn't cleared pending yet — treat as done.
          return NextResponse.json({ error: 'Already paid', code: 'already_paid' }, { status: 409 })
        }
        if (existing && existing.status !== 'canceled' && existing.amount === amount) {
          payUrl = q.pendingPayUrl; piId = existing.id   // exact reuse — no new PI
        } else if (existing && existing.status !== 'canceled') {
          // Amount changed (e.g. deposit landed, or deposit↔full switch) — kill
          // the stale PI + void its invoice so only one live charge ever exists.
          try { await stripe.paymentIntents.cancel(existing.id, { stripeAccount: stripeAccountId }) } catch {}
          if (q.pendingPayInvoiceId) { try { await updateDocument('invoices', q.pendingPayInvoiceId, { status: 'void', updatedAt: nowIso }) } catch {} }
        }
      } catch { /* un-retrievable — fall through to mint, prior PI left as-is */ }
    }

    if (!payUrl) {
      const pi = await stripe.paymentIntents.create(
        {
          amount,
          currency: 'usd',
          application_fee_amount: calcApplicationFee(amount),
          description: `${biz} — ${mode === 'deposit' ? 'deposit' : 'payment'} for ${q.title || 'quote'}`,
          receipt_email: q.recipientEmail || undefined,
          metadata: { kind: 'quote_payment', quoteId: id, gardenerUid: q.gardenerUid, clientId: clientId || '', payMode: mode },
        },
        { stripeAccount: stripeAccountId }
      )
      payUrl = `${getBaseUrl(req)}/pay/${pi.id}`
      piId = pi.id

      let invoiceId
      try {
        invoiceId = await createDocument('invoices', {
          gardenerUid: q.gardenerUid, clientId,
          clientName: q.recipientName || '', clientEmail: q.recipientEmail || '', clientPhone: q.recipientPhone || '',
          totalCents: amount,
          stripePaymentIntentId: pi.id, stripeAccountId, stripePaymentUrl: payUrl,
          applicationFee: calcApplicationFee(amount),
          status: 'sent', paymentPath: 'stripe',
          invoiceType: mode === 'deposit' ? 'deposit' : 'quote_payment',
          quoteId: id, createdAt: nowIso,
        })
      } catch (writeErr) {
        console.error('[quotes] pay invoice write failed — cancelling PI:', writeErr.message)
        try { await stripe.paymentIntents.cancel(pi.id, { stripeAccount: stripeAccountId }) } catch {}
        return NextResponse.json({ error: 'Could not start payment — try again', code: 'pay_failed' }, { status: 500 })
      }

      await updateDocument('quotes', id, {
        pendingPayIntentId: pi.id, pendingPayInvoiceId: invoiceId, pendingPayUrl: payUrl,
        pendingPayMode: mode, pendingPayAmount: amount, updatedAt: nowIso,
      })
    }

    // Optional: text/email the client the pay link (contractor "Bill balance").
    if (notify === true) {
      const dollars = `$${(amount / 100).toFixed(2)}`
      try {
        if (q.recipientPhone) {
          const body = lang === 'es'
            ? `${biz}: tu saldo de ${dollars} está listo para pagar: ${payUrl}. Responde STOP para cancelar. – YardSync`
            : `${biz}: your ${dollars} balance is ready to pay: ${payUrl}. Reply STOP to opt out. – YardSync`
          await sendSms({ to: q.recipientPhone, body, context: 'quote_balance', refIds: { gardenerUid: q.gardenerUid, quoteId: id } })
        }
        if (q.recipientEmail) {
          await sendClientEmail({
            to: q.recipientEmail,
            subject: lang === 'es' ? `Saldo de ${dollars} — ${biz}` : `${dollars} balance — ${biz}`,
            text: lang === 'es' ? `Paga tu saldo de ${dollars} aquí: ${payUrl}` : `Pay your ${dollars} balance here: ${payUrl}`,
            html: `<p><a href="${payUrl}">${lang === 'es' ? `Pagar saldo ${dollars}` : `Pay balance ${dollars}`}</a></p>`,
            fromName: biz,
          })
        }
      } catch (e) { console.error('[quotes] pay notify failed (non-fatal):', e.message) }
    }

    return NextResponse.json({ payUrl, amountCents: amount, piId })
  } catch (err) {
    console.error('[quotes] pay failed:', err.message)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
