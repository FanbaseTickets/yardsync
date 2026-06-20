/**
 * Slug helpers for YardSync's public business-card / intake URLs.
 *
 * The slug becomes the doc ID in `slugs/{slug}` (the resolver collection
 * documented in docs/SMART_BUSINESS_CARD_SPEC.md §1.4). The resolver doc
 * points at an `ownerType` + `ownerUid` so the same slug can be moved
 * from a user to a future Business doc without any client-data migration.
 *
 * This module is intentionally Firebase-free — pure JS so it can be
 * imported by both server routes and client-side Settings UI. Database
 * operations (existence checks, writes) happen in the calling sites
 * via lib/firestoreRest.js.
 */

// Slug format: lowercase letters, digits, hyphens; 3-50 chars total.
// Source of truth for validation; mirrored on the Firestore-rules side.
export const SLUG_REGEX = /^[a-z0-9-]{3,50}$/

// Reserved slugs that conflict with existing top-level routes or common
// patterns that would confuse contractors. Rejected on save.
export const RESERVED_SLUGS = new Set([
  'admin',
  'api',
  'app',
  'dashboard',
  'login',
  'signup',
  'settings',
  'pay',
  'sms-opt-in',
  'privacy',
  'terms',
  'clients',
  'calendar',
  'services',
  'sms',
  'onboarding',
  'join',
  'request',
])

/**
 * Validate a slug against the format regex and the reserved-word
 * blocklist. Returns null if valid, or an error code string for the
 * caller to localize via lib/i18n.js.
 *
 *   'empty' | 'tooShort' | 'tooLong' | 'badChars' | 'reserved' | null
 */
export function validateSlug(raw) {
  if (typeof raw !== 'string') return 'empty'
  const s = raw.trim()
  if (s.length === 0) return 'empty'
  if (s.length < 3)   return 'tooShort'
  if (s.length > 50)  return 'tooLong'
  // Strict format check — reject uppercase or invalid chars. Callers that
  // want auto-lowercasing should call slugify() first then validate.
  if (!SLUG_REGEX.test(s)) return 'badChars'
  // Reserved-word check is case-insensitive (defensive — the regex above
  // already disallows uppercase, but if SLUG_REGEX is ever relaxed we
  // still want "Admin" rejected as reserved).
  if (RESERVED_SLUGS.has(s.toLowerCase())) return 'reserved'
  return null
}

/**
 * Convert an arbitrary business name into a valid slug candidate.
 *
 *   "Johnson Test 1"          -> "johnson-test-1"
 *   "Marco's Lawn & Garden"   -> "marcos-lawn-garden"
 *   "  Jardinería Pérez  "    -> "jardineria-perez"
 *   "123"                     -> "123-yardsync"   (padded if too short)
 *
 * Does NOT check availability — that's `generateUniqueSlug()`'s job.
 * Returns an empty string only if the input is unusable.
 */
export function slugify(businessName) {
  if (typeof businessName !== 'string' || !businessName.trim()) {
    return ''
  }
  let s = businessName
    .toLowerCase()
    .normalize('NFD')                                    // split accented letters: é -> e + combining mark
    .replace(/[̀-ͯ]/g, '')                     // drop the combining marks (Unicode "Combining Diacritical Marks" block)
    .replace(/['’‘`]/g, '')          // drop apostrophes/quotes so "Marco's" -> "marcos" not "marco-s"
    .replace(/[^a-z0-9]+/g, '-')                         // anything else not alnum -> single hyphen
    .replace(/-+/g, '-')                                 // collapse multiple hyphens
    .replace(/^-+|-+$/g, '')                             // trim leading/trailing hyphens

  // Truncate to 50 char max, then re-trim any trailing hyphen the slice introduced.
  if (s.length > 50) {
    s = s.slice(0, 50).replace(/-+$/, '')
  }

  // Pad to 3 char min for numeric-only or single-char business names.
  if (s.length > 0 && s.length < 3) {
    s = `${s}-yardsync`.slice(0, 50)
  }

  return s
}

/**
 * Generate an available slug from a business name, suffixed with `-2`,
 * `-3`, ... on collision. Caller supplies an async existence predicate
 * (typically `slug => firestoreRest.getDocument('slugs', slug) !== null`).
 *
 * @param {string} businessName
 * @param {(slug: string) => Promise<boolean>} existsCheck
 *        Returns true if the slug is already taken in `slugs/{slug}`.
 * @returns {Promise<string>} an available, valid slug
 * @throws {Error} if no available slug can be found after 1000 attempts
 *         (effectively never; safety bound) or if the base slug is empty
 */
export async function generateUniqueSlug(businessName, existsCheck) {
  const base = slugify(businessName)
  if (!base) {
    throw new Error('Cannot generate slug from empty business name')
  }

  // Try the base slug first — most common path.
  if (!RESERVED_SLUGS.has(base) && !(await existsCheck(base))) {
    return base
  }

  // Then -2, -3, ..., up to a safety bound.
  for (let i = 2; i < 1000; i++) {
    const candidate = `${base}-${i}`
    if (candidate.length > 50) continue
    if (RESERVED_SLUGS.has(candidate)) continue
    if (!(await existsCheck(candidate))) {
      return candidate
    }
  }

  throw new Error('No available slug found after 1000 attempts')
}

/**
 * Convenience: turn an internal error code from validateSlug() into a
 * human-readable English message. The Settings UI / API route should
 * route through lib/i18n.js for localization; this is a fallback.
 */
export function describeSlugError(code) {
  switch (code) {
    case 'empty':     return 'Slug is required.'
    case 'tooShort':  return 'Slug must be at least 3 characters.'
    case 'tooLong':   return 'Slug must be 50 characters or fewer.'
    case 'badChars':  return 'Slug can only contain lowercase letters, numbers, and hyphens.'
    case 'reserved':  return 'That slug is reserved. Please choose another.'
    default:          return null
  }
}
