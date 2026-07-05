import { NextResponse } from 'next/server'
import { getDocument } from '@/lib/firestoreRest'
import { verifyCallerUid, membershipId } from '@/lib/crew'
import { sendPush } from '@/lib/push'

// POST /api/crew/notify-assigned — the OWNER pings a crew member that a job was
// assigned to them. The schedule write itself stays client-side (owner-scoped by
// the rules); this only fires the push. Guarded so an owner can only notify their
// OWN active members (deterministic membership id).
export async function POST(req) {
  try {
    const caller = await verifyCallerUid(req)
    if (!caller) return NextResponse.json({ error: 'Unauthorized', code: 'unauthorized' }, { status: 401 })

    const { memberUid, serviceDate, serviceLabel, serviceAddress, scheduleId, count } = await req.json()
    if (!memberUid) return NextResponse.json({ error: 'Missing memberUid', code: 'no_member' }, { status: 400 })

    // Caller must actually own this member (active membership in the caller's crew).
    const m = await getDocument('memberships', membershipId(caller.uid, memberUid))
    if (m?.data?.status !== 'active') {
      return NextResponse.json({ error: 'Not your crew member', code: 'not_member' }, { status: 403 })
    }

    const n = Number(count) || 1
    const when = serviceDate || ''
    // Push carries lock-screen actions (#3): Navigate → maps, Mark complete → app.
    await sendPush(memberUid, {
      title: n > 1 ? `${n} new jobs assigned` : 'New job assigned',
      body: [when, serviceLabel].filter(Boolean).join(' · ') || 'Tap to see the details.',
      url: '/calendar',
      tag: scheduleId ? `assigned-${scheduleId}` : undefined,
      actions: [
        ...(serviceAddress ? [{ action: 'navigate', title: 'Navigate' }] : []),
        ...(scheduleId ? [{ action: 'complete', title: 'Mark complete' }] : []),
      ],
      navigateUrl: serviceAddress ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(serviceAddress)}` : undefined,
      scheduleId: scheduleId || undefined,
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[crew] notify-assigned failed:', err.message)
    // Non-fatal to the caller — the assignment already happened.
    return NextResponse.json({ ok: false }, { status: 200 })
  }
}
