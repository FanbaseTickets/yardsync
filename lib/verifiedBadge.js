// Verified-business trust badge gate.
//
// Lights up only when the contractor is BOTH fully verified by Stripe (identity
// + payments KYC complete, no outstanding requirements) AND has received at
// least one real client payment through YardSync. "Vetted AND actually doing
// business" — so the badge means something to the people who see it.
//
// All inputs are fields already on the users doc (set by the account.updated
// webhook + the first-paid activation). firstPaidInvoiceId is set for every
// free-access account on its first paid client invoice.
export function isVerifiedBusiness(profile) {
  if (!profile) return false
  const stripeVerified =
    profile.stripeChargesEnabled === true &&
    profile.stripePayoutsEnabled === true &&
    (profile.stripeRequirementsCurrentlyDue?.length || 0) === 0 &&
    (profile.stripeRequirementsPastDue?.length || 0) === 0 &&
    !profile.stripeRequirementsDisabledReason
  return stripeVerified && !!profile.firstPaidInvoiceId
}
