import { NextResponse } from 'next/server'
import { getDocument, updateDocument } from '@/lib/firestoreRest'
import { sendPush } from '@/lib/push'

// POST /api/quotes/[id]/accept — public. Body { signatureName }. Records a typed
// e-signature (name + timestamp + IP + user-agent), flips the quote to accepted,
// and notifies the contractor. Deposit collection + auto-conversion to a client
// land in later phases; for now an accepted quote is recorded + surfaced.
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
      // Already accepted/declined/converted/void — idempotent-ish: report state.
      return NextResponse.json({ error: `Quote is already ${q.status}`, code: q.status }, { status: 409 })
    }

    const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || req.headers.get('x-real-ip') || null
    const ua = req.headers.get('user-agent') || null
    const nowIso = new Date().toISOString()

    await updateDocument('quotes', id, {
      status:     'accepted',
      acceptedAt: nowIso,
      signature:  { name: name.slice(0, 80), agreedAt: nowIso, ip, userAgent: ua ? ua.slice(0, 256) : null },
      updatedAt:  nowIso,
    })

    // Contractor sync: let them know it was signed.
    try {
      const cl = q.language === 'es' ? 'es' : 'en'
      const amt = `$${((q.totalCents || 0) / 100).toFixed(2)}`
      await sendPush(q.gardenerUid, {
        title: cl === 'es' ? 'Cotización aceptada 🎉' : 'Quote accepted 🎉',
        body:  cl === 'es'
          ? `${q.recipientName || 'Un cliente'} aceptó tu cotización de ${amt}.`
          : `${q.recipientName || 'A client'} accepted your ${amt} quote.`,
        url: '/quotes',
      })
    } catch (e) { console.error('[quotes] accept push failed (non-fatal):', e.message) }

    return NextResponse.json({ ok: true, status: 'accepted' })
  } catch (err) {
    console.error('[quotes] accept failed:', err.message)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
