// lib/fee.js
// YardSync monetization logic — every invoice runs through here

const FEE_MONTHLY_CENTS      = 1500   // $15.00
const FEE_QUARTERLY_CENTS    = 3500   // $35.00
const FEE_ANNUAL_CENTS       = 10000  // $100.00
const FEE_WEEKLY_CENTS       = 500    // $5.00
const FEE_ADDON_PERCENT      = 10     // 10%
const FEE_ONETIME_MIN_CENTS  = 1000   // $10.00 minimum
const FEE_ONETIME_PERCENT    = 8      // 8%

/**
 * Get the flat platform fee for a base package (in cents)
 * @param {'monthly'|'quarterly'|'annual'|'weekly'|'onetime'} packageType
 * @param {number} baseAmountCents — only needed for onetime
 * @returns {number} fee in cents
 */
export function getPackageFee(packageType, baseAmountCents = 0) {
  switch (packageType?.toLowerCase()) {
    case 'monthly':   return FEE_MONTHLY_CENTS
    case 'quarterly': return FEE_QUARTERLY_CENTS
    case 'annual':    return FEE_ANNUAL_CENTS
    case 'weekly':    return FEE_WEEKLY_CENTS
    case 'onetime':   return getOnetimeFee(baseAmountCents)
    default:          return FEE_MONTHLY_CENTS
  }
}

/**
 * One-time job fee — min $10 or 8%, whichever is greater
 * @param {number} amountCents
 * @returns {number} fee in cents
 */
export function getOnetimeFee(amountCents) {
  const percentFee = Math.round(amountCents * (FEE_ONETIME_PERCENT / 100))
  return Math.max(percentFee, FEE_ONETIME_MIN_CENTS)
}

/**
 * Calculate the platform fee on add-on services (in cents)
 * @param {number} addonTotalCents
 * @returns {number} fee in cents
 */
export function getAddonFee(addonTotalCents) {
  return Math.round(addonTotalCents * (FEE_ADDON_PERCENT / 100))
}

/**
 * Build the complete invoice line items for a visit.
 * Fully-assembled line items ready to attach to a Stripe PaymentIntent.
 *
 * @param {object} params
 * @param {number}  params.baseAmountCents
 * @param {'monthly'|'quarterly'|'annual'|'weekly'|'onetime'} params.packageType
 * @param {Array<{label:string, amountCents:number}>} params.addons
 * @returns {{ lineItems, totalCents, feeTotalCents }}
 */
export function buildInvoiceLineItems({ baseAmountCents, packageType, addons = [] }) {
  const packageFee    = getPackageFee(packageType, baseAmountCents)
  const addonTotal    = addons.reduce((sum, a) => sum + a.amountCents, 0)
  const addonFee      = getAddonFee(addonTotal)
  const feeTotalCents = packageFee + addonFee

  const packageLabel = packageType === 'onetime'
    ? 'One-time service'
    : `${capitalize(packageType)} lawn care`

  const lineItems = [
    {
      label:       'Lawn Care Service',
      description: packageLabel,
      amountCents: baseAmountCents,
      category:    'base',
    },
    {
      label:       'YardSync Platform Fee',
      description: packageType === 'onetime'
        ? `Platform fee (${FEE_ONETIME_PERCENT}%, min $${FEE_ONETIME_MIN_CENTS / 100})`
        : 'Scheduling, reminders & invoicing',
      amountCents: packageFee,
      category:    'fee',
    },
    ...addons.map(addon => ({
      label:       addon.label,
      description: addon.description || '',
      amountCents: addon.amountCents,
      category:    'addon',
    })),
  ]

  if (addonTotal > 0) {
    lineItems.push({
      label:       'YardSync Service Fee',
      description: `${FEE_ADDON_PERCENT}% platform fee on add-ons`,
      amountCents: addonFee,
      category:    'fee',
    })
  }

  const totalCents = baseAmountCents + packageFee + addonTotal + addonFee

  return { lineItems, totalCents, feeTotalCents }
}

/**
 * Get a human-readable fee description for display
 * @param {'monthly'|'quarterly'|'annual'|'weekly'|'onetime'} packageType
 * @returns {string}
 */
export function getFeeDescription(packageType) {
  switch (packageType?.toLowerCase()) {
    case 'monthly':   return '+$15.00 per invoice'
    case 'quarterly': return '+$35.00 per invoice'
    case 'annual':    return '+$100.00 per invoice'
    case 'weekly':    return '+$5.00 per invoice'
    case 'onetime':   return '+8% (min $10.00) per job'
    default:          return '+$15.00 per invoice'
  }
}

// ── Fee pass-through (price-baked) ───────────────────────────────
// Lets a contractor "cover their fees": instead of absorbing YardSync's 5.5%
// AND Stripe's ~2.9%+30¢, the client-facing price is grossed up so the
// contractor nets their listed price. It's baked into ONE inclusive total —
// not an itemized surcharge — so there's no surcharge-disclosure issue.

export const YARDSYNC_FEE_RATE  = 0.055   // platform application fee
export const STRIPE_PCT_RATE    = 0.029   // Stripe processing %
export const STRIPE_FLAT_CENTS  = 30      // Stripe per-charge flat fee

// ── Per-invoice fee cap (configurable ceiling) ───────────────────
// Caps YardSync's 5.5% application fee at a fixed dollar amount per invoice, so
// big-ticket jobs aren't penalized (5.5% of a $3,000 invoice is $165 — a real
// deterrent). 0 = NO CAP (the 5.5% applies in full at every amount).
//
// ⚠️ PRICING LEVER. With a cap, the effective % only starts dropping above
// (cap / 0.055): the $100 default is "full 5.5% up to ~$1,818, then flat $100
// above that" — so typical lawn invoices are untouched and only big tickets are
// shielded (where 5.5% would otherwise scare the job off-platform entirely).
// Override per-environment with NEXT_PUBLIC_FEE_CAP_CENTS (in cents); set it to
// 0 to disable the cap and charge a straight 5.5% at every amount.
const DEFAULT_FEE_CAP_CENTS = 10000   // $100 per-invoice ceiling (Jay, 2026-06-27)
export const FEE_CAP_CENTS = process.env.NEXT_PUBLIC_FEE_CAP_CENTS != null
  ? (Number(process.env.NEXT_PUBLIC_FEE_CAP_CENTS) || 0)
  : DEFAULT_FEE_CAP_CENTS

/**
 * YardSync's application fee on a charge — 5.5%, capped at FEE_CAP_CENTS when a
 * cap is configured. Single source of truth: the invoice route, the webhook
 * fallback, and every UI preview should call this rather than inline 0.055.
 * @param {number} totalCents — the amount actually charged to the client
 * @returns {number} application fee in cents
 */
export function calcApplicationFee(totalCents) {
  const raw = Math.round((Number(totalCents) || 0) * YARDSYNC_FEE_RATE)
  return FEE_CAP_CENTS > 0 ? Math.min(raw, FEE_CAP_CENTS) : raw
}

/**
 * True when the cap actually bites on this amount (raw 5.5% exceeds the cap), so
 * the UI can label the fee line "(capped)" instead of "(5.5%)" — otherwise the
 * 5.5% label sits next to a number that isn't 5.5% of the total.
 * @param {number} totalCents
 * @returns {boolean}
 */
export function isFeeCapped(totalCents) {
  return FEE_CAP_CENTS > 0 && Math.round((Number(totalCents) || 0) * YARDSYNC_FEE_RATE) > FEE_CAP_CENTS
}

// What the contractor actually nets on a direct charge: total − our (capped)
// fee − their Stripe cost. Mirrors the invoice route's exact rounding so
// previews and the gross-up agree with what settles.
function netAfterFees(billedCents) {
  const appFee    = calcApplicationFee(billedCents)
  const stripeFee = Math.round(billedCents * STRIPE_PCT_RATE) + STRIPE_FLAT_CENTS
  return billedCents - appFee - stripeFee
}

/**
 * Gross up a target net so that after YardSync's (capped) 5.5% AND Stripe's
 * 2.9%+30¢ the contractor nets `targetNetCents`. Starts from a closed-form
 * estimate (uncapped, or the capped-region inverse when the cap bites) then
 * nudges to the MINIMAL billed amount whose actual net ≥ target — so the
 * contractor never nets less than their price, and the client is never
 * overcharged beyond the rounding cent. Correct whether or not a cap is active.
 * @param {number} targetNetCents
 * @returns {number} client-facing total in cents
 */
export function grossUpForFees(targetNetCents) {
  const t = Number(targetNetCents) || 0
  if (t <= 0) return 0
  // Uncapped inverse: net = billed·(1 − 0.055 − 0.029) − 30 ⇒ billed = (t+30)/0.916
  let billed = Math.ceil((t + STRIPE_FLAT_CENTS) / (1 - YARDSYNC_FEE_RATE - STRIPE_PCT_RATE))
  // If a cap is active and bites at that estimate, the fee is then a constant —
  // re-estimate against the Stripe % only: billed = (t + cap + 30)/(1 − 0.029).
  if (FEE_CAP_CENTS > 0 && Math.round(billed * YARDSYNC_FEE_RATE) > FEE_CAP_CENTS) {
    billed = Math.ceil((t + FEE_CAP_CENTS + STRIPE_FLAT_CENTS) / (1 - STRIPE_PCT_RATE))
  }
  // Land on the exact minimal billed whose real (rounded, capped) net ≥ target.
  while (netAfterFees(billed) < t) billed++
  while (billed > t && netAfterFees(billed - 1) >= t) billed--
  return billed
}

/**
 * Full breakdown for the invoice UI's live preview — mirrors the exact rounding
 * (and cap) the invoice route uses, so "you keep" matches what actually settles.
 * @param {number} targetNetCents — the contractor's listed price
 * @returns {{ clientPays:number, yardsyncFee:number, stripeFee:number, net:number, surcharge:number }}
 */
export function passThroughPreview(targetNetCents) {
  const t = Number(targetNetCents) || 0
  const clientPays  = grossUpForFees(t)
  const yardsyncFee = calcApplicationFee(clientPays)
  const stripeFee   = Math.round(clientPays * STRIPE_PCT_RATE) + STRIPE_FLAT_CENTS
  const net         = clientPays - yardsyncFee - stripeFee
  return { clientPays, yardsyncFee, stripeFee, net, surcharge: clientPays - t }
}

/**
 * Format cents to a display string — e.g. 8000 → "$80.00"
 */
export function formatCents(cents) {
  return new Intl.NumberFormat('en-US', {
    style:    'currency',
    currency: 'USD',
  }).format((cents || 0) / 100)
}

/**
 * Convert a dollar string/number to cents — e.g. "65" → 6500
 */
export function dollarsToCents(dollars) {
  return Math.round(parseFloat(dollars) * 100)
}

function capitalize(str) {
  if (!str) return ''
  return str.charAt(0).toUpperCase() + str.slice(1)
}