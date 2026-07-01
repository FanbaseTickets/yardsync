import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { getDocument, updateDocument, createDocument } from '@/lib/firestoreRest'
import { getBaseUrl } from '@/lib/baseUrl'
import { calcApplicationFee } from '@/lib/fee'
import { sendPush } from '@/lib/push'
import { sendSms } from '@/lib/sms'
import { sendClientEmail } from '@/lib/email'
import { convertQuoteToClient } from '@/lib/quoteConvert'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2026-02-25.clover' })

// POST /api/quotes/[id]/accept — public. Body { signatureName }.
// The acquisition-spine handoff: records the typed e-signature, CONVERTS the
// prospect/lead into a real client, and — when the quote carries a deposit —
// creates an instant direct-charge deposit PaymentIntent on the contractor's
// connected account and texts/emails the client a "pay now" link. Returns the
// deposit pay URL so the public page can show a Pay button immediately.
export async function POST(req, { params }) {
  try {
    const { id } = await params
    const { signatureName } = await req.json().catch(() => ({}))
    const name = String(signatureName || '').trim()
    if (name.length < 2) {
      return NextResponse.json({ error: 'Please type your full name to sign', code: 'no_name' }, { status: 400 })
    }

    const qd = await getDocument('quotes', id)
    const q = qd?.data
    if (!q) return NextResponse.json({ error: 'Quote not found' }, { status: 404 })

    if (q.validUntil && new Date(q.validUntil).getTime() < Date.now()) {
      return NextResponse.json({ error: 'This quote has expired — ask for a new one', code: 'expired' }, { status: 409 })
    }
    if (!['sent', 'viewed'].includes(q.status)) {
      return NextResponse.json({ error: `Quote is already ${q.status}`, code: q.status }, { status: 409 })
    }

    const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || req.headers.get('x-real-ip') || null
    const ua = req.headers.get('user-agent') || null
    const nowIso = new Date().toISOString()

    // 1) Record the signature + acceptance.
    await updateDocument('quotes', id, {
      status:     'accepted',
      acceptedAt: nowIso,
      signature:  { name: name.slice(0, 80), agreedAt: nowIso, ip, userAgent: ua ? ua.slice(0, 256) : null },
      updatedAt:  nowIso,
    })

    // 2) Convert prospect/lead → real client (idempotent). Non-fatal on failure
    //    — the acceptance still stands; the contractor can follow up.
    const clientId = await convertQuoteToClient(id, q)

    // 3) Deposit → instant charge on the contractor's connected account.
    const lang = q.language === 'es' ? 'es' : 'en'
    const gardenerDoc = await getDocument('users', q.gardenerUid)
    const biz  = gardenerDoc?.data?.businessName || 'YardSync'
    let depositOut = null

    const depCents = q.deposit?.depositCents || 0
    // `!q.depositPaymentIntentId` is a belt-and-suspenders race guard on this
    // public endpoint so two near-simultaneous accepts can't both mint a PI.
    if (depCents >= 50 && !q.depositPaymentIntentId) {
      const stripeAccountId  = gardenerDoc?.data?.stripeAccountId
      const chargesEnabled   = gardenerDoc?.data?.stripeChargesEnabled === true
      const cardPaymentsActive = gardenerDoc?.data?.stripeCardPaymentsActive
      // Free-access invariant (mirrors the invoice route): a `free_until_paid`
      // contractor with no platform card on file must NOT collect money through
      // YardSync — their "first paid invoice" triggers subscription activation,
      // which silently fails with no card. Skip the charge (accept still stands);
      // they finish payment setup, then future invoices/deposits activate cleanly.
      const subStatus        = gardenerDoc?.data?.subscriptionStatus
      const freeAccessBlocked = subStatus === 'free_until_paid' && gardenerDoc?.data?.pmOnFile !== true
      const connectReady     = !!stripeAccountId && chargesEnabled && cardPaymentsActive !== false && !freeAccessBlocked

      if (connectReady) {
        try {
          const pi = await stripe.paymentIntents.create(
            {
              amount: depCents,
              currency: 'usd',
              application_fee_amount: calcApplicationFee(depCents),
              description: `${biz} — deposit for ${q.title || 'quote'}`,
              receipt_email: q.recipientEmail || undefined,
              metadata: { kind: 'quote_deposit', quoteId: id, gardenerUid: q.gardenerUid, clientId: clientId || '' },
            },
            { stripeAccount: stripeAccountId }
          )
          const payUrl = `${getBaseUrl(req)}/pay/${pi.id}`

          // Write the invoice doc BEFORE publishing the pay link. If it fails we
          // must cancel the PI — otherwise a live, payable charge exists with no
          // invoice record and the webhook could never reconcile it (mirrors the
          // invoice route's hardening).
          let invoiceId
          try {
            invoiceId = await createDocument('invoices', {
              gardenerUid:           q.gardenerUid,
              clientId:              clientId || null,
              clientName:            q.recipientName || '',
              clientEmail:           q.recipientEmail || '',
              clientPhone:           q.recipientPhone || '',
              totalCents:            depCents,
              stripePaymentIntentId: pi.id,
              stripeAccountId:       stripeAccountId,
              stripePaymentUrl:      payUrl,
              applicationFee:        calcApplicationFee(depCents),
              status:                'sent',
              paymentPath:           'stripe',
              invoiceType:           'deposit',
              quoteId:               id,
              createdAt:             nowIso,
            })
          } catch (writeErr) {
            console.error('[quotes] deposit invoice write failed — cancelling PI:', writeErr.message)
            try { await stripe.paymentIntents.cancel(pi.id, { stripeAccount: stripeAccountId }) } catch (cancelErr) { console.error('[quotes] deposit PI cancel also failed:', cancelErr.message) }
            throw writeErr   // caught by the outer deposit try → depositOut stays null, accept still stands
          }

          await updateDocument('quotes', id, {
            depositPaymentIntentId: pi.id,
            depositInvoiceId:       invoiceId,
            depositPayUrl:          payUrl,
            updatedAt:              new Date().toISOString(),
          })

          depositOut = { payUrl, amountCents: depCents, required: q.deposit?.required === true }

          // Instant "pay your deposit" message to the client.
          const dollars = `$${(depCents / 100).toFixed(2)}`
          if (q.recipientPhone) {
            const body = lang === 'es'
              ? `¡Gracias por aceptar! Paga tu depósito de ${dollars} a ${biz} aquí: ${payUrl}. Responde STOP para cancelar. – YardSync`
              : `Thanks for accepting! Pay your ${dollars} deposit to ${biz} here: ${payUrl}. Reply STOP to opt out. – YardSync`
            await sendSms({ to: q.recipientPhone, body, context: 'quote_deposit', refIds: { gardenerUid: q.gardenerUid, quoteId: id } })
          }
          if (q.recipientEmail) {
            await sendClientEmail({
              to: q.recipientEmail,
              subject: lang === 'es' ? `Depósito de ${dollars} — ${biz}` : `${dollars} deposit — ${biz}`,
              text: lang === 'es'
                ? `¡Gracias por aceptar la cotización! Paga tu depósito de ${dollars} aquí: ${payUrl}`
                : `Thanks for accepting the quote! Pay your ${dollars} deposit here: ${payUrl}`,
              html: `<p>${lang === 'es' ? `¡Gracias por aceptar! Paga tu depósito de <strong>${dollars}</strong>:` : `Thanks for accepting! Pay your <strong>${dollars}</strong> deposit:`}</p><p><a href="${payUrl}">${lang === 'es' ? 'Pagar depósito' : 'Pay deposit'}</a></p>`,
              fromName: biz,
            })
          }
        } catch (e) {
          console.error('[quotes] deposit PI failed (non-fatal):', e.message)
        }
      } else {
        console.warn(`[quotes] quote ${id} has a deposit but contractor ${q.gardenerUid} isn't Connect-ready — skipping charge`)
      }
    }

    // 4) Contractor sync.
    try {
      const cl  = q.language === 'es' ? 'es' : 'en'
      const amt = `$${((q.totalCents || 0) / 100).toFixed(2)}`
      const depLine = depositOut
        ? (cl === 'es' ? ` Depósito de $${(depCents / 100).toFixed(2)} solicitado.` : ` $${(depCents / 100).toFixed(2)} deposit requested.`)
        : ''
      await sendPush(q.gardenerUid, {
        title: cl === 'es' ? 'Cotización aceptada 🎉' : 'Quote accepted 🎉',
        body:  (cl === 'es'
          ? `${q.recipientName || 'Un cliente'} aceptó tu cotización de ${amt}.`
          : `${q.recipientName || 'A client'} accepted your ${amt} quote.`) + depLine,
        url: '/quotes',
      })
    } catch (e) { console.error('[quotes] accept push failed (non-fatal):', e.message) }

    return NextResponse.json({ ok: true, status: 'accepted', clientId: clientId || null, deposit: depositOut })
  } catch (err) {
    console.error('[quotes] accept failed:', err.message)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
