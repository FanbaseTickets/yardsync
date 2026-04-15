// Lightweight email format check + typo detector for common domains.
// Used by Add-Client / Edit-Client / walk-in modals.

// RFC-5322-ish — good enough to catch obvious typos without rejecting valid edge cases.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function isValidEmail(email) {
  if (!email) return false
  return EMAIL_RE.test(email.trim())
}

// Common domain typos → canonical domain. Lowercased on lookup.
const DOMAIN_TYPOS = {
  'gmail.con':     'gmail.com',
  'gmial.com':     'gmail.com',
  'gmai.com':      'gmail.com',
  'gnail.com':     'gmail.com',
  'gmali.com':     'gmail.com',
  'gmail.co':      'gmail.com',
  'gmail.cm':      'gmail.com',
  'hotmial.com':   'hotmail.com',
  'hotmai.com':    'hotmail.com',
  'hotmal.com':    'hotmail.com',
  'hotmail.con':   'hotmail.com',
  'hotmail.co':    'hotmail.com',
  'yaho.com':      'yahoo.com',
  'yahooo.com':    'yahoo.com',
  'yahoo.con':     'yahoo.com',
  'yahoo.co':      'yahoo.com',
  'outlok.com':    'outlook.com',
  'outlook.con':   'outlook.com',
  'icloud.con':    'icloud.com',
  'icloud.co':     'icloud.com',
  'aol.con':       'aol.com',
}

// Returns a suggested correction (e.g. "sarah@gmail.com") if the email's
// domain looks like a known typo, otherwise null.
export function suggestEmailCorrection(email) {
  if (!email) return null
  const trimmed = email.trim()
  const at = trimmed.lastIndexOf('@')
  if (at === -1) return null
  const local = trimmed.slice(0, at)
  const domain = trimmed.slice(at + 1).toLowerCase()
  const fixed = DOMAIN_TYPOS[domain]
  if (!fixed || !local) return null
  return `${local}@${fixed}`
}
