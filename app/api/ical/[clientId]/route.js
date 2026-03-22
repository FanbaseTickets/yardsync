import { NextResponse } from 'next/server'
import { collection, getDocs, getDoc, doc, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'

function parseTime(timeStr) {
  if (!timeStr) return { hour: 9, minute: 0 }
  const match = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i)
  if (!match) return { hour: 9, minute: 0 }
  let hour = parseInt(match[1])
  const minute = parseInt(match[2])
  const ampm = (match[3] || '').toUpperCase()
  if (ampm === 'PM' && hour < 12) hour += 12
  if (ampm === 'AM' && hour === 12) hour = 0
  return { hour, minute }
}

function toICalDate(dateStr, timeStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const { hour, minute } = parseTime(timeStr)
  const pad = n => String(n).padStart(2, '0')
  return `${y}${pad(m)}${pad(d)}T${pad(hour)}${pad(minute)}00`
}

function addHour(icalDate) {
  const h = parseInt(icalDate.slice(9, 11)) + 1
  return icalDate.slice(0, 9) + String(h).padStart(2, '0') + icalDate.slice(11)
}

function escapeIcal(str) {
  return (str || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
}

export async function GET(request, { params }) {
  try {
    const { clientId } = await params

    // Fetch client
    const clientSnap = await getDoc(doc(db, 'clients', clientId))
    if (!clientSnap.exists()) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }
    const client = { id: clientSnap.id, ...clientSnap.data() }

    // Fetch gardener profile for business name
    let businessName = 'YardSync'
    if (client.gardenerUid) {
      const gardenerSnap = await getDoc(doc(db, 'users', client.gardenerUid))
      if (gardenerSnap.exists()) {
        businessName = gardenerSnap.data().businessName || gardenerSnap.data().name || 'YardSync'
      }
    }

    // Fetch scheduled visits for this client
    const q = query(
      collection(db, 'schedules'),
      where('clientId', '==', clientId),
      where('status', '==', 'scheduled')
    )
    const snap = await getDocs(q)
    const schedules = snap.docs.map(d => ({ id: d.id, ...d.data() }))

    // Build iCal
    const calName = `${businessName} — ${client.name}`
    const events = schedules.map(s => {
      const dtStart = toICalDate(s.serviceDate, s.time)
      const dtEnd   = addHour(dtStart)
      return [
        'BEGIN:VEVENT',
        `UID:${s.id}@yardsync.app`,
        `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z`,
        `DTSTART:${dtStart}`,
        `DTEND:${dtEnd}`,
        `SUMMARY:${escapeIcal(client.packageLabel || 'Lawn Care Service')}`,
        `DESCRIPTION:${escapeIcal((client.packageLabel || '') + (client.notes ? '\\n' + client.notes : ''))}`,
        `LOCATION:${escapeIcal(client.address || '')}`,
        'END:VEVENT',
      ].join('\r\n')
    })

    const ical = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//YardSync//EN',
      `X-WR-CALNAME:${escapeIcal(calName)}`,
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      ...events,
      'END:VCALENDAR',
    ].join('\r\n')

    const safeName = client.name.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()

    return new NextResponse(ical, {
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': `attachment; filename="yardsync-${safeName}.ics"`,
      },
    })
  } catch (err) {
    console.error('iCal generation failed:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
