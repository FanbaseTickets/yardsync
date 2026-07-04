import { NextResponse } from 'next/server'
import { updateDocument, getDocument } from '@/lib/firestoreRest'
import { verifyCallerUid, membershipId } from '@/lib/crew'

// POST /api/crew/remove — authed OWNER removes a crew member from THEIR business.
// The deterministic id `{ownerUid}_{memberUid}` means the caller can only ever
// remove members of their own business. Sets status:'removed' (soft) so the
// rules immediately stop granting that worker access.
export async function POST(req) {
  try {
    const caller = await verifyCallerUid(req)
    if (!caller) return NextResponse.json({ error: 'Unauthorized', code: 'unauthorized' }, { status: 401 })

    const { memberUid } = await req.json()
    if (!memberUid) return NextResponse.json({ error: 'Missing memberUid', code: 'no_member' }, { status: 400 })

    const memId = membershipId(caller.uid, memberUid)   // owner's business only
    const m = await getDocument('memberships', memId)
    if (!m?.data) return NextResponse.json({ error: 'Membership not found', code: 'not_found' }, { status: 404 })

    await updateDocument('memberships', memId, { status: 'removed', removedAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[crew] remove failed:', err.message)
    return NextResponse.json({ error: 'Could not remove the member — please try again', code: 'remove_failed' }, { status: 500 })
  }
}
