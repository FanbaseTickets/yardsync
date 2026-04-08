/**
 * Email helper using Resend.
 *
 * Required env vars:
 *   RESEND_API_KEY        — from resend.com
 *   RESEND_FROM_EMAIL     — verified sender, e.g. 'YardSync <noreply@yardsyncapp.com>'
 *   ADMIN_EMAIL           — where admin alerts go (e.g. admin@fanbasetickets.net)
 *
 * Fails silently — admin email is a non-critical alert path.
 */

import { Resend } from 'resend'

let cachedClient = null

function getClient() {
  if (cachedClient) return cachedClient
  const key = process.env.RESEND_API_KEY
  if (!key) return null
  cachedClient = new Resend(key)
  return cachedClient
}

export async function sendAdminEmail({ subject, html, text }) {
  try {
    const client = getClient()
    if (!client) {
      console.log('Email skipped — RESEND_API_KEY not set')
      return { skipped: true }
    }
    const to = process.env.ADMIN_EMAIL
    if (!to) {
      console.log('Email skipped — ADMIN_EMAIL not set')
      return { skipped: true }
    }
    const from = process.env.RESEND_FROM_EMAIL || 'YardSync <noreply@yardsyncapp.com>'
    const result = await client.emails.send({ from, to, subject, html, text })
    if (result.error) {
      console.error('Resend error:', result.error)
      return { ok: false, error: result.error }
    }
    return { ok: true, id: result.data?.id }
  } catch (err) {
    console.error('sendAdminEmail failed (non-fatal):', err.message)
    return { ok: false, error: err.message }
  }
}
