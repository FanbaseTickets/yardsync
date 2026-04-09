/**
 * Email helper using SendGrid.
 *
 * Required env vars:
 *   SENDGRID_API_KEY      — from SendGrid Settings → API Keys
 *   SENDGRID_FROM_EMAIL   — verified single sender or domain-authenticated address
 *   ADMIN_EMAIL           — where admin alerts go (e.g. admin@fanbasetickets.net)
 *
 * Fails silently — admin email is a non-critical alert path.
 */

import sgMail from '@sendgrid/mail'

let initialized = false

function init() {
  if (initialized) return true
  const key = process.env.SENDGRID_API_KEY
  if (!key) return false
  sgMail.setApiKey(key)
  initialized = true
  return true
}

export async function sendAdminEmail({ subject, html, text }) {
  try {
    if (!init()) {
      console.log('Email skipped — SENDGRID_API_KEY not set')
      return { skipped: true }
    }
    const to = process.env.ADMIN_EMAIL
    if (!to) {
      console.log('Email skipped — ADMIN_EMAIL not set')
      return { skipped: true }
    }
    const from = process.env.SENDGRID_FROM_EMAIL
    if (!from) {
      console.log('Email skipped — SENDGRID_FROM_EMAIL not set')
      return { skipped: true }
    }
    await sgMail.send({ to, from, subject, html, text })
    console.log('Admin email sent via SendGrid')
    return { ok: true }
  } catch (err) {
    const detail = err.response?.body?.errors?.[0]?.message || err.message
    console.error('sendAdminEmail failed (non-fatal):', detail)
    return { ok: false, error: detail }
  }
}
