/**
 * POST /api/stripe/connect/remediation-link
 *
 * Generates a Stripe-hosted AccountLink the contractor can visit to submit
 * outstanding Connect KYC requirements (SSN last 4, DOB, bank account, etc.).
 *
 * Auth: Bearer <Firebase ID token> in the Authorization header. The token's
 * uid must match the user doc that owns the targeted stripeAccountId (i.e.
 * contractors can only generate links for their own account).
 *
 * Body: { } — none needed; the route reads the caller's user doc by uid.
 *
 * Returns: { url, expiresAt } where url is the Stripe-hosted form link
 * (single-use, expires after ~5 min per Stripe).
 *
 * Used by:
 *   - Contractor Settings banner (Complete on Stripe button)
 *   - Admin "Send remediation link" flow (calls this internally)
 */

import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { getDocument } from '@/lib/firestoreRest'
import { getBaseUrl } from '@/lib/baseUrl'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
const API_KEY = process.env.FIREBASE_API_KEY || process.env.NEXT_PUBLIC_FIREBASE_API_KEY

async function verifyContractorOrAdmin(request, targetUid) {
  const auth = request.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) return false
  const idToken = auth.slice(7)
  try {
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      }
    )
    if (!res.ok) return false
    const data = await res.json()
    const user = data.users?.[0]
    if (!user) return false
    if (user.email === process.env.ADMIN_EMAIL) return { ok: true, adminMode: true }
    if (user.localId === targetUid) return { ok: true, adminMode: false }
    return false
  } catch {
    return false
  }
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}))
    // Default: contractor calling for self. Admin can pass `contractorUid`
    // in the body to generate a link for a specific contractor.
    const contractorUid = body.contractorUid

    if (!contractorUid) {
      return NextResponse.json({ error: 'Missing contractorUid' }, { status: 400 })
    }

    const authResult = await verifyContractorOrAdmin(request, contractorUid)
    if (!authResult) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userDoc = await getDocument('users', contractorUid)
    if (!userDoc?.data?.stripeAccountId) {
      return NextResponse.json(
        { error: 'No Stripe Connect account found for this user' },
        { status: 400 }
      )
    }

    const baseUrl = getBaseUrl(request)
    // type: 'account_onboarding' is the only valid AccountLink type for
    // Express + Standard accounts. It's misleadingly named — Stripe uses
    // this type for both initial setup AND ongoing requirement updates
    // post-onboarding. 'account_update' only works for Custom accounts.
    const accountLink = await stripe.accountLinks.create({
      account:     userDoc.data.stripeAccountId,
      type:        'account_onboarding',
      refresh_url: `${baseUrl}/settings?stripe_refresh=1`,
      return_url:  `${baseUrl}/settings?stripe_return=1`,
    })

    return NextResponse.json({
      url:       accountLink.url,
      expiresAt: accountLink.expires_at, // epoch seconds
    })
  } catch (err) {
    console.error('remediation-link error:', err)
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
