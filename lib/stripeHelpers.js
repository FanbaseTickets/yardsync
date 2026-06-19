/**
 * Stripe API helpers — handle differences across Stripe API versions.
 *
 * Stripe API version 2025-06-30 (Acacia) moved `current_period_end` and
 * `current_period_start` off the Subscription object onto its items. Code
 * reading `subscription.current_period_end` directly returns `undefined`
 * when running against newer API versions, even though the actual value
 * is still available on `subscription.items.data[0].current_period_end`.
 *
 * This caused `currentPeriodEnd: null` to be persisted to Firestore on
 * the very first webhook write (CLAUDE.md Known Bug #1 — pre-existing
 * null-guard masked the real cause).
 */

/**
 * Resolve a Stripe subscription's current_period_end across API versions,
 * returning an ISO 8601 string or null if unavailable.
 *
 * Falls back to the subscription item's current_period_end for newer
 * Stripe API versions where the top-level field was removed.
 */
export function getSubscriptionPeriodEndISO(subscription) {
  const epoch =
    subscription?.current_period_end
    || subscription?.items?.data?.[0]?.current_period_end
    || null
  return epoch ? new Date(epoch * 1000).toISOString() : null
}

/**
 * Same as above but returns the raw epoch (seconds) instead of ISO. Useful
 * for routes that return the value to client code that expects epoch
 * (e.g., the cancel-subscription endpoint, which returns
 * `currentPeriodEnd: <epoch>` to the Settings UI).
 */
export function getSubscriptionPeriodEndEpoch(subscription) {
  return subscription?.current_period_end
    || subscription?.items?.data?.[0]?.current_period_end
    || null
}

/**
 * Compute the most appropriate invoiceType label from a Stripe Connect
 * invoice's lineItems, based on which categories are present.
 *
 *   only base line             → 'recurring'   (subscription-style charge)
 *   only addons or materials   → 'addon'       (extra-charge invoice between recurring visits)
 *   base + addons/materials    → 'combined'    (recurring visit plus extras)
 *   no recognized categories   → 'recurring'   (sensible default)
 *
 * Previously every caller hardcoded `invoiceType: 'recurring'` regardless
 * of what was actually in the lineItems, so addon-only invoices (e.g. when
 * the base service is already covered by the recurring plan) got tagged
 * as 'recurring' — incorrect for reporting and the invoice-history UI.
 */
export function computeInvoiceType(lineItems) {
  if (!Array.isArray(lineItems) || lineItems.length === 0) return 'recurring'
  const hasBase  = lineItems.some(li => li.category === 'base')
  const hasOther = lineItems.some(li => li.category === 'addon' || li.category === 'material')
  if (hasBase && hasOther) return 'combined'
  if (hasBase)             return 'recurring'
  if (hasOther)            return 'addon'
  return 'recurring'
}
