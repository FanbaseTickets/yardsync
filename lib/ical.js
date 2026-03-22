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

/**
 * Build a valid iCal (.ics) string from schedule and client data.
 * Runs entirely client-side — no API route needed.
 *
 * @param {object} params
 * @param {string} params.calendarName - e.g. "Rodriguez Lawn Care — Sarah Martinez"
 * @param {object} params.client - { name, address, notes, packageLabel }
 * @param {Array}  params.schedules - [{ id, serviceDate, time, ... }]
 * @returns {string} valid iCal content
 */
export function buildICalString({ calendarName, client, schedules }) {
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

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//YardSync//EN',
    `X-WR-CALNAME:${escapeIcal(calendarName)}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    ...events,
    'END:VCALENDAR',
  ].join('\r\n')
}

/**
 * Trigger a .ics file download in the browser.
 *
 * @param {string} icalContent - the iCal string
 * @param {string} fileName - e.g. "yardsync-sarah-martinez.ics"
 */
export function downloadICalFile(icalContent, fileName) {
  const blob = new Blob([icalContent], { type: 'text/calendar;charset=utf-8' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
