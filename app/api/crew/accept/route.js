import { NextResponse } from 'next/server'
import { listCollection, setDocument, updateDocument, getDocument } from '@/lib/firestoreRest'
import { verifyCallerUid, membershipId } from '@/lib/crew'

// POST /api/crew/accept — the invited person (authed) consumes their token and
// becomes an active Worker. Writes the DETERMINISTIC membership doc the security
// rules key on (`{businessUid}_{memberUid}`). Server-only write.
export async function POST(req) {
  try {
    const caller = await verifyCallerUid(req)
    if (!caller) return NextResponse.json({ error: 'Unauthorized', code: 'unauthorized' }, { status: 401 })

    const { token } = await req.json()
    if (!token) return NextResponse.json({ error: 'Missing invite token', code: 'no_token' }, { status: 400 })

    const invites = (await listCollection('memberships', { where: [{ field: 'inviteToken', value: String(token) }] }))
      .map(m => ({ id: m.id, ...m.data }))
    const invite = invites[0]
    if (!invite) return NextResponse.json({ error: 'Invite not found or expired', code: 'bad_token' }, { status: 404 })
    if (invite.status !== 'invited') return NextResponse.json({ error: 'This invite was already used', code: 'used' }, { status: 409 })
    // A person can't be a Worker in their OWN business.
    if (invite.businessUid === caller.uid) return NextResponse.json({ error: "You can't join your own business as a crew member", code: 'self' }, { status: 409 })

    const nowIso = new Date().toISOString()
    const memId = membershipId(invite.businessUid, caller.uid)

    // Idempotent: if already active, just report success.
    const existing = await getDocument('memberships', memId)
    if (existing?.data?.status !== 'active') {
      await setDocument('memberships', memId, {
        businessUid:  invite.businessUid,
        businessName: invite.businessName || '',
        memberUid:    caller.uid,
        memberEmail:  caller.email || '',
        inviteName:   invite.inviteName || '',   // friendly name for the team list + assign dropdown
        role:         invite.role || 'worker',
        status:       'active',
        invitedByUid: invite.invitedByUid || invite.businessUid,
        acceptedAt:   nowIso,
        createdAt:    invite.createdAt || nowIso,
        updatedAt:    nowIso,
      })
    }
    // Retire the pending invite doc.
    try { await updateDocument('memberships', invite.id, { status: 'accepted', memberUid: caller.uid, updatedAt: nowIso }) } catch {}

    // A new crew member with NO own Stripe Connect never set up as an owner → flag
    // crewMode so the app shows them a scoped Worker experience (schedule only). A
    // hustler who already runs their own business (stripeAccountId set) stays a
    // full owner. The nav gates on crewMode && !stripeAccountId, so if they later
    // onboard Connect the full app returns automatically.
    try {
      const u = await getDocument('users', caller.uid)
      if (u?.data && !u.data.stripeAccountId && u.data.crewMode !== true) {
        await updateDocument('users', caller.uid, { crewMode: true, updatedAt: nowIso })
      }
    } catch {}

    return NextResponse.json({ ok: true, businessUid: invite.businessUid, businessName: invite.businessName || '' })
  } catch (err) {
    console.error('[crew] accept failed:', err.message)
    return NextResponse.json({ error: 'Could not accept the invite — please try again', code: 'accept_failed' }, { status: 500 })
  }
}
