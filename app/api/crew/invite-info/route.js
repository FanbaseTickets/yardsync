import { NextResponse } from 'next/server'
import { listCollection } from '@/lib/firestoreRest'

// GET /api/crew/invite-info?token=... — PUBLIC, token-gated. Returns the minimal
// context the crew-join signup needs to pre-fill (business name + invitee name +
// email) so a brand-new worker only sets a password. The unguessable invite token
// IS the credential; we expose NOTHING sensitive (no money, clients, or uids) and
// only for a still-pending invite.
export async function GET(req) {
  try {
    const token = new URL(req.url).searchParams.get('token')
    if (!token) return NextResponse.json({ ok: false, code: 'no_token' }, { status: 400 })

    const rows = (await listCollection('memberships', { where: [{ field: 'inviteToken', value: String(token) }] }))
      .map(m => m.data)
    const invite = rows[0]
    if (!invite || invite.status !== 'invited') {
      return NextResponse.json({ ok: false, code: 'bad_token' }, { status: 404 })
    }

    return NextResponse.json({
      ok: true,
      businessName: invite.businessName || '',
      inviteName:   invite.inviteName || '',
      inviteEmail:  invite.inviteEmail || '',
    })
  } catch (err) {
    console.error('[crew] invite-info failed:', err.message)
    return NextResponse.json({ ok: false, code: 'error' }, { status: 500 })
  }
}
