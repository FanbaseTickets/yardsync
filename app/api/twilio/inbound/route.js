import { listCollection } from '@/lib/firestoreRest'
import { cancelClientAutoBilling } from '@/lib/autoCharge'

// Inbound SMS handler — receives client replies. We act ONLY on the CANCEL /
// CANCELAR keyword (to cancel recurring auto-billing); STOP/HELP/START are
// handled by Twilio's Advanced Opt-Out and never reach here. Configure the
// Messaging Service's inbound webhook to POST here.
//
// NOTE: soft-verification (no strict X-Twilio-Signature check) — matches the
// project's status-callback pattern. Impact of a spoofed CANCEL is low (it only
// DISABLES billing, which the contractor can re-enable). Harden with signature
// verification when moving past pilot.

const xml = (inner = '') =>
  new Response(`<?xml version="1.0" encoding="UTF-8"?><Response>${inner}</Response>`, { headers: { 'Content-Type': 'text/xml' } })

const digits = (s) => String(s || '').replace(/\D/g, '').replace(/^1/, '')  // last-10

export async function POST(request) {
  let from = '', body = ''
  try {
    const form = await request.formData()
    from = form.get('From') || ''
    body = String(form.get('Body') || '').trim()
  } catch {
    return xml()
  }

  const isCancel = /^cancel(ar)?\b/i.test(body)
  if (!isCancel) return xml()   // ignore everything except CANCEL

  let cancelled = 0
  let es = false
  try {
    const fromDigits = digits(from)
    const clients = (await listCollection('clients', { where: [{ field: 'autoBilling', value: true }] }))
      .filter(c => digits(c.data?.phone) === fromDigits && fromDigits.length === 10)
    for (const c of clients) {
      if (c.data?.language === 'es') es = true
      await cancelClientAutoBilling(c.id)
      cancelled++
    }
  } catch (e) {
    console.error('[twilio/inbound] cancel failed:', e.message)
  }

  const msg = cancelled > 0
    ? (es ? 'Listo — cancelamos tu cobro automatico. No se te cobrara automaticamente.' : "Done — your auto-billing is cancelled. You won't be charged automatically.")
    : (es ? 'No encontramos un cobro automatico activo para este numero.' : "We couldn't find active auto-billing for this number.")
  return xml(`<Message>${msg}</Message>`)
}
