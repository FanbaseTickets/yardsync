/**
 * Human-readable labels for Stripe Connect requirement field paths.
 *
 * Stripe's `account.requirements.currently_due` and `eventually_due` arrays
 * contain technical field paths like "individual.ssn_last_4" or
 * "individual.dob.day". These are not friendly for surfacing to either
 * the contractor (in Settings) or to Jay (in the admin dashboard).
 *
 * This helper deduplicates and translates the paths into a list of
 * user-friendly labels. Multiple paths that refer to the same logical
 * concept (e.g. dob.day + dob.month + dob.year) collapse into one item.
 *
 * Returns an array of { key, label, labelEs } objects, deduplicated.
 */

// Map common Stripe requirement paths to a logical group key + EN/ES labels.
// Anything not in this map falls back to its own raw path with a generic label.
const REQUIREMENT_MAP = {
  // Personal identity
  'individual.ssn_last_4':                { key: 'ssn_last_4',  en: 'Last 4 of SSN',                es: 'Últimos 4 del SSN' },
  'individual.id_number':                 { key: 'tax_id',      en: 'Full SSN or Tax ID',           es: 'SSN completo o ID fiscal' },
  'individual.dob.day':                   { key: 'dob',         en: 'Date of birth',                es: 'Fecha de nacimiento' },
  'individual.dob.month':                 { key: 'dob',         en: 'Date of birth',                es: 'Fecha de nacimiento' },
  'individual.dob.year':                  { key: 'dob',         en: 'Date of birth',                es: 'Fecha de nacimiento' },
  'individual.first_name':                { key: 'name',        en: 'Legal name',                   es: 'Nombre legal' },
  'individual.last_name':                 { key: 'name',        en: 'Legal name',                   es: 'Nombre legal' },
  'individual.phone':                     { key: 'phone',       en: 'Phone number',                 es: 'Número de teléfono' },
  'individual.email':                     { key: 'email',       en: 'Email address',                es: 'Correo electrónico' },

  // Address
  'individual.address.line1':             { key: 'address',     en: 'Home address',                 es: 'Dirección de residencia' },
  'individual.address.line2':             { key: 'address',     en: 'Home address',                 es: 'Dirección de residencia' },
  'individual.address.city':              { key: 'address',     en: 'Home address',                 es: 'Dirección de residencia' },
  'individual.address.state':             { key: 'address',     en: 'Home address',                 es: 'Dirección de residencia' },
  'individual.address.postal_code':       { key: 'address',     en: 'Home address',                 es: 'Dirección de residencia' },

  // Business / verification
  'business_profile.url':                 { key: 'biz_url',     en: 'Business website',             es: 'Sitio web del negocio' },
  'business_profile.mcc':                 { key: 'biz_mcc',     en: 'Business category',            es: 'Categoría del negocio' },
  'business_profile.product_description': { key: 'biz_desc',    en: 'Business description',         es: 'Descripción del negocio' },
  'business_profile.support_phone':       { key: 'biz_support', en: 'Business support phone',       es: 'Teléfono de soporte' },

  // Payouts + ToS
  'external_account':                     { key: 'bank',        en: 'Bank account for payouts',     es: 'Cuenta bancaria para pagos' },
  'tos_acceptance.date':                  { key: 'tos',         en: 'Terms of Service acceptance',  es: 'Aceptación de Términos de Servicio' },
  'tos_acceptance.ip':                    { key: 'tos',         en: 'Terms of Service acceptance',  es: 'Aceptación de Términos de Servicio' },
}

/**
 * Translate an array of Stripe requirement paths into deduplicated,
 * human-readable label objects.
 *
 * @param {string[]} paths - Array of Stripe requirement field paths
 * @returns {Array<{key: string, en: string, es: string}>}
 */
export function translateRequirements(paths) {
  if (!Array.isArray(paths) || paths.length === 0) return []
  const seen = new Set()
  const out = []
  for (const path of paths) {
    const mapped = REQUIREMENT_MAP[path] || {
      key: path,
      en: `Additional info (${path})`,
      es: `Información adicional (${path})`,
    }
    if (seen.has(mapped.key)) continue
    seen.add(mapped.key)
    out.push(mapped)
  }
  return out
}

/**
 * Get a comma-separated, user-friendly list of requirements for display
 * inline (e.g., "Last 4 of SSN, Date of birth, Bank account for payouts").
 */
export function requirementsSummary(paths, lang = 'en') {
  const items = translateRequirements(paths)
  if (items.length === 0) return ''
  return items.map(r => r[lang] || r.en).join(', ')
}
