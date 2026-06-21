/**
 * GET/POST /api/admin/cron-control
 *
 * Reads/writes platform cron toggles. Admin-only. Currently exposes a single
 * master switch for the daily SMS reminder cron (app/api/cron/sms) so the
 * founder can pause all Twilio reminder sends from the dashboard while the
 * contractor base is still test data — no redeploy needed to flip it.
 *
 * Stored as a singleton: settings/platform. Written via firestoreRest
 * (authenticated as admin). The cron reads the same doc and fails safe to OFF
 * (see app/api/cron/sms/route.js), so a missing doc means "no sends".
 */

import { NextResponse } from 'next/server'
import { getDocument, setDocument } from '@/lib/firestoreRest'

const API_KEY = process.env.FIREBASE_API_KEY || process.env.NEXT_PUBLIC_FIREBASE_API_KEY
const DOC_ID  = 'platform'

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
    const doc = await getDocument('settings', DOC_ID)
    return NextResponse.json({ smsRemindersEnabled: doc?.data?.smsRemindersEnabled === true })
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
    const smsRemindersEnabled = body.smsRemindersEnabled === true
    await setDocument('settings', DOC_ID, {
      smsRemindersEnabled,
      updatedAt: new Date().toISOString(),
    })
    return NextResponse.json({ ok: true, smsRemindersEnabled })
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Failed to save' }, { status: 500 })
  }
}
