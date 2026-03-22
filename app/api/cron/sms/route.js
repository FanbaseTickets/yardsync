import { NextResponse } from 'next/server'
import { formatDate } from '@/lib/date'
import { formatDateForSMS } from '@/lib/i18n'
import { collection, getDocs, query, where, doc, updateDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'

const TWILIO_SID   = process.env.TWILIO_ACCOUNT_SID
const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN
const TWILIO_FROM  = process.env.TWILIO_PHONE_NUMBER

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
    const today   = formatDate(new Date())
    const results = { sent: 0, skipped: 0, errors: 0 }

    const usersSnap   = await getDocs(query(
      collection(db, 'users'),
      where('subscriptionStatus', '==', 'active')
    ))
    const clientsSnap = await getDocs(collection(db, 'clients'))
    const allClients  = clientsSnap.docs.map(d => ({ id: d.id, ...d.data() }))

    for (const userDoc of usersSnap.docs) {
      const gardener = { id: userDoc.id, ...userDoc.data() }
      const timing   = gardener.reminderTiming || '48'
      const language = gardener.language || 'en'
      const template = language === 'es'
        ? (gardener.smsTemplateEs || 'Hola {name}! Su servicio de jardín está programado para {date} a las {time}. ¡Hasta pronto! — {business}')
        : (gardener.smsTemplate   || 'Hi {name}! Your yard service is scheduled for {date} at {time}. See you then! — {business}')

      // Determine target dates based on reminder timing
      const targetDates = []
      if (timing === 'all') {
        targetDates.push(
          today,
          formatDate(addDaysToDate(new Date(), 1)),
          formatDate(addDaysToDate(new Date(), 2)),
          formatDate(addDaysToDate(new Date(), 3))
        )
      } else if (timing === '0') {
        targetDates.push(today)
      } else {
        const hoursAhead = parseInt(timing)
        const daysAhead  = Math.round(hoursAhead / 24)
        targetDates.push(formatDate(addDaysToDate(new Date(), daysAhead)))
      }

      const schedulesSnap = await getDocs(query(
        collection(db, 'schedules'),
        where('gardenerUid', '==', gardener.id),
        where('smsSent',     '==', false)
      ))

      const pending = schedulesSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
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
          const body = new URLSearchParams({ To: to, From: TWILIO_FROM, Body: message })
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
            await updateDoc(doc(db, 'schedules', schedule.id), {
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

    for (const userDoc of usersSnap.docs) {
      const gardener = { id: userDoc.id, ...userDoc.data() }
      if (!gardener.phone) { summaryResults.skipped++; continue }

      // Get today's schedules for this gardener
      const todaySchedulesSnap = await getDocs(query(
        collection(db, 'schedules'),
        where('gardenerUid', '==', gardener.id),
        where('serviceDate', '==', today),
        where('status',      '==', 'scheduled')
      ))

      const todayJobs = todaySchedulesSnap.docs.map(d => ({ id: d.id, ...d.data() }))
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

      const summaryMessage = language === 'es'
        ? `¡Buenos días ${firstName}! Tienes ${jobCount} trabajo${jobCount !== 1 ? 's' : ''} hoy: ${jobList}. — YardSync`
        : `Good morning ${firstName}! You have ${jobCount} job${jobCount !== 1 ? 's' : ''} today: ${jobList}. — YardSync`

      const digits = gardener.phone.replace(/\D/g, '')
      if (digits.length < 10) { summaryResults.skipped++; continue }
      const to     = digits.startsWith('1') ? `+${digits}` : `+1${digits}`

      try {
        const body = new URLSearchParams({ To: to, From: TWILIO_FROM, Body: summaryMessage })
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
    const feeReminderResults = { sent: 0, skipped: 0 }
    const dayOfMonth = now.getDate()
    const monthNum   = now.getMonth() // 0-indexed
    const isReminderDay = dayOfMonth === 1 && [2, 5, 8, 11].includes(monthNum)

    if (isReminderDay) {
      const currentQ = Math.floor(monthNum / 3) + 1
      const qLabel   = `Q${currentQ}`
      const qStart   = new Date(now.getFullYear(), (currentQ - 1) * 3, 1)
      const qEnd     = new Date(now.getFullYear(), currentQ * 3, 0, 23, 59, 59)

      const allInvoicesSnap = await getDocs(collection(db, 'invoices'))
      const allInvoices     = allInvoicesSnap.docs.map(d => ({ id: d.id, ...d.data() }))

      for (const gDoc of usersSnap.docs) {
        const g = { id: gDoc.id, ...gDoc.data() }
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
        const msg = g.language === 'es'
          ? `Hola ${firstName}! Tus tarifas de plataforma YardSync de ${qLabel} son $${amount}. Vencen al final del trimestre. Paga en yardsync.vercel.app/settings — YardSync`
          : `Hi ${firstName}! Your YardSync ${qLabel} platform fees are $${amount}. Due end of quarter. Pay at yardsync.vercel.app/settings — YardSync`

        try {
          const digits = g.phone.replace(/\D/g, '')
          if (digits.length < 10) { feeReminderResults.skipped++; continue }
          const to   = digits.startsWith('1') ? `+${digits}` : `+1${digits}`
          const body = new URLSearchParams({ To: to, From: TWILIO_FROM, Body: msg })
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