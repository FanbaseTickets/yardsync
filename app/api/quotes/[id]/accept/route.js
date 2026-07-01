import { NextResponse } from 'next/server'
import { getDocument, updateDocument } from '@/lib/firestoreRest'
import { getBaseUrl } from '@/lib/baseUrl'
import { sendPush } from '@/lib/push'
import { sendSms } from '@/lib/sms'
import { sendClientEmail } from '@/lib/email'
import { convertQuoteToClient } from '@/lib/quoteConvert'

// POST /api/quotes/[id]/accept — public. Body { signatureName }.
// The acquisition-spine handoff: records the typed e-signature, CONVERTS the
// prospect/lead into a real client, and notifies both sides. Payment (deposit
// OR full amount) is a separate client choice on the quote page → /api/quotes/
// [id]/pay, so this endpoint never creates a charge.
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

    // 2) Convert prospect/lead → real client (idempotent). Non-fatal on failure.
    const clientId = await convertQuoteToClient(id, q)

    const lang = q.language === 'es' ? 'es' : 'en'
    const biz  = (await getDocument('users', q.gardenerUid))?.data?.businessName || 'YardSync'
    const hasDeposit = (q.deposit?.depositCents || 0) >= 50
    const quoteUrl = `${getBaseUrl(req)}/quote/${id}`

    // 3) Notify the client — if there's a deposit, point them back to pay it.
    try {
      if (hasDeposit && q.recipientPhone) {
        const body = lang === 'es'
          ? `¡Gracias por aceptar la cotización de ${biz}! Completa tu pago aquí: ${quoteUrl}. Responde STOP para cancelar. – YardSync`
          : `Thanks for accepting ${biz}'s quote! Complete your payment here: ${quoteUrl}. Reply STOP to opt out. – YardSync`
        await sendSms({ to: q.recipientPhone, body, context: 'quote_accept', refIds: { gardenerUid: q.gardenerUid, quoteId: id } })
      }
      if (hasDeposit && q.recipientEmail) {
        await sendClientEmail({
          to: q.recipientEmail,
          subject: lang === 'es' ? `Completa tu pago — ${biz}` : `Complete your payment — ${biz}`,
          text: lang === 'es' ? `¡Gracias por aceptar! Completa tu pago aquí: ${quoteUrl}` : `Thanks for accepting! Complete your payment here: ${quoteUrl}`,
          html: `<p>${lang === 'es' ? '¡Gracias por aceptar!' : 'Thanks for accepting!'}</p><p><a href="${quoteUrl}">${lang === 'es' ? 'Completar pago' : 'Complete payment'}</a></p>`,
          fromName: biz,
        })
      }
    } catch (e) { console.error('[quotes] accept client notify failed (non-fatal):', e.message) }

    // 4) Contractor sync.
    try {
      const cl  = q.language === 'es' ? 'es' : 'en'
      const amt = `$${((q.totalCents || 0) / 100).toFixed(2)}`
      await sendPush(q.gardenerUid, {
        title: cl === 'es' ? 'Cotización aceptada 🎉' : 'Quote accepted 🎉',
        body:  cl === 'es'
          ? `${q.recipientName || 'Un cliente'} aceptó tu cotización de ${amt}.`
          : `${q.recipientName || 'A client'} accepted your ${amt} quote.`,
        url: '/quotes',
      })
    } catch (e) { console.error('[quotes] accept push failed (non-fatal):', e.message) }

    return NextResponse.json({ ok: true, status: 'accepted', clientId: clientId || null, hasDeposit })
  } catch (err) {
    console.error('[quotes] accept failed:', err.message)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
