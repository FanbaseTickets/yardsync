import { NextResponse } from 'next/server'
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

function formatDate(date) {
  return date.toISOString().split('T')[0]
}

function formatDateReadable(dateStr) {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

export async function GET(request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const today   = formatDate(new Date())
    const results = { sent: 0, skipped: 0, errors: 0 }

    const usersSnap   = await getDocs(collection(db, 'users'))
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
        const dateFormatted = formatDateReadable(schedule.serviceDate)
        const message       = template
          .replace('{name}',     firstName)
          .replace('{date}',     dateFormatted)
          .replace('{time}',     schedule.time || 'TBD')
          .replace('{business}', gardener.businessName || 'YardSync')

        const digits = client.phone.replace(/\D/g, '')
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
            console.log(`SMS sent → ${client.name} (${to}) for ${schedule.serviceDate}`)
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
          console.log(`Job summary sent → ${gardener.name} (${to}) — ${jobCount} jobs`)
        } else {
          console.error(`Summary error for ${gardener.name}:`, data)
          summaryResults.errors++
        }
      } catch (err) {
        console.error(`Failed to send summary to ${gardener.name}:`, err)
        summaryResults.errors++
      }
    }

    console.log('Cron complete:', results, '| Summaries:', summaryResults)
    return NextResponse.json({ success: true, clientReminders: results, gardenerSummaries: summaryResults })

  } catch (err) {
    console.error('Cron job failed:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}