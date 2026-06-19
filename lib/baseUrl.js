/**
 * Resolve the base URL for redirects + customer-facing links from the actual
 * inbound request, so that flows like Stripe Checkout (success_url) and
 * invoice payment links route back to the *same* deployment the user is on —
 * Preview, Production, or localhost — instead of always sending them to the
 * single value of NEXT_PUBLIC_APP_URL.
 *
 * Before this helper, Preview signups → Stripe Checkout → success → were
 * bounced to https://yardsyncapp.com (the prod-pinned env var), dropping the
 * user's Preview auth context entirely.
 *
 * For server-initiated calls that have no inbound request (cron jobs,
 * background webhooks), pass `null` or omit — the helper falls back to
 * NEXT_PUBLIC_APP_URL.
 */
export function getBaseUrl(request) {
  if (request) {
    try {
      const host = request.headers.get('host')
      if (host) {
        const proto = host.includes('localhost') ? 'http' : 'https'
        return `${proto}://${host}`
      }
    } catch {
      /* fall through */
    }
  }
  return process.env.NEXT_PUBLIC_APP_URL || 'https://yardsyncapp.com'
}
