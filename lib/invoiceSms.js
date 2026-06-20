/**
 * Build the SMS body for an invoice payment link.
 *
 * Two templates, selected by trust-state (spec §6):
 *
 *   - Standard (default). Used for any client who has paid an invoice
 *     before (completedJobsCount >= 1) OR is on post-visit billing.
 *     Short, single-segment SMS with the payment link.
 *
 *   - First-time upfront. Used the first time we invoice a client who's
 *     on upfront billing (billingMode === 'upfront' &&
 *     completedJobsCount === 0). Adds a "please pay within Nh before
 *     service" sentence so the client knows the expectation.
 *
 * Deadline resolution order:
 *   1. client.upfrontDeadlineHours   (per-client override)
 *   2. contractor.upfrontDeadlineHours (Settings → Payment reminders)
 *   3. 24                              (fallback default)
 *
 * Server-side STOP enforcement (in app/api/twilio/send/route.js) will
 * append the required "Reply STOP to opt out. – {business}" if the
 * caller doesn't, so we don't have to include it here. Keeps the body
 * tight for the first-time variant.
 */

const DEFAULT_DEADLINE_HOURS = 24

function resolveDeadlineHours(client, contractor) {
  const c = Number(client?.upfrontDeadlineHours)
  if (Number.isFinite(c) && c >= 1 && c <= 168) return c
  const g = Number(contractor?.upfrontDeadlineHours)
  if (Number.isFinite(g) && g >= 1 && g <= 168) return g
  return DEFAULT_DEADLINE_HOURS
}

function isFirstTimeUpfront(client) {
  return client?.billingMode === 'upfront'
      && (client?.completedJobsCount || 0) === 0
}

/**
 * @param {object} opts
 * @param {object} opts.client       — clients/{id} doc
 * @param {object} opts.contractor   — users/{uid} doc (the gardener)
 * @param {number} opts.totalCents
 * @param {string} opts.paymentUrl
 * @param {'en'|'es'} [opts.lang='en']
 * @returns {string} SMS body
 */
export function buildInvoiceSms({ client, contractor, totalCents, paymentUrl, lang = 'en' }) {
  const dollars      = (Number(totalCents || 0) / 100).toFixed(2)
  const businessName = contractor?.businessName || 'YardSync'
  const clientName   = client?.name || ''

  if (isFirstTimeUpfront(client)) {
    const hours = resolveDeadlineHours(client, contractor)
    if (lang === 'es') {
      return `Hola ${clientName}! Factura de $${dollars}: ${paymentUrl} — pague dentro de ${hours}h antes del servicio. – ${businessName}`
    }
    return `Hi ${clientName}! Invoice for $${dollars}: ${paymentUrl} — please pay within ${hours}h before service. – ${businessName}`
  }

  // Standard template — short, used once the client has paid at least once.
  if (lang === 'es') {
    return `Hola ${clientName}! Tu factura de $${dollars} está lista. Paga aquí: ${paymentUrl}`
  }
  return `Hi ${clientName}! Your invoice for $${dollars} is ready. Pay here: ${paymentUrl}`
}
