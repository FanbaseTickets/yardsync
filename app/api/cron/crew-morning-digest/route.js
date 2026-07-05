import { NextResponse } from 'next/server'
import { listCollection } from '@/lib/firestoreRest'
import { sendPush } from '@/lib/push'

export const dynamic = 'force-dynamic'

// GET /api/cron/crew-morning-digest — a morning push telling each person how many
// jobs they have today. Applies to OWNERS (their business's jobs) AND crew MEMBERS
// (jobs assigned to them, across any crew). Push-only + best-effort: a user with no
// push subscription is a silent no-op. Runs ~13:00 UTC (US morning) like the other
// crons; "today" = the UTC date, which matches the local date at that hour in the US.
export async function GET(request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const today = new Date().toISOString().slice(0, 10)   // yyyy-MM-dd
    const todays = await listCollection('schedules', { where: [{ field: 'serviceDate', value: today }] })
    const active = todays.filter(s => s.data.status !== 'completed' && s.data.status !== 'cancelled')

    // Tally: owners by their business (gardenerUid), members by assignment.
    const ownerCounts = {}
    const memberCounts = {}
    for (const s of active) {
      if (s.data.gardenerUid) ownerCounts[s.data.gardenerUid] = (ownerCounts[s.data.gardenerUid] || 0) + 1
      if (s.data.assignedTo)  memberCounts[s.data.assignedTo] = (memberCounts[s.data.assignedTo] || 0) + 1
    }

    let sent = 0
    // Owner digests.
    for (const [uid, n] of Object.entries(ownerCounts)) {
      await sendPush(uid, {
        title: n === 1 ? 'You have 1 job today' : `You have ${n} jobs today`,
        body: 'Tap to review your schedule.',
        url: '/calendar',
        tag: 'morning-digest',
      })
      sent++
    }
    // Member digests (jobs assigned to them). A hustler may get both — different crews.
    for (const [uid, n] of Object.entries(memberCounts)) {
      await sendPush(uid, {
        title: n === 1 ? 'You have 1 job today' : `You have ${n} jobs today`,
        body: 'Tap to see the addresses and mark them done.',
        url: '/calendar',
        tag: 'morning-digest-crew',
      })
      sent++
    }

    console.log(`[crew-morning-digest] ${today}: ${Object.keys(ownerCounts).length} owner(s) + ${Object.keys(memberCounts).length} member(s), ${sent} push(es)`)
    return NextResponse.json({ ok: true, date: today, owners: Object.keys(ownerCounts).length, members: Object.keys(memberCounts).length })
  } catch (err) {
    console.error('[crew-morning-digest] failed:', err.message)
    return NextResponse.json({ error: 'digest_failed' }, { status: 500 })
  }
}
