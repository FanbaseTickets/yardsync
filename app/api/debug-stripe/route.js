import { NextResponse } from 'next/server'

// ⚠️ TEMPORARY DIAGNOSTIC ROUTE — DELETE AFTER LIVE-KEYS VERIFICATION
// This endpoint is intentionally unauthenticated so it can be hit quickly
// from any browser/curl. It does NOT return the full key, only the mode and
// first 12 characters (sk_test_XXXX or sk_live_XXXX, where the trailing 4
// chars are part of the key body). Delete this file once Production is
// verified to be on sk_live_*.
export async function GET() {
  const key = process.env.STRIPE_SECRET_KEY
  return NextResponse.json({
    keyPresent: !!key,
    keyMode: key?.startsWith('sk_live_')
      ? 'live'
      : key?.startsWith('sk_test_')
      ? 'test'
      : 'unknown or empty',
    keyPrefix: key?.substring(0, 12) || 'MISSING'
  })
}
