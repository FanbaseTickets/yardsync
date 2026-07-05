import { NextResponse } from 'next/server'
import { listCollection } from '@/lib/firestoreRest'
import { syncCrewSeats } from '@/lib/crewBilling'

export const dynamic = 'force-dynamic'

// GET /api/cron/crew-seats-reconcile — safety net for crew seat billing.
// syncCrewSeats runs on accept/remove/plan-change, but any transient Stripe or
// Firestore failure there is swallowed non-fatally, which would leave a member
// active-but-unbilled or removed-but-billed. This cron re-runs syncCrewSeats for
// every business that currently has an active worker, repairing any drift
// (quantity off, orphaned/duplicate seat sub, wrong sub shape after a plan switch).
export async function GET(request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Distinct businesses with at least one active worker.
    const active = await listCollection('memberships', { where: [{ field: 'status', value: 'active' }] })
    const owners = [...new Set(
      active
        .filter(m => m.data.role === 'worker' && m.data.businessUid)
        .map(m => m.data.businessUid)
    )]

    let ok = 0, failed = 0
    for (const ownerUid of owners) {
      try { await syncCrewSeats(ownerUid); ok++ }
      catch (e) { failed++; console.error(`[crew-seats-reconcile] ${ownerUid} failed:`, e.message) }
    }

    console.log(`[crew-seats-reconcile] reconciled ${ok}/${owners.length} owner(s), ${failed} failed`)
    return NextResponse.json({ ok: true, reconciled: ok, failed, total: owners.length })
  } catch (err) {
    console.error('[crew-seats-reconcile] failed:', err.message)
    return NextResponse.json({ error: 'reconcile_failed' }, { status: 500 })
  }
}
