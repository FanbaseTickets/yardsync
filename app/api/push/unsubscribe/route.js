import { NextResponse } from 'next/server'
import { getDocument, updateDocument } from '@/lib/firestoreRest'

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

// Removes a push subscription (by endpoint) from the contractor's users doc.
export async function POST(request) {
  try {
    const callerUid = await verifyCallerUid(request)
    if (!callerUid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { gardenerUid, endpoint } = await request.json()
    if (!gardenerUid || gardenerUid !== callerUid) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const userDoc  = await getDocument('users', gardenerUid)
    const existing = Array.isArray(userDoc?.data?.pushSubscriptions) ? userDoc.data.pushSubscriptions : []
    const kept     = endpoint ? existing.filter(s => s.endpoint !== endpoint) : []

    await updateDocument('users', gardenerUid, {
      pushSubscriptions: kept,
      updatedAt:         new Date().toISOString(),
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('push/unsubscribe error:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
