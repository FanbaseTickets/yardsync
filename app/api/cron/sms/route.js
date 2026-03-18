import { NextResponse } from 'next/server'
import { collection, getDocs, query, where, doc, updateDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { format, addDays } from 'date-fns'

const TWILIO_SID   = process.env.TWILIO_ACCOUNT_SID
const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN
const TWILIO_FROM  = process.env.TWILIO_PHONE_NUMBER

// Only allow Vercel cron to call this
export async function GET(request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const today    = format(new Date(), 'yyyy-MM-dd')
    const results  = { sent: 0, skipped: 0, errors: 0 }

    // Load all gardener profiles to get their reminder timing settings
    const usersSnap    = await getDocs(collection(db, 'users'))
    const clientsSnap  = await getDocs(collection(db, 'clients'))
    const allClients   = clientsSnap.docs.map(d => ({ id: d.id, ...d.data() }))

    for (const userDoc of usersSnap.docs) {
      const gardener = { id: userDoc.id, ...userDoc.data() }
      const timing   = gardener.reminderTiming || '48'
      const language = gardener.language || 'en'
      const template = language === 'es'
        ? (gardener.smsTemplateEs || 'Hola {name}! Su servicio de jardín está programado para {date} a las {time}. ¡Hasta pronto! — {business}')
        : (gardener.smsTemplate   || 'Hi {name}! Your yard service is scheduled for {date} at {time}. See you then! — {business}')

      // Determine which target dates to check based on reminder timing
      const targetDates = []
      if (timing === 'all') {
        targetDates.push(
          format(addDays(new Date(), 1), 'yyyy-MM-dd'), // 24hr
          format(addDays(new Date(), 2), 'yyyy-MM-dd'), // 48hr
          format(addDays(new Date(), 3), 'yyyy-MM-dd'), // 72hr
          today                                          // day-of
        )
      } else if (timing === '0') {
        targetDates.push(today)
      } else {
        targetDates.push(format(addDays(new Date(), parseInt(timing) / 24), 'yyyy-MM-dd'))
      }

      // Find unset schedules for this gardener on target dates
      const schedulesSnap = await getDocs(query(
        collection(db, 'schedules'),
        where('gardenerUid', '==', gardener.id),
        where('smsSent', '==', false)
      ))

      const pending = schedulesSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(s => targetDates.includes(s.serviceDate) && s.status === 'scheduled')

      for (const schedule of pending) {
        const client = allClients.find(c => c.id === schedule.clientId)
        if (!client?.phone) { results.skipped++; continue }

        // Build message
        const firstName = client.name?.split(' ')[0] || client.name
        const dateFormatted = format(new Date(schedule.serviceDate + 'T12:00:00'), 'MMMM d, yyyy')
        const message = template
          .replace('{name}',     firstName)
          .replace('{date}',     dateFormatted)
          .replace('{time}',     schedule.time || 'TBD')
          .replace('{business}', gardener.businessName || 'YardSync')

        // Normalize phone
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
            // Mark as sent in Firestore
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

    console.log('Cron complete:', results)
    return NextResponse.json({ success: true, ...results })

  } catch (err) {
    console.error('Cron job failed:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
```

Save both files. Now add one more env var — open `.env.local` and add this line at the bottom:
```
CRON_SECRET=yardsync-cron-2026