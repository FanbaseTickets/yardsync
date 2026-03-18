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
 * This is what gets sent to Square — fully assembled.
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