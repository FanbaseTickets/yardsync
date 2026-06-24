/**
 * Tiny CSV builder + browser download. Used by the "export your data" feature
 * (Settings → Billing) so contractors can take their own clients + invoice
 * history with them — a trust signal at signup, not a churn lever (the value
 * layers — lead funnel, QR card, rewards, history — aren't portable).
 */

// CSV-escape a single cell: quote it if it contains a comma, quote, or newline,
// and double any internal quotes (RFC 4180).
function csvCell(value) {
  if (value == null) return ''
  const s = String(value)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/**
 * Build a CSV string from rows + a header spec.
 * @param {Array<object>} rows
 * @param {Array<{label: string, value: string | ((row) => any)}>} columns
 */
export function toCsv(rows, columns) {
  const head = columns.map(c => csvCell(c.label)).join(',')
  const lines = (rows || []).map(row =>
    columns.map(c => csvCell(typeof c.value === 'function' ? c.value(row) : row[c.value])).join(',')
  )
  return [head, ...lines].join('\r\n')
}

// Trigger a browser download of a CSV string. Prepends a UTF-8 BOM so Excel
// opens accented names (José, etc.) correctly.
export function downloadCsv(csv, filename) {
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// ISO string or Firestore timestamp → YYYY-MM-DD (or '').
export function csvDate(v) {
  if (!v) return ''
  const d = v?.toDate ? v.toDate() : new Date(v)
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10)
}
