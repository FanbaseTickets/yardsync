export function getSquareBaseUrl() {
  const env = process.env.SQUARE_ENVIRONMENT || 'sandbox'
  return env === 'production'
    ? 'https://connect.squareup.com'
    : 'https://connect.squareupsandbox.com'
}

export function getSquareHeaders(accessToken) {
  return {
    'Square-Version': '2024-01-18',
    'Authorization':  `Bearer ${accessToken}`,
    'Content-Type':   'application/json',
  }
}

export function idempotencyKey() {
  return `ys-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export async function refreshSquareToken(refreshToken) {
  const baseUrl = getSquareBaseUrl()
  const res = await fetch(`${baseUrl}/oauth2/token`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id:     process.env.SQUARE_APPLICATION_ID,
      client_secret: process.env.SQUARE_APPLICATION_SECRET,
      grant_type:    'refresh_token',
      refresh_token: refreshToken,
    }),
  })
  const data = await res.json()
  if (!data.access_token) throw new Error('Failed to refresh Square token')
  return {
    accessToken:  data.access_token,
    refreshToken: data.refresh_token,
    expiresAt:    data.expires_at,
  }
}
