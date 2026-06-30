import { NextResponse } from 'next/server'
import { getDocument, updateDocument } from '@/lib/firestoreRest'
import { sendPush } from '@/lib/push'

// POST /api/quotes/[id]/decline — public. Optional { reason }. Flips the quote to
// declined and notifies the contractor.
export async function POST(req, { params }) {
  try {
    const { id } = await params
    const { reason } = await req.json().catch(() => ({}))

    const qd = await getDocument('quotes', id)
    const q = qd?.data
    if (!q) return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
    if (!['sent', 'viewed', 'expired'].includes(q.status)) {
      return NextResponse.json({ error: `Quote is already ${q.status}`, code: q.status }, { status: 409 })
    }

    const nowIso = new Date().toISOString()
    await updateDocument('quotes', id, {
      status:        'declined',
      declinedAt:    nowIso,
      declineReason: reason ? String(reason).slice(0, 280) : null,
      updatedAt:     nowIso,
    })

    try {
      const cl = q.language === 'es' ? 'es' : 'en'
      await sendPush(q.gardenerUid, {
        title: cl === 'es' ? 'Cotización rechazada' : 'Quote declined',
        body:  cl === 'es'
          ? `${q.recipientName || 'Un cliente'} rechazó tu cotización.`
          : `${q.recipientName || 'A client'} declined your quote.`,
        url: '/quotes',
      })
    } catch (e) { console.error('[quotes] decline push failed (non-fatal):', e.message) }

    return NextResponse.json({ ok: true, status: 'declined' })
  } catch (err) {
    console.error('[quotes] decline failed:', err.message)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
