// Strip to the 10-digit local number, dropping an optional leading US "+1".
function toLocal10(phone) {
  const d = String(phone || '').replace(/\D/g, '')
  return d.length === 11 && d[0] === '1' ? d.slice(1) : d
}

// Strict NANP validation: exactly 10 digits (after an optional +1), the area
// code and exchange must each start 2-9 (NANP forbids a leading 0/1), and we
// reject all-same-digit junk like 0000000000 / 1111111111. This stops the
// "10 random digits pass" gibberish the old length-only check allowed.
export function validatePhone(phone) {
  const local = toLocal10(phone)
  if (local.length !== 10) return false
  if (/^(\d)\1{9}$/.test(local)) return false          // all identical digits
  return /^[2-9]\d{2}[2-9]\d{6}$/.test(local)           // valid area + exchange
}

// Normalize to E.164 (+1XXXXXXXXXX) or null if invalid.
export function normalizePhone(phone) {
  if (!validatePhone(phone)) return null
  return `+1${toLocal10(phone)}`
}

export function formatPhone(phone) {
  const d = phone.replace(/\D/g, '')
  if (d.length === 10) return `(${d.slice(0,3)}) ${d.slice(3,6)}-${d.slice(6)}`
  if (d.length === 11 && d[0] === '1') return `(${d.slice(1,4)}) ${d.slice(4,7)}-${d.slice(7)}`
  return phone
}
