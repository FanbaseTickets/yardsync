/**
 * GET/POST /api/admin/referral-card
 *
 * Reads/writes the founder referral-card profile shown on the public /grow
 * page (name, title, headshot + per-field visibility toggles). Admin-only.
 *
 * Stored as a singleton: referralCards/founder. Written via firestoreRest
 * (authenticated as admin) so no Firestore security-rule change is needed.
 *
 * Forward-compat: when the founder expands to multiple partners, this becomes
 * one of many referralCards docs keyed by a slug.
 */

import { NextResponse } from 'next/server'
import { getDocument, setDocument } from '@/lib/firestoreRest'

const API_KEY = process.env.FIREBASE_API_KEY || process.env.NEXT_PUBLIC_FIREBASE_API_KEY
const DOC_ID  = 'founder'

async function verifyAdmin(request) {
  const auth = request.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) return false
  try {
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${API_KEY}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken: auth.slice(7) }) }
    )
    if (!res.ok) return false
    const data = await res.json()
    return data.users?.[0]?.email === process.env.ADMIN_EMAIL
  } catch {
    return false
  }
}

export async function GET(request) {
  if (!(await verifyAdmin(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const doc = await getDocument('referralCards', DOC_ID)
    return NextResponse.json({ card: doc?.data || null })
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Failed to load' }, { status: 500 })
  }
}

export async function POST(request) {
  if (!(await verifyAdmin(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const body = await request.json()
    const card = {
      founderName:        String(body.founderName || '').trim().slice(0, 80),
      founderTitle:       String(body.founderTitle || '').trim().slice(0, 80),
      founderHeadshotUrl: String(body.founderHeadshotUrl || '').trim(),
      showName:           body.showName === true,
      showTitle:          body.showTitle === true,
      showHeadshot:       body.showHeadshot === true,
      updatedAt:          new Date().toISOString(),
    }
    await setDocument('referralCards', DOC_ID, card)
    return NextResponse.json({ ok: true, card })
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Failed to save' }, { status: 500 })
  }
}
