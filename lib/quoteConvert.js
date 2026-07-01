import { getDocument, createDocument, updateDocument } from '@/lib/firestoreRest'

/**
 * Convert an accepted quote into a real client (the acquisition-spine handoff).
 *
 *   - Quote for an EXISTING client (q.clientId): graduate it — if it was an
 *     intake lead (leadStatus:'new'), flip to accepted/active and seed the
 *     trust-state fields a manually-added client would have. A client that's
 *     already active is left intact (just ensures status:'active').
 *   - Quote for a PROSPECT (inline q.prospect): create a fresh clients doc from
 *     the prospect data, tagged source:'quote'.
 *
 * Idempotent: if the quote already has convertedClientId, returns it and does
 * nothing else. Writes convertedClientId/convertedAt + status:'converted' on
 * the quote. Returns the client id (or null on failure — caller decides).
 */
export async function convertQuoteToClient(quoteId, quote) {
  if (quote.convertedClientId) return quote.convertedClientId
  const nowIso = new Date().toISOString()
  let clientId = null

  try {
    if (quote.clientId) {
      clientId = quote.clientId
      const cd = await getDocument('clients', clientId)
      const c = cd?.data || {}
      const patch = { status: 'active', updatedAt: nowIso }
      // Graduate an intake lead + seed the trust-state fields so a
      // quote-converted lead has the same shape as an accepted lead.
      if (c.leadStatus === 'new') patch.leadStatus = 'accepted'
      if (c.completedJobsCount == null) patch.completedJobsCount = 0
      if (c.billingModePrompted == null) patch.billingModePrompted = false
      patch.acceptedFromQuoteId = quoteId
      await updateDocument('clients', clientId, patch)
    } else if (quote.prospect) {
      const p = quote.prospect
      clientId = await createDocument('clients', {
        gardenerUid:        quote.gardenerUid,
        name:               p.name || '',
        phone:              p.phone || '',
        email:              p.email || '',
        address:            p.address || '',
        language:           p.language === 'es' ? 'es' : 'en',
        status:             'active',
        source:             'quote',
        acceptedFromQuoteId: quoteId,
        // Seed a base price from the quote (the contractor's pre-fee subtotal) so
        // the new client isn't $0 — they can adjust the package when scheduling.
        basePriceCents:     quote.subtotalCents || 0,
        completedJobsCount: 0,
        billingModePrompted: false,
        createdAt:          nowIso,
        updatedAt:          nowIso,
      })
    }

    if (clientId) {
      await updateDocument('quotes', quoteId, {
        convertedClientId: clientId,
        convertedAt:       nowIso,
        status:            'converted',
        updatedAt:         nowIso,
      })
    }
    return clientId
  } catch (e) {
    console.error('[quoteConvert] failed:', e.message)
    return clientId   // partial: client may exist even if the quote stamp failed
  }
}
