import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { listCollection } from '@/lib/firestoreRest'

/**
 * Weekly health check (runs Mondays 14:00 UTC per vercel.json).
 *
 * Verifies every external service YardSync depends on is reachable and that
 * every critical env var is set. On any failure, sends an admin SMS via the
 * A2P-registered Messaging Service so we hear about outages without having
 * to read Vercel logs manually.
 *
 * Response shape (per the 2026-06-03 audit):
 *   {
 *     status: 'healthy' | 'degraded' | 'down',
 *     checks: {
 *       firestore: 'ok' | 'error: …',
 *       stripe:    'ok (live mode)' | 'ok (test mode)' | 'error: …',
 *       twilio:    'ok' | 'error: …',
 *       anthropic: 'ok' | 'missing key',
 *       envVars:   'ok' | 'missing: …',
 *     },
 *     timestamp: ISO string,
 *   }
 *
 *   - 'healthy'  = everything passed
 *   - 'degraded' = a non-critical check failed (Anthropic missing, env vars missing)
 *   - 'down'     = a critical service is unreachable (Firestore, Stripe, or Twilio)
 *
 * HTTP status: 200 for healthy/degraded, 503 for down.
 */

const REQUIRED_ENV_VARS = [
  'NEXT_PUBLIC_APP_URL',
  'NEXT_PUBLIC_FIREBASE_API_KEY',
  'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
  'STRIPE_SECRET_KEY',
  'STRIPE_PRICE_MONTHLY',
  'STRIPE_PRICE_ANNUAL',
  'STRIPE_WEBHOOK_SECRET',
  'TWILIO_ACCOUNT_SID',
  'TWILIO_AUTH_TOKEN',
  'TWILIO_MESSAGING_SERVICE_SID',
  'ADMIN_PHONE_NUMBER',
  'CRON_SECRET',
]

export async function GET(request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const checks = {}
  const criticalFailures = []
  const degradedReasons = []

  // ── 1. Env vars ────────────────────────────────────────────────────────
  const missingVars = REQUIRED_ENV_VARS.filter(v => !process.env[v])
  if (missingVars.length === 0) {
    checks.envVars = 'ok'
  } else {
    checks.envVars = `missing: ${missingVars.join(', ')}`
    degradedReasons.push(`Missing env vars: ${missingVars.join(', ')}`)
  }

  // ── 2. Firestore — admin REST probe (lib/firestoreRest auths as admin) ──
  try {
    await listCollection('users', { limit: 1 })
    checks.firestore = 'ok'
  } catch (err) {
    checks.firestore = `error: ${err.message}`
    criticalFailures.push(`Firestore unreachable: ${err.message}`)
  }

  // ── 3. Stripe — verify secret key works and prices exist ────────────────
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
    const [monthly, annual] = await Promise.all([
      stripe.prices.retrieve(process.env.STRIPE_PRICE_MONTHLY),
      stripe.prices.retrieve(process.env.STRIPE_PRICE_ANNUAL),
    ])
    const isLive = process.env.STRIPE_SECRET_KEY?.startsWith('sk_live_')
    checks.stripe = isLive ? 'ok (live mode)' : 'ok (test mode)'
    if (!isLive) {
      degradedReasons.push('Stripe is in test mode — switch to live keys before launch')
    }
    if (!monthly.active) {
      checks.stripe = 'error: monthly price inactive'
      criticalFailures.push('Stripe monthly price is inactive')
    }
    if (!annual.active) {
      checks.stripe = 'error: annual price inactive'
      criticalFailures.push('Stripe annual price is inactive')
    }
  } catch (err) {
    checks.stripe = `error: ${err.message}`
    criticalFailures.push(`Stripe unreachable: ${err.message}`)
  }

  // ── 4. Twilio — light live API call to verify credentials work ──────────
  // GET /v1/Accounts/{SID}.json is free (just returns account metadata) and
  // confirms the SID + auth token are valid. Previously this check was env
  // presence only, which couldn't tell us if a leaked / rotated token had
  // happened.
  try {
    const sid    = process.env.TWILIO_ACCOUNT_SID
    const token  = process.env.TWILIO_AUTH_TOKEN
    const msgSvc = process.env.TWILIO_MESSAGING_SERVICE_SID
    if (!sid || !token)  throw new Error('TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN not set')
    if (!msgSvc)         throw new Error('TWILIO_MESSAGING_SERVICE_SID not set — SMS will fail')

    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}.json`,
      { headers: { Authorization: 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64') } }
    )
    if (!res.ok) {
      throw new Error(`Twilio account fetch returned ${res.status}`)
    }
    checks.twilio = 'ok'
  } catch (err) {
    checks.twilio = `error: ${err.message}`
    criticalFailures.push(`Twilio unreachable: ${err.message}`)
  }

  // ── 5. Anthropic — env presence (a live ping would cost credit) ─────────
  if (process.env.ANTHROPIC_API_KEY) {
    checks.anthropic = 'ok'
  } else {
    checks.anthropic = 'missing key'
    degradedReasons.push('ANTHROPIC_API_KEY not set — AI drafter will fail')
  }

  // ── 6. Connect webhook secret — production only ─────────────────────────
  // The connect destination (`yardsync-production-connect` in Stripe) signs
  // `account.updated` events with a separate secret. Without it, the multi-
  // secret signature verification in /api/stripe/webhook silently 400s every
  // Stripe Connect event, breaking the Settings banner + admin remediation
  // widget without surfacing anywhere. Test-mode connect setup is deferred,
  // so we only enforce this in live mode.
  const isLiveMode = process.env.STRIPE_SECRET_KEY?.startsWith('sk_live_')
  if (isLiveMode) {
    if (process.env.STRIPE_WEBHOOK_SECRET_CONNECT) {
      checks.connectWebhook = 'ok'
    } else {
      checks.connectWebhook = 'missing STRIPE_WEBHOOK_SECRET_CONNECT'
      degradedReasons.push('STRIPE_WEBHOOK_SECRET_CONNECT not set — Stripe Connect account.updated events will silently 400')
    }
  } else {
    checks.connectWebhook = 'skipped (not live mode)'
  }

  // ── Determine overall status ───────────────────────────────────────────
  let status = 'healthy'
  if (criticalFailures.length > 0)      status = 'down'
  else if (degradedReasons.length > 0)  status = 'degraded'

  const result = {
    status,
    checks,
    timestamp: new Date().toISOString(),
  }

  console.log(`[HEALTH] ${status.toUpperCase()}`, JSON.stringify(result, null, 2))

  // ── Admin SMS on any failure (best-effort — don't crash the cron) ──────
  if (status !== 'healthy') {
    await notifyAdminOnFailure(status, [...criticalFailures, ...degradedReasons])
  }

  return NextResponse.json(result, {
    status: criticalFailures.length > 0 ? 503 : 200,
  })
}

/**
 * Sends an admin SMS via Twilio MessagingServiceSid when the health check
 * reports a non-healthy status. Best-effort: silently logs if any required
 * piece (admin phone, Twilio creds) is missing or if the send fails.
 */
async function notifyAdminOnFailure(status, failures) {
  const adminPhone = process.env.ADMIN_PHONE_NUMBER
  const sid        = process.env.TWILIO_ACCOUNT_SID
  const token      = process.env.TWILIO_AUTH_TOKEN
  const msgSvc     = process.env.TWILIO_MESSAGING_SERVICE_SID

  if (!adminPhone || !sid || !token || !msgSvc) {
    console.warn('[health] cannot notify admin — missing Twilio config or ADMIN_PHONE_NUMBER')
    return
  }

  try {
    const digits = adminPhone.replace(/\D/g, '')
    const to     = digits.startsWith('1') ? `+${digits}` : `+1${digits}`

    // Truncate the failure list to keep the SMS to a single segment when possible.
    const summary = failures.join('; ').slice(0, 240)
    const body    = `YardSync health check ${status.toUpperCase()} — ${summary}. Check Vercel logs immediately.`

    const appUrl  = process.env.NEXT_PUBLIC_APP_URL || 'https://yardsync.vercel.app'
    const cbUrl   = `${appUrl}/api/twilio/status-callback?ctx=health_alert`
    const params  = new URLSearchParams({
      To:                  to,
      MessagingServiceSid: msgSvc,
      Body:                body,
      StatusCallback:      cbUrl,
    })

    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Content-Type':  'application/x-www-form-urlencoded',
          Authorization: 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64'),
        },
        body: params.toString(),
      }
    )

    if (res.ok) {
      console.log('[health] admin failure SMS sent')
    } else {
      const errText = await res.text()
      console.error('[health] admin SMS Twilio returned non-OK:', res.status, errText)
    }
  } catch (err) {
    console.error('[health] admin SMS failed (non-fatal):', err.message)
  }
}
