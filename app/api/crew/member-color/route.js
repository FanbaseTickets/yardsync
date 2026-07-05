import { NextResponse } from 'next/server'
import { updateDocument, getDocument } from '@/lib/firestoreRest'
import { verifyCallerUid, membershipId } from '@/lib/crew'

// Palette must mirror CREW_PALETTE in app/calendar/CalendarContent.js.
const ALLOWED = ['#6366f1', '#ec4899', '#f59e0b', '#0ea5e9', '#8b5cf6', '#ef4444', '#10b981', '#f97316']

// POST /api/crew/member-color — authed OWNER sets one of THEIR crew member's
// calendar colors. The deterministic id `{ownerUid}_{memberUid}` scopes the write
// to the caller's own crew. Server-mediated (memberships are admin-write-only).
export async function POST(req) {
  try {
    const caller = await verifyCallerUid(req)
    if (!caller) return NextResponse.json({ error: 'Unauthorized', code: 'unauthorized' }, { status: 401 })

    const { memberUid, color } = await req.json()
    if (!memberUid) return NextResponse.json({ error: 'Missing memberUid', code: 'no_member' }, { status: 400 })
    if (!ALLOWED.includes(color)) return NextResponse.json({ error: 'Invalid color', code: 'bad_color' }, { status: 400 })

    const memId = membershipId(caller.uid, memberUid)   // owner's crew only
    const m = await getDocument('memberships', memId)
    if (!m?.data) return NextResponse.json({ error: 'Membership not found', code: 'not_found' }, { status: 404 })

    await updateDocument('memberships', memId, { memberColor: color, updatedAt: new Date().toISOString() })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[crew] member-color failed:', err.message)
    return NextResponse.json({ error: 'Could not save the color', code: 'color_failed' }, { status: 500 })
  }
}
