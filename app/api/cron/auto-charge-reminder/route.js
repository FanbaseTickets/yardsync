import { NextResponse } from 'next/server'
import { formatDate } from '@/lib/date'
import { formatDateForSMS } from '@/lib/i18n'
import { listCollection, updateDocument, getDocument } from '@/lib/firestoreRest'
import { grossUpForFees } from '@/lib/fee'
import { sendSms } from '@/lib/sms'
import { sendClientEmail } from '@/lib/email'

const LEAD_DAYS = 3   // advance notice before an auto-charge

function addDays(date, days) { const d = new Date(date); d.setDate(d.getDate() + days); return d }

// AUTO-CHARGE advance reminder cron — daily. For each auto-billing visit
// LEAD_DAYS out, text/email the client that they'll be charged on the service
// date, with a way to cancel. Required for compliant recurring billing.
// Scheduled 13:00 UTC (same date invariant as the SMS cron).
export async function GET(request) {
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Shares the auto-charge kill-switch — no reminders if auto-charge is off.
  try {
    const cfg = await getDocument('settings', 'platform')
    if (cfg?.data?.autoChargeEnabled !== true) {
      return NextResponse.json({ ok: true, skipped: 'auto-charge-disabled' })
    }
  } catch {
    return NextResponse.json({ ok: true, skipped: 'auto-charge-config-unreadable' })
  }

  try {
    const now        = new Date()
    const targetDate = formatDate(addDays(now, LEAD_DAYS))
    const appUrl     = process.env.NEXT_PUBLIC_APP_URL || 'https://yardsync.vercel.app'
    const results    = { sent: 0, skipped: 0, errors: 0 }

    const users = [
      ...(await listCollection('users', { where: [{ field: 'subscriptionStatus', value: 'active' }] })),
      ...(await listCollection('users', { where: [{ field: 'subscriptionStatus', value: 'free_until_paid' }] })),
    ]
    const autoClients = (await listCollection('clients', { where: [{ field: 'autoBilling', value: true }] }))
      .map(c => ({ id: c.id, ...c.data }))

    for (const user of users) {
      const contractor = { id: user.id, ...user.data }
      const myClients  = autoClients.filter(c => c.gardenerUid === contractor.id && c.status !== 'paused' && c.status !== 'cancelled')
      if (myClients.length === 0) continue

      const upcoming = (await listCollection('schedules', {
        where: [
          { field: 'gardenerUid', value: contractor.id },
          { field: 'serviceDate', value: targetDate },
          { field: 'status',      value: 'scheduled' },
        ],
      }))
        .map(s => ({ id: s.id, ...s.data }))
        .filter(s => !s.isWalkIn && !s.chargeReminderSentAt && !s.autoChargeCancelledAt)

      for (const visit of upcoming) {
        const client = myClients.find(c => c.id === visit.clientId)
        if (!client?.clientPaymentMethodId) { results.skipped++; continue }

        const base   = client.basePriceCents || 0
        const extras = (visit.addons || []).reduce((s, a) => s + (a.amountCents || 0), 0)
        const mats   = (visit.materials || []).reduce((s, m) => s + (m.totalCents || 0), 0)
        let total    = base + extras + mats
        if ((client.coverFees ?? contractor.coverFees) === true) total = grossUpForFees(total)
        if (total < 50) { results.skipped++; continue }

        const lang    = client.language === 'es' ? 'es' : 'en'
        const amount  = `$${(total / 100).toFixed(2)}`
        const dateStr = formatDateForSMS(visit.serviceDate, lang)
        const biz     = contractor.businessName || 'YardSync'
        const last4   = client.clientCardLast4 ? `••${client.clientCardLast4}` : ''

        const smsBody = lang === 'es'
          ? `Aviso de ${biz}: cobraremos ${amount} a tu tarjeta ${last4} el ${dateStr} por tu servicio recurrente. Responde CANCELAR para detenerlo. Responda STOP para cancelar mensajes. – YardSync`
          : `Heads up from ${biz}: we'll charge ${amount} to your card ${last4} on ${dateStr} for your recurring service. Reply CANCEL to stop this charge. Reply STOP to opt out. – YardSync`

        try {
          let any = false
          if (client.phone) {
            const r = await sendSms({ to: client.phone, body: smsBody, context: 'auto_charge_reminder', refIds: { gardenerUid: contractor.id, clientId: client.id, scheduleId: visit.id } })
            any = any || r.ok || r.skipped
          }
          if (client.email) {
            await sendClientEmail({
              to: client.email,
              subject: lang === 'es' ? `Próximo cobro de ${biz} — ${amount}` : `Upcoming charge from ${biz} — ${amount}`,
              text: lang === 'es'
                ? `Cobraremos ${amount} a tu tarjeta ${last4} el ${dateStr} por tu servicio recurrente. Para cancelar este cobro, responde CANCELAR al mensaje de texto o contacta a ${biz}.`
                : `We'll charge ${amount} to your card ${last4} on ${dateStr} for your recurring service. To cancel this charge, reply CANCEL to the text or contact ${biz}.`,
              html: `<p>${lang === 'es' ? `Cobraremos <strong>${amount}</strong> a tu tarjeta ${last4} el <strong>${dateStr}</strong> por tu servicio recurrente.` : `We'll charge <strong>${amount}</strong> to your card ${last4} on <strong>${dateStr}</strong> for your recurring service.`}</p><p>${lang === 'es' ? 'Para cancelar este cobro, responde CANCELAR al mensaje de texto.' : 'To cancel this charge, reply CANCEL to the text message.'}</p>`,
              fromName: biz,
            })
            any = true
          }
          if (any) {
            await updateDocument('schedules', visit.id, { chargeReminderSentAt: new Date().toISOString() })
            results.sent++
          } else {
            results.skipped++
          }
        } catch (e) {
          console.error('[auto-charge-reminder] send failed:', e.message)
          results.errors++
        }
      }
    }

    console.log('[auto-charge-reminder] complete:', results)
    return NextResponse.json({ success: true, ...results })
  } catch (err) {
    console.error('[auto-charge-reminder] cron failed:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
