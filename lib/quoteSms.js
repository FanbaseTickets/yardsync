/**
 * Build the SMS body for a quote link.
 *
 * Sent server-side via lib/sms.js (which does NOT append STOP), so we include
 * the A2P opt-out line here — same approach as the auto-charge reminder cron.
 *
 * @param {object} opts
 * @param {object} opts.contractor    — users/{uid} doc (the gardener)
 * @param {string} opts.recipientName — client or prospect name
 * @param {number} opts.totalCents
 * @param {string} opts.quoteUrl
 * @param {'en'|'es'} [opts.lang='en']
 * @returns {string} SMS body
 */
export function buildQuoteSms({ contractor, recipientName, totalCents, quoteUrl, lang = 'en' }) {
  const dollars = (Number(totalCents || 0) / 100).toFixed(2)
  const biz     = contractor?.businessName || 'YardSync'
  const name    = recipientName || (lang === 'es' ? 'Hola' : 'Hi')

  if (lang === 'es') {
    return `Hola ${name}! ${biz} te envió una cotización de $${dollars}. Revísala y acéptala aquí: ${quoteUrl}. Responde STOP para cancelar. – YardSync`
  }
  return `Hi ${name}! ${biz} sent you a quote for $${dollars}. Review and accept it here: ${quoteUrl}. Reply STOP to opt out. – YardSync`
}
