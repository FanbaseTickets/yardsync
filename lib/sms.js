/**
 * SMS helper using Twilio REST API.
 *
 * Required env vars:
 *   TWILIO_ACCOUNT_SID
 *   TWILIO_AUTH_TOKEN
 *   TWILIO_PHONE_NUMBER
 *
 * Fails silently — logs and returns { ok: false } instead of throwing —
 * so a Twilio outage never breaks the caller (cron, webhook, etc.).
 */

const TWILIO_SID   = process.env.TWILIO_ACCOUNT_SID
const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN
const TWILIO_FROM  = process.env.TWILIO_PHONE_NUMBER

export async function sendSms({ to, body }) {
  try {
    if (!TWILIO_SID || !TWILIO_TOKEN || !TWILIO_FROM) {
      console.log('SMS skipped — Twilio credentials not configured')
      return { skipped: true }
    }
    if (!to) {
      console.log('SMS skipped — no recipient phone')
      return { skipped: true }
    }

    const digits = String(to).replace(/\D/g, '')
    if (digits.length < 10) {
      console.log('SMS skipped — invalid phone number')
      return { skipped: true }
    }
    const normalizedTo = digits.startsWith('1') ? `+${digits}` : `+1${digits}`

    const params = new URLSearchParams({
      To:   normalizedTo,
      From: TWILIO_FROM,
      Body: body,
    })

    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`,
      {
        method:  'POST',
        headers: {
          'Content-Type':  'application/x-www-form-urlencoded',
          'Authorization': 'Basic ' + Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString('base64'),
        },
        body: params.toString(),
      }
    )

    const data = await res.json()

    if (data.status === 'failed' || data.error_code) {
      console.error('Twilio error:', data)
      return { ok: false, error: data.message || 'Twilio send failed' }
    }

    console.log('SMS sent — SID:', data.sid)
    return { ok: true, sid: data.sid }
  } catch (err) {
    console.error('sendSms failed (non-fatal):', err.message)
    return { ok: false, error: err.message }
  }
}
