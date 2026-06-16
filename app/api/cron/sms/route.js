import { NextResponse } from 'next/server'
import { formatDate } from '@/lib/date'
import { formatDateForSMS } from '@/lib/i18n'
import { listCollection, setDocument, updateDocument } from '@/lib/firestoreRest'

const TWILIO_SID     = process.env.TWILIO_ACCOUNT_SID
const TWILIO_TOKEN   = process.env.TWILIO_AUTH_TOKEN
const TWILIO_MSG_SVC = process.env.TWILIO_MESSAGING_SERVICE_SID

function addDaysToDate(date, days) {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}


export async function GET(request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const now     = new Date()
    const today   = formatDate(now)
    const results = { sent: 0, skipped: 0, errors: 0 }

    // Firestore reads via lib/firestoreRest (admin REST auth). The previous
    // Firebase client SDK pattern had no auth context server-side and was
    // rejected by Firestore rules — daily SMS reminders silently failed.
    const users      = await listCollection('users', {
      where: [{ field: 'subscriptionStatus', value: 'active' }],
    })
    const allClients = (await listCollection('clients')).map(c => ({ id: c.id, ...c.data }))

    for (const user of users) {
      const gardener = { id: user.id, ...user.data }
      const timing   = gardener.reminderTiming || '48'
      const language = gardener.language || 'en'
      const template = language === 'es'
        ? (gardener.smsTemplateEs || 'Hola {name}! Su servicio de jardín está programado para {date} a las {time}. ¡Hasta pronto! Responda STOP para cancelar. – {business}')
        : (gardener.smsTemplate   || 'Hi {name}! Your yard service is scheduled for {date} at {time}. See you then! Reply STOP to opt out. – {business}')

      // Determine target dates based on reminder timing
      const targetDates = []
      if (timing === 'all') {
        targetDates.push(
          today,
          formatDate(addDaysToDate(now, 1)),
          formatDate(addDaysToDate(now, 2)),
          formatDate(addDaysToDate(now, 3))
        )
      } else if (timing === '0') {
        targetDates.push(today)
      } else {
        const hoursAhead = parseInt(timing)
        const daysAhead  = Math.round(hoursAhead / 24)
        targetDates.push(formatDate(addDaysToDate(now, daysAhead)))
      }

      const pendingSchedules = await listCollection('schedules', {
        where: [
          { field: 'gardenerUid', value: gardener.id },
          { field: 'smsSent',     value: false },
        ],
      })

      const pending = pendingSchedules
        .map(s => ({ id: s.id, ...s.data }))
        .filter(s => targetDates.includes(s.serviceDate) && s.status === 'scheduled')

      for (const schedule of pending) {
        const client = allClients.find(c => c.id === schedule.clientId)
        if (!client?.phone) { results.skipped++; continue }

        const firstName     = client.name?.split(' ')[0] || client.name
        const clientLang    = client.language || 'en'
        const dateFormatted = formatDateForSMS(schedule.serviceDate, clientLang)
        const message       = template
          .replace('{name}',     firstName)
          .replace('{date}',     dateFormatted)
          .replace('{time}',     schedule.time || 'TBD')
          .replace('{business}', gardener.businessName || 'YardSync')

        const digits = client.phone.replace(/\D/g, '')
        if (digits.length < 10) { results.skipped++; continue }
        const to     = digits.startsWith('1') ? `+${digits}` : `+1${digits}`

        try {
          // Write iCal event data — fail silently so SMS still sends
          try {
            await setDocument('icalEvents', schedule.id, {
              clientId:     schedule.clientId,
              clientName:   client.name || '',
              businessName: gardener.businessName || 'YardSync',
              serviceLabel: client.packageLabel || 'Lawn Care Service',
              serviceDate:  schedule.serviceDate,
              time:         schedule.time || '9:00 AM',
              address:      client.address || '',
              description:  (client.packageDesc || client.packageLabel || '') + (client.notes ? '\n' + client.notes : ''),
            })
          } catch (icalErr) {
            console.error('iCal write failed (SMS will still send):', icalErr.message)
          }

          // Always append calendar link — even if icalEvent write failed
          // the collection may populate on a future SMS or the gardener can retry
          const appUrl  = process.env.NEXT_PUBLIC_APP_URL || 'https://yardsync.vercel.app'
          const calUrl  = `${appUrl}/api/ical/${schedule.clientId}?scheduleId=${schedule.id}`
          const calLine = clientLang === 'es'
            ? `\n📅 Agregar al calendario: ${calUrl}`
            : `\n📅 Add to calendar: ${calUrl}`
          let finalMsg = message + calLine

          // A2P compliance — append STOP line if gardener's template doesn't already have it.
          // Existing pre-migration contractors have custom smsTemplate fields without STOP.
          const hasOptOut = /\bSTOP\s+to\s+opt\s+out\b/i.test(finalMsg) || /\bSTOP\s+para\s+cancelar\b/i.test(finalMsg)
          if (!hasOptOut) {
            finalMsg += clientLang === 'es'
              ? '\nResponda STOP para cancelar. – YardSync'
              : '\nReply STOP to opt out. – YardSync'
          }

          const cbUrl   = `${appUrl}/api/twilio/status-callback?ctx=cron_reminder&scheduleId=${schedule.id}&clientId=${schedule.clientId}&gardenerUid=${gardener.id}`
          const body = new URLSearchParams({ To: to, MessagingServiceSid: TWILIO_MSG_SVC, Body: finalMsg, StatusCallback: cbUrl })
          const res  = await fetch(
            `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`,
            {
              method:  'POST',
              headers: {
                'Content-Type':  'application/x-www-form-urlencoded',
                'Authorization': 'Basic ' + Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString('base64'),
              },
              body: body.toString(),
            }
          )

          const data = await res.json()

          if (data.sid) {
            await updateDocument('schedules', schedule.id, {
              smsSent:      true,
              smsSentAt:    new Date().toISOString(),
              twilioSmsSid: data.sid,
            })
            results.sent++
            console.log(`SMS sent → clientId:${schedule.clientId} date:${schedule.serviceDate}`)
          } else {
            console.error(`Twilio error for ${client.name}:`, data)
            results.errors++
          }
        } catch (err) {
          console.error(`Failed to send to ${client.name}:`, err)
          results.errors++
        }
      }
    }

    // ── GARDENER DAILY JOB SUMMARY ──────────────────────────────────────────
    // After sending client reminders, text each gardener their jobs for today
    const summaryResults = { sent: 0, skipped: 0, errors: 0 }

    for (const user of users) {
      const gardener = { id: user.id, ...user.data }
      if (!gardener.phone) { summaryResults.skipped++; continue }

      // Get today's schedules for this gardener
      const todaySchedules = await listCollection('schedules', {
        where: [
          { field: 'gardenerUid', value: gardener.id },
          { field: 'serviceDate', value: today },
          { field: 'status',      value: 'scheduled' },
        ],
      })

      const todayJobs = todaySchedules.map(s => ({ id: s.id, ...s.data }))
      if (todayJobs.length === 0) { summaryResults.skipped++; continue }

      // Build job list string
      const jobList = todayJobs
        .sort((a, b) => a.time?.localeCompare(b.time) || 0)
        .map(s => {
          const client = allClients.find(c => c.id === s.clientId)
          const name   = client?.name || s.clientName || 'Walk-in'
          return `${name} (${s.time || 'TBD'})`
        })
        .join(', ')

      const firstName = gardener.name?.split(' ')[0] || 'there'
      const jobCount  = todayJobs.length
      const language  = gardener.language || 'en'

      const summaryBody = language === 'es'
        ? `¡Buenos días ${firstName}! Tienes ${jobCount} trabajo${jobCount !== 1 ? 's' : ''} hoy: ${jobList}. — YardSync`
        : `Good morning ${firstName}! You have ${jobCount} job${jobCount !== 1 ? 's' : ''} today: ${jobList}. — YardSync`
      // A2P compliance — append STOP line (this body never had it)
      const summaryMessage = summaryBody + (language === 'es'
        ? '\nResponda STOP para cancelar. – YardSync'
        : '\nReply STOP to opt out. – YardSync')

      const digits = gardener.phone.replace(/\D/g, '')
      if (digits.length < 10) { summaryResults.skipped++; continue }
      const to     = digits.startsWith('1') ? `+${digits}` : `+1${digits}`

      try {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://yardsync.vercel.app'
        const cbUrl  = `${appUrl}/api/twilio/status-callback?ctx=cron_summary&gardenerUid=${gardener.id}`
        const body = new URLSearchParams({ To: to, MessagingServiceSid: TWILIO_MSG_SVC, Body: summaryMessage, StatusCallback: cbUrl })
        const res  = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`,
          {
            method:  'POST',
            headers: {
              'Content-Type':  'application/x-www-form-urlencoded',
              'Authorization': 'Basic ' + Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString('base64'),
            },
            body: body.toString(),
          }
        )
        const data = await res.json()
        if (data.sid) {
          summaryResults.sent++
          console.log(`Job summary sent → uid:${gardener.id} jobs:${jobCount}`)
        } else {
          console.error(`Summary error for ${gardener.name}:`, data)
          summaryResults.errors++
        }
      } catch (err) {
        console.error(`Failed to send summary to ${gardener.name}:`, err)
        summaryResults.errors++
      }
    }

    // ── PHASE 3: Quarterly fee reminder (runs on 1st of Mar, Jun, Sep, Dec) ──
    // NOTE: the prior version of this route referenced `now` here without
    // defining it earlier — once Firestore auth started working again this
    // block would have thrown a ReferenceError. Fixed by defining `now` at
    // the top of the try block.
    const feeReminderResults = { sent: 0, skipped: 0 }
    const dayOfMonth = now.getDate()
    const monthNum   = now.getMonth() // 0-indexed
    const isReminderDay = dayOfMonth === 1 && [2, 5, 8, 11].includes(monthNum)

    if (isReminderDay) {
      const currentQ = Math.floor(monthNum / 3) + 1
      const qLabel   = `Q${currentQ}`
      const qStart   = new Date(now.getFullYear(), (currentQ - 1) * 3, 1)
      const qEnd     = new Date(now.getFullYear(), currentQ * 3, 0, 23, 59, 59)

      const allInvoices = (await listCollection('invoices')).map(i => ({ id: i.id, ...i.data }))

      for (const user of users) {
        const g = { id: user.id, ...user.data }
        if (!g.phone) continue

        const uncollected = allInvoices.filter(inv => {
          if (inv.gardenerUid !== g.id || inv.feeCollected) return false
          const d = inv.createdAt?.toDate?.() || new Date(inv.createdAt)
          return d >= qStart && d <= qEnd
        })
        if (uncollected.length === 0) { feeReminderResults.skipped++; continue }

        const totalFees = uncollected.reduce((s, inv) => {
          const feeLines = inv.lineItems?.filter(l => l.category === 'fee') || []
          return s + feeLines.reduce((fs, l) => fs + (l.amountCents || 0), 0)
        }, 0)
        if (totalFees <= 0) { feeReminderResults.skipped++; continue }

        const firstName = g.name?.split(' ')[0] || 'there'
        const amount    = (totalFees / 100).toFixed(2)
        const msgBody = g.language === 'es'
          ? `Hola ${firstName}! Tus tarifas de plataforma YardSync de ${qLabel} son $${amount}. Vencen al final del trimestre. Paga en yardsync.vercel.app/settings — YardSync`
          : `Hi ${firstName}! Your YardSync ${qLabel} platform fees are $${amount}. Due end of quarter. Pay at yardsync.vercel.app/settings — YardSync`
        // A2P compliance — append STOP line (this body never had it)
        const msg = msgBody + (g.language === 'es'
          ? '\nResponda STOP para cancelar. – YardSync'
          : '\nReply STOP to opt out. – YardSync')

        try {
          const digits = g.phone.replace(/\D/g, '')
          if (digits.length < 10) { feeReminderResults.skipped++; continue }
          const to   = digits.startsWith('1') ? `+${digits}` : `+1${digits}`
          const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://yardsync.vercel.app'
          const cbUrl  = `${appUrl}/api/twilio/status-callback?ctx=cron_fee_reminder&gardenerUid=${g.id}`
          const body = new URLSearchParams({ To: to, MessagingServiceSid: TWILIO_MSG_SVC, Body: msg, StatusCallback: cbUrl })
          await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'Authorization': 'Basic ' + Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString('base64'),
            },
            body: body.toString(),
          })
          feeReminderResults.sent++
          console.log(`Fee reminder SMS → uid:${g.id} fees:${totalFees} quarter:${qLabel}`)
        } catch (err) {
          console.error(`Fee reminder failed → uid:${g.id}`, err.message)
        }
      }
    }

    console.log('Cron complete:', results, '| Summaries:', summaryResults, '| Fee reminders:', feeReminderResults)
    return NextResponse.json({ success: true, clientReminders: results, gardenerSummaries: summaryResults, feeReminders: feeReminderResults })

  } catch (err) {
    console.error('Cron job failed:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
