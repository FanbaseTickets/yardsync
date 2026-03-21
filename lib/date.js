const MONTHS  = ['January','February','March','April','May','June','July','August','September','October','November','December']
const MONTHS3 = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const DAYS    = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
const DAYS3   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

function pad(n) { return String(n).padStart(2, '0') }

export function fmt(date, str) {
  const d = typeof date === 'string' ? new Date(date + 'T12:00:00') : date
  return str
    .replace('MMMM', MONTHS[d.getMonth()])
    .replace('MMM',  MONTHS3[d.getMonth()])
    .replace('EEEE', DAYS[d.getDay()])
    .replace('EEE',  DAYS3[d.getDay()])
    .replace('yyyy', d.getFullYear())
    .replace('MM',   pad(d.getMonth() + 1))
    .replace('dd',   pad(d.getDate()))
    .replace(/\bd\b/, d.getDate())
}

export function formatDate(date) {
  const d = typeof date === 'string' ? new Date(date + 'T12:00:00') : date
  return d.toISOString().split('T')[0]
}

export function formatDateReadable(dateStr) {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}
