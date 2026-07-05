import { NextResponse } from 'next/server'
import { createDocument, getDocument } from '@/lib/firestoreRest'
import { verifyCallerUid, ensureBusiness } from '@/lib/crew'
import { getBaseUrl } from '@/lib/baseUrl'
import { sendSms } from '@/lib/sms'
import { sendClientEmail } from '@/lib/email'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// POST /api/crew/invite — authed OWNER invites a crew member (Worker).
// Creates a pending `memberships` doc (server-only write) + sends an accept link
// by SMS/email. Memberships are server-mediated so a worker can't self-grant.
export async function POST(req) {
  try {
    const caller = await verifyCallerUid(req)
    if (!caller) return NextResponse.json({ error: 'Unauthorized', code: 'unauthorized' }, { status: 401 })

    const { name, phone, email, lang } = await req.json()
    const cleanName = String(name || '').trim().slice(0, 80)
    if (!cleanName) return NextResponse.json({ error: 'Name is required', code: 'no_name' }, { status: 400 })
    if (!phone && !email) return NextResponse.json({ error: 'A phone or email is required', code: 'no_contact' }, { status: 400 })
    if (email && !EMAIL_RE.test(email)) return NextResponse.json({ error: 'Invalid email', code: 'bad_email' }, { status: 400 })

    // Gate (Crew Phase 2): crew requires an active subscription — each accepted
    // member bills as a +$15/mo seat on it (lib/crewBilling.js). Block inviting
    // without one so seats always have a sub to attach to.
    const owner = await getDocument('users', caller.uid)
    if (owner?.data?.subscriptionStatus !== 'active' || !owner?.data?.stripeSubscriptionId) {
      return NextResponse.json({ error: 'Start your subscription to add crew members', code: 'sub_required' }, { status: 402 })
    }

    const biz = await ensureBusiness(caller.uid)
    const es  = lang === 'es'
    const token = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`

    const inviteId = await createDocument('memberships', {
      businessUid:  caller.uid,          // businessId === ownerUid
      businessName: biz.name || 'YardSync',
      businessSlug: owner?.data?.publicSlug || '',   // for the member's crew card URL
      memberUid:    null,                // set on accept
      role:         'worker',
      status:       'invited',
      inviteName:   cleanName,
      invitePhone:  phone || '',
      inviteEmail:  email || '',
      inviteToken:  token,
      invitedByUid: caller.uid,
      createdAt:    new Date().toISOString(),
      updatedAt:    new Date().toISOString(),
    })

    const link = `${getBaseUrl(req)}/crew/join?token=${token}`
    const biz_ = biz.name || 'YardSync'

    // Invite send (non-fatal). Crew invites are relationship messages; STOP kept
    // for A2P consistency since this goes through the Messaging Service.
    try {
      if (phone) {
        const body = es
          ? `${cleanName}, ${biz_} te invitó a unirte a su equipo en YardSync. Acepta aquí: ${link}. Responde STOP para cancelar. – YardSync`
          : `${cleanName}, ${biz_} invited you to join their crew on YardSync. Accept here: ${link}. Reply STOP to opt out. – YardSync`
        await sendSms({ to: phone, body, context: 'crew_invite', refIds: { gardenerUid: caller.uid, inviteId } })
      }
      if (email) {
        await sendClientEmail({
          to: email,
          subject: es ? `${biz_} te invitó a su equipo` : `${biz_} invited you to their crew`,
          text: es ? `${biz_} te invitó a unirte a su equipo en YardSync. Acepta aquí: ${link}` : `${biz_} invited you to join their crew on YardSync. Accept here: ${link}`,
          html: `<p>${es ? `<strong>${biz_}</strong> te invitó a unirte a su equipo en YardSync.` : `<strong>${biz_}</strong> invited you to join their crew on YardSync.`}</p><p><a href="${link}">${es ? 'Aceptar invitación' : 'Accept invitation'}</a></p>`,
          fromName: biz_,
        })
      }
    } catch (e) { console.error('[crew] invite send failed (non-fatal):', e.message) }

    return NextResponse.json({ ok: true, inviteId })
  } catch (err) {
    console.error('[crew] invite failed:', err.message)
    return NextResponse.json({ error: 'Could not send the invite — please try again', code: 'invite_failed' }, { status: 500 })
  }
}
