import { NextResponse } from 'next/server'

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
      return NextResponse.json({ error: 'Missing scheduleId query parameter' }, { status: 400 })
    }

    // Lazy-load Admin SDK at runtime (not during build)
    const { getAdminDb } = await import('@/lib/firebaseAdmin')
    const adminDb = getAdminDb()
    const scheduleSnap = await adminDb.collection('schedules').doc(scheduleId).get()
    if (!scheduleSnap.exists) {
      return NextResponse.json({ error: 'Schedule not found' }, { status: 404 })
    }
    const schedule = { id: scheduleSnap.id, ...scheduleSnap.data() }

    // Security: verify schedule belongs to this client
    if (schedule.clientId !== clientId) {
      return NextResponse.json({ error: 'Schedule does not match client' }, { status: 403 })
    }

    // Fetch client
    const clientSnap = await adminDb.collection('clients').doc(clientId).get()
    if (!clientSnap.exists) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }
    const client = { id: clientSnap.id, ...clientSnap.data() }

    // Fetch gardener for business name
    let businessName = 'YardSync'
    if (client.gardenerUid) {
      const gardenerSnap = await adminDb.collection('users').doc(client.gardenerUid).get()
      if (gardenerSnap.exists) {
        const g = gardenerSnap.data()
        businessName = g.businessName || g.name || 'YardSync'
      }
    }

    // Build single-event iCal
    const dtStart = toICalDate(schedule.serviceDate, schedule.time)
    const dtEnd   = addHour(dtStart)
    const summary = `${client.packageLabel || 'Lawn Care Service'} — ${businessName}`

    const ical = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//YardSync//EN',
      `X-WR-CALNAME:${esc(businessName)}`,
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:${scheduleId}@yardsync.app`,
      `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z`,
      `DTSTART:${dtStart}`,
      `DTEND:${dtEnd}`,
      `SUMMARY:${esc(summary)}`,
      `DESCRIPTION:${esc((client.packageDesc || client.packageLabel || '') + (client.notes ? '\\n' + client.notes : ''))}`,
      `LOCATION:${esc(client.address || '')}`,
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n')

    const safeName = client.name.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()

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
