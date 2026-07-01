import { NextResponse } from 'next/server'
import { formatDate } from '@/lib/date'
import { listCollection, updateDocument, getDocument } from '@/lib/firestoreRest'
import { chargeClientForVisit } from '@/lib/autoCharge'
import { sendPush } from '@/lib/push'

// AUTO-CHARGE cron — daily. For each recurring visit due TODAY whose client has
// auto-billing on (card on file + authorized), charge the saved card off-session
// (falls back to a payment link on decline/3DS). Claim-before-charge guarantees
// one charge per visit even if the cron is retried.
//
// Scheduled 13:00 UTC (vercel.json) — same timezone invariant as the SMS cron:
// at 13:00 UTC the UTC date == every US local date, and schedules store
// serviceDate in the contractor's local date, so the match is correct US-wide.
export async function GET(request) {
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Master kill-switch (settings/platform.autoChargeEnabled). Fail-safe OFF:
  // any missing/unreadable/non-true value disables auto-charge so we never move
  // real money unexpectedly. Flip ON in Admin when ready.
  try {
    const cfg = await getDocument('settings', 'platform')
    if (cfg?.data?.autoChargeEnabled !== true) {
      return NextResponse.json({ ok: true, skipped: 'auto-charge-disabled' })
    }
  } catch {
    return NextResponse.json({ ok: true, skipped: 'auto-charge-config-unreadable' })
  }

  try {
    const now     = new Date()
    const today   = formatDate(now)
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://yardsync.vercel.app'
    const results = { charged: 0, fallback: 0, skippedNoAmount: 0, skippedNoCard: 0, gateBlocked: 0, errors: 0 }

    // Contractors who can charge: active OR free_until_paid (the in-lib gate
    // confirms Connect/card). Clients with auto-billing on, indexed by id.
    const users   = [
      ...(await listCollection('users', { where: [{ field: 'subscriptionStatus', value: 'active' }] })),
      ...(await listCollection('users', { where: [{ field: 'subscriptionStatus', value: 'free_until_paid' }] })),
    ]
    const autoClients = (await listCollection('clients', { where: [{ field: 'autoBilling', value: true }] }))
      .map(c => ({ id: c.id, ...c.data }))

    for (const user of users) {
      const contractor = { id: user.id, ...user.data }
      const myClients  = autoClients.filter(c => c.gardenerUid === contractor.id && c.status !== 'paused' && c.status !== 'cancelled')
      if (myClients.length === 0) continue

      const dueToday = (await listCollection('schedules', {
        where: [
          { field: 'gardenerUid', value: contractor.id },
          { field: 'serviceDate', value: today },
          { field: 'status',      value: 'scheduled' },
        ],
      }))
        .map(s => ({ id: s.id, ...s.data }))
        .filter(s => !s.isWalkIn && !s.autoChargedAt && !s.autoChargeCancelledAt)   // idempotency + client-cancelled

      let myCharged = 0, myFallback = 0, myTotalCents = 0   // for the contractor digest
      for (const visit of dueToday) {
        const client = myClients.find(c => c.id === visit.clientId)
        if (!client) continue

        // CLAIM the visit before charging — excludes it from any overlapping run.
        try {
          await updateDocument('schedules', visit.id, { autoChargedAt: new Date().toISOString(), autoChargeStatus: 'pending' })
        } catch (e) {
          console.error('[auto-charge] claim failed, skipping visit:', visit.id, e.message)
          results.errors++
          continue
        }

        let r
        try {
          r = await chargeClientForVisit({
            contractor, gardenerUid: contractor.id, client, clientId: client.id, visit, baseUrl,
          })
        } catch (e) {
          console.error('[auto-charge] charge threw:', e.message)
          r = { ok: false, code: 'error' }
        }

        // Record the outcome; clear the claim for RETRYABLE gate failures so the
        // next day retries (contractor may finish setup); keep it for permanent.
        if (r.ok && r.charged) {
          await updateDocument('schedules', visit.id, { autoChargeStatus: 'charged', autoChargeId: r.invoiceId || null })
          results.charged++; myCharged++; myTotalCents += r.billedCents || 0
        } else if (r.ok && r.fallback) {
          await updateDocument('schedules', visit.id, { autoChargeStatus: 'fallback_link', autoChargeId: r.invoiceId || null })
          results.fallback++; myFallback++
        } else if (r.code === 'no_connect' || r.code === 'no_card' || r.code === 'no_platform_card') {
          await updateDocument('schedules', visit.id, { autoChargedAt: null, autoChargeStatus: null })   // retry tomorrow
          if (r.code === 'no_card') results.skippedNoCard++; else results.gateBlocked++
        } else if (r.code === 'no_amount') {
          await updateDocument('schedules', visit.id, { autoChargeStatus: 'skipped', autoChargeSkipReason: 'no_amount' })
          results.skippedNoAmount++
        } else {
          await updateDocument('schedules', visit.id, { autoChargeStatus: 'error' })
          results.errors++
        }
      }

      // Contractor sync: push a digest so the contractor knows what auto-charged
      // today (and what fell back to a payment link).
      if (myCharged > 0 || myFallback > 0) {
        const cl  = contractor.language === 'es' ? 'es' : 'en'
        const amt = `$${(myTotalCents / 100).toFixed(2)}`
        await sendPush(contractor.id, {
          title: cl === 'es' ? 'Cobros automáticos de hoy' : "Today's auto-charges",
          body:  cl === 'es'
            ? `Se cobró a ${myCharged} cliente(s) (${amt})${myFallback ? `; ${myFallback} no se pudo cobrar — enviamos enlace de pago` : ''}.`
            : `Charged ${myCharged} client(s) (${amt})${myFallback ? `; ${myFallback} couldn't be charged — sent a payment link` : ''}.`,
          url: '/dashboard',
        })
      }
    }

    console.log('[auto-charge] complete:', results)
    return NextResponse.json({ success: true, ...results })
  } catch (err) {
    console.error('[auto-charge] cron failed:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
