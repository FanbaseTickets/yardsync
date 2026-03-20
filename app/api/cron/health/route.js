import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { collection, getDocs, query, limit } from 'firebase/firestore'
import { db } from '@/lib/firebase'

const REQUIRED_ENV_VARS = [
  'NEXT_PUBLIC_APP_URL',
  'NEXT_PUBLIC_FIREBASE_API_KEY',
  'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
  'STRIPE_SECRET_KEY',
  'STRIPE_PRICE_MONTHLY',
  'STRIPE_PRICE_ANNUAL',
  'STRIPE_WEBHOOK_SECRET',
  'SQUARE_ACCESS_TOKEN',
  'SQUARE_LOCATION_ID',
  'TWILIO_ACCOUNT_SID',
  'TWILIO_AUTH_TOKEN',
  'TWILIO_PHONE_NUMBER',
  'CRON_SECRET',
]

export async function GET(request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const checks = {}
  const warnings = []
  const errors = []

  // 1. Environment variables
  const missing = REQUIRED_ENV_VARS.filter(v => !process.env[v])
  if (missing.length === 0) {
    checks.env = 'ok'
  } else {
    checks.env = `missing: ${missing.join(', ')}`
    errors.push(`Missing env vars: ${missing.join(', ')}`)
  }

  // 2. Firebase — lightweight read to confirm connectivity
  try {
    await getDocs(query(collection(db, 'users'), limit(1)))
    checks.firebase = 'ok'
  } catch (err) {
    checks.firebase = `error: ${err.message}`
    errors.push(`Firebase unreachable: ${err.message}`)
  }

  // 3. Stripe — verify secret key works and prices exist
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
    const [monthly, annual] = await Promise.all([
      stripe.prices.retrieve(process.env.STRIPE_PRICE_MONTHLY),
      stripe.prices.retrieve(process.env.STRIPE_PRICE_ANNUAL),
    ])
    const isLive = process.env.STRIPE_SECRET_KEY?.startsWith('sk_live_')
    checks.stripe = isLive ? 'ok (live mode)' : 'ok (test mode — switch to live before launch)'
    if (!isLive) warnings.push('Stripe is in test mode — update to live keys before launch')
    if (!monthly.active) errors.push('Stripe monthly price is inactive')
    if (!annual.active)  errors.push('Stripe annual price is inactive')
  } catch (err) {
    checks.stripe = `error: ${err.message}`
    errors.push(`Stripe error: ${err.message}`)
  }

  // 4. Square — env presence + sandbox detection
  const squareToken = process.env.SQUARE_ACCESS_TOKEN || ''
  if (!squareToken) {
    checks.square = 'missing token'
    errors.push('Square access token not set')
  } else {
    const isSandbox = squareToken.includes('sandbox') || squareToken.startsWith('EAAAlq')
    checks.square = isSandbox ? 'sandbox (switch to production before launch)' : 'ok (production)'
    if (isSandbox) warnings.push('Square is in sandbox mode — switch to production before launch')
  }

  // 5. Twilio — env presence check (live ping would cost money)
  const twilioReady = process.env.TWILIO_ACCOUNT_SID &&
                      process.env.TWILIO_AUTH_TOKEN &&
                      process.env.TWILIO_PHONE_NUMBER
  if (twilioReady) {
    checks.twilio = 'configured'
  } else {
    checks.twilio = 'not configured — SMS will fail'
    errors.push('Twilio credentials missing: TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_PHONE_NUMBER')
  }

  const status = errors.length > 0 ? 'degraded' : warnings.length > 0 ? 'warning' : 'healthy'

  const result = {
    status,
    timestamp: new Date().toISOString(),
    checks,
    warnings,
    errors,
  }

  console.log(`[HEALTH] ${status.toUpperCase()}`, JSON.stringify(result, null, 2))

  return NextResponse.json(result, {
    status: errors.length > 0 ? 207 : 200,
  })
}
