import { NextResponse } from 'next/server'
import { updateDocument, getDocument } from '@/lib/firestoreRest'
import { verifyCallerUid, membershipId } from '@/lib/crew'
import { syncCrewSeats } from '@/lib/crewBilling'

// POST /api/crew/leave — an authed crew MEMBER removes THEMSELVES from a crew.
// The deterministic id `{businessUid}_{callerUid}` guarantees the caller can only
// ever affect their own membership, so no extra ownership check is needed.
// Soft-remove (status:'removed') + decrement the owner's seat billing.
export async function POST(req) {
  try {
    const caller = await verifyCallerUid(req)
    if (!caller) return NextResponse.json({ error: 'Unauthorized', code: 'unauthorized' }, { status: 401 })

    const { businessUid } = await req.json()
    if (!businessUid) return NextResponse.json({ error: 'Missing businessUid', code: 'no_business' }, { status: 400 })

    const memId = membershipId(businessUid, caller.uid)   // only the caller's own membership
    const m = await getDocument('memberships', memId)
    if (!m?.data || m.data.memberUid !== caller.uid) {
      return NextResponse.json({ error: 'Membership not found', code: 'not_found' }, { status: 404 })
    }
    // Already gone → idempotent success.
    if (m.data.status === 'active') {
      await updateDocument('memberships', memId, {
        status: 'removed', removedAt: new Date().toISOString(), removedBy: 'member', updatedAt: new Date().toISOString(),
      })
      // Drop the owner's seat count (prorated credit). Non-fatal.
      await syncCrewSeats(businessUid)
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[crew] leave failed:', err.message)
    return NextResponse.json({ error: 'Could not leave the crew — please try again', code: 'leave_failed' }, { status: 500 })
  }
}
