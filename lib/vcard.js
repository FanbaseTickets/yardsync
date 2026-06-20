/**
 * vCard 3.0 builder for the YardSync digital business card.
 *
 * Why 3.0 (not 4.0): iOS Contacts and Android share-sheets accept both,
 * but 3.0 has wider downstream tooling support (Outlook, older Android
 * builds). Pure-ASCII line folding per RFC 2426; CRLF line endings.
 *
 * Privacy: TEL and EMAIL are gated by showContactPhone / showContactEmail.
 * The card URL is always included so a recipient can come back to the
 * card even if they don't have a direct contact channel saved.
 */

const CRLF = '\r\n'

function escape(value) {
  if (value == null) return ''
  return String(value)
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;')
}

// Fold long lines at 75 octets per RFC 2426 §2.6 — continuation lines
// start with a single space.
function fold(line) {
  if (line.length <= 75) return line
  const parts = []
  let i = 0
  while (i < line.length) {
    if (i === 0) {
      parts.push(line.slice(0, 75))
      i = 75
    } else {
      parts.push(' ' + line.slice(i, i + 74))
      i += 74
    }
  }
  return parts.join(CRLF)
}

/**
 * Build a vCard 3.0 string.
 *
 * @param {object} opts
 * @param {string} opts.businessName     — required (FN + ORG)
 * @param {string} [opts.phone]          — E.164; only included if showPhone is true
 * @param {string} [opts.email]          — only included if showEmail is true
 * @param {boolean} [opts.showPhone]
 * @param {boolean} [opts.showEmail]
 * @param {string} [opts.url]            — public card URL
 * @param {string} [opts.photoURL]       — absolute URL to headshot or logo
 * @param {string} [opts.tagline]        — used as TITLE (job-title-ish role)
 * @param {string} [opts.serviceArea]    — used as ADR locality fallback
 * @returns {string} vCard text (CRLF-terminated lines)
 */
export function buildVCard({
  businessName,
  phone,
  email,
  showPhone = true,
  showEmail = false,
  url,
  photoURL,
  tagline,
  serviceArea,
}) {
  if (!businessName) {
    throw new Error('vCard requires a businessName')
  }

  const lines = []
  lines.push('BEGIN:VCARD')
  lines.push('VERSION:3.0')
  lines.push(`FN:${escape(businessName)}`)
  // N (structured name) — 5 semicolon-separated components, family/given/etc.
  // For a business, putting the name in family-name is a reasonable convention.
  lines.push(`N:${escape(businessName)};;;;`)
  lines.push(`ORG:${escape(businessName)}`)

  if (tagline) {
    lines.push(`TITLE:${escape(tagline)}`)
  }
  if (showPhone && phone) {
    // Normalize to E.164: a 10-digit US number stored as "9107230609"
    // becomes "+19107230609". If the input already has a + prefix or
    // isn't 10 digits, pass it through unchanged.
    const digits = String(phone).replace(/\D/g, '')
    const e164   = digits.length === 10 ? `+1${digits}` : (String(phone).startsWith('+') ? String(phone) : `+${digits}`)
    lines.push(`TEL;TYPE=CELL,VOICE:${escape(e164)}`)
  }
  if (showEmail && email) {
    lines.push(`EMAIL;TYPE=INTERNET:${escape(email)}`)
  }
  if (url) {
    lines.push(`URL:${escape(url)}`)
  }
  if (photoURL) {
    lines.push(`PHOTO;VALUE=URI:${escape(photoURL)}`)
  }
  if (serviceArea) {
    // ADR has 7 components: post-office-box, ext-address, street, locality,
    // region, postal-code, country. Drop the free-text into locality.
    lines.push(`ADR;TYPE=WORK:;;;${escape(serviceArea)};;;`)
  }
  lines.push('END:VCARD')

  return lines.map(fold).join(CRLF) + CRLF
}
