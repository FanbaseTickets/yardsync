import { NextResponse } from 'next/server'
import { getDocument } from '@/lib/firestoreRest'
import { sendPush } from '@/lib/push'

const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY || process.env.NEXT_PUBLIC_FIREBASE_API_KEY

async function verifyCallerUid(req) {
  const auth = req.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) return null
  try {
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_API_KEY}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken: auth.slice(7) }) }
    )
    if (!res.ok) return null
    const data = await res.json()
    return data.users?.[0]?.localId || null
  } catch {
    return null
  }
}

// Diagnostic: sends a test push to the caller's own devices and reports WHY it
// won't send if it can't — server VAPID keys missing vs no stored subscription.
export async function POST(request) {
  try {
    const callerUid = await verifyCallerUid(request)
    if (!callerUid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { gardenerUid } = await request.json()
    if (!gardenerUid || gardenerUid !== callerUid) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const configured = !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY)
    const userDoc    = await getDocument('users', gardenerUid)
    const subs       = userDoc?.data?.pushSubscriptions
    const subCount   = Array.isArray(subs) ? subs.length : 0

    if (configured && subCount > 0) {
      await sendPush(gardenerUid, {
        title: 'YardSync test ✅',
        body:  'Push notifications are working on this device.',
        url:   '/dashboard',
      })
    }

    return NextResponse.json({
      ok:            configured && subCount > 0,
      configured,                 // false → server VAPID keys missing in this scope
      subscriptions: subCount,    // 0 → no device subscribed (turn on push first)
    })
  } catch (err) {
    console.error('push/test error:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
