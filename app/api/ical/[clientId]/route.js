import { NextResponse } from 'next/server'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'

export const dynamic = 'force-dynamic'

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

function esc(str) {
  return (str || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
}

export async function GET(request, { params }) {
  try {
    const { clientId } = await params
    const { searchParams } = new URL(request.url)
    const scheduleId = searchParams.get('scheduleId')

    if (!scheduleId) {
      return NextResponse.json({ error: 'Missing scheduleId' }, { status: 400 })
    }

    // Read from public icalEvents collection (no auth required — public read rule)
    const snap = await getDoc(doc(db, 'icalEvents', scheduleId))
    if (!snap.exists()) {
      return NextResponse.json({ error: 'Calendar event not found' }, { status: 404 })
    }
    const data = snap.data()

    // Security: verify clientId matches
    if (data.clientId !== clientId) {
      return NextResponse.json({ error: 'Event does not match client' }, { status: 403 })
    }

    // Build iCal from stored event data
    const dtStart = toICalDate(data.serviceDate, data.time)
    const dtEnd   = addHour(dtStart)
    const summary = `${data.serviceLabel || 'Lawn Care Service'} — ${data.businessName || 'YardSync'}`

    const ical = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//YardSync//EN',
      `X-WR-CALNAME:${esc(data.businessName || 'YardSync')}`,
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:${scheduleId}@yardsync.app`,
      `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z`,
      `DTSTART:${dtStart}`,
      `DTEND:${dtEnd}`,
      `SUMMARY:${esc(summary)}`,
      `DESCRIPTION:${esc(data.description || '')}`,
      `LOCATION:${esc(data.address || '')}`,
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n')

    const safeName = (data.clientName || 'client').replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()

    return new NextResponse(ical, {
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': `attachment; filename="yardsync-${safeName}.ics"`,
        'Cache-Control': 'no-cache',
      },
    })
  } catch (err) {
    console.error('iCal generation failed:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
