// Polish Victor Scales' (scals) demo data — in-place field rewrites.
// Doc IDs, gardenerUid, and client/schedule/invoice relationships preserved.
//
// SAFETY (hard rule): every client gets phone=+19107230609 and an email
// alternating between Jay's two addresses, so any cron SMS or invoice
// notification can only reach Jay — never a real third party.
//
// Phase 1 (default): read Victor's collections, build a deterministic
//   proposal, save it to .victor-proposal.json, print before/after, STOP.
// Phase 2 (--execute): load .victor-proposal.json, apply PATCHes.
//
// USAGE:
//   $env:GCLOUD_TOKEN | Out-File -FilePath .gcloud-token -NoNewline -Encoding ascii
//   GCLOUD_TOKEN=$(cat .gcloud-token | tr -d '\r\n') node scripts/polish-victor-demo.mjs
//   GCLOUD_TOKEN=$(cat .gcloud-token | tr -d '\r\n') node scripts/polish-victor-demo.mjs --execute

import { readFileSync, writeFileSync, existsSync } from 'node:fs'

const PROJECT_ID = 'yardsync-41886'
const FS = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`
const VICTOR_UID = 'vRGRZqBh0zYThZFKpCk7zjNj6Qz2'
const JAY_PHONE = '+19107230609'
const JAY_EMAILS = ['johnsonjarius19@gmail.com', 'jarius_21@yahoo.com']
const PROPOSAL_FILE = '.victor-proposal.json'

const TOKEN = process.env.GCLOUD_TOKEN
if (!TOKEN || TOKEN.length < 100) {
  console.error('GCLOUD_TOKEN missing — bridge it first via .gcloud-token then export.')
  process.exit(1)
}
const EXECUTE = process.argv.includes('--execute')

// ── Realistic San Antonio client templates, deterministic per index
const CLIENT_TEMPLATES = [
  { name: 'María García',       address: '215 Madison St, San Antonio, TX 78204',          packageLabel: 'Weekly Mow & Edge',     packageDesc: 'Corte, recorte y soplado cada semana.',         priceCents: 6500,  language: 'es', preferredDay: 'monday'    },
  { name: 'James Robinson',     address: '8722 Broadway St, San Antonio, TX 78209',        packageLabel: 'Bi-Weekly Maintenance', packageDesc: 'Mow, edge, shrub trim — every 2 weeks.',        priceCents: 7500,  language: 'en', preferredDay: 'tuesday'   },
  { name: 'Sofía Hernández',    address: '4621 Hildebrand Ave, San Antonio, TX 78212',     packageLabel: 'Weekly Mow & Edge',     packageDesc: 'Corte semanal con bordes y limpieza.',          priceCents: 5500,  language: 'es', preferredDay: 'wednesday' },
  { name: 'Robert Chen',        address: '18402 Stone Oak Pkwy, San Antonio, TX 78258',    packageLabel: 'Monthly Service',       packageDesc: 'Full yard service once a month.',               priceCents: 13500, language: 'en', preferredDay: 'thursday'  },
  { name: 'Carlos Ramírez',     address: '11907 Bandera Rd, Helotes, TX 78023',            packageLabel: 'Bi-Weekly Maintenance', packageDesc: 'Mantenimiento completo cada 2 semanas.',        priceCents: 8500,  language: 'es', preferredDay: 'friday'    },
  { name: 'Patricia Williams',  address: '312 Olmos Dr E, San Antonio, TX 78212',          packageLabel: 'Weekly Mow & Edge',     packageDesc: 'Weekly mow with edge cleanup.',                 priceCents: 7000,  language: 'en', preferredDay: 'saturday'  },
  { name: 'Diego Morales',      address: '1419 Roosevelt Ave, San Antonio, TX 78210',      packageLabel: 'Weekly Mow & Edge',     packageDesc: 'Corte y recorte cada semana.',                  priceCents: 6000,  language: 'es', preferredDay: 'monday'    },
  { name: 'Susan Mitchell',     address: '14112 NW Military Hwy, Shavano Park, TX 78231',  packageLabel: 'Bi-Weekly Maintenance', packageDesc: 'Mow + shrub care every other week.',            priceCents: 9500,  language: 'en', preferredDay: 'wednesday' },
  { name: 'Andrés Vázquez',     address: '2208 W Commerce St, San Antonio, TX 78207',      packageLabel: 'Monthly Service',       packageDesc: 'Servicio mensual completo de jardinería.',      priceCents: 14500, language: 'es', preferredDay: 'friday'    },
  { name: "Linda O'Connor",     address: '8511 Wurzbach Rd, San Antonio, TX 78240',        packageLabel: 'Weekly Mow & Edge',     packageDesc: 'Weekly mow, edge, and blow.',                   priceCents: 7500,  language: 'en', preferredDay: 'tuesday'   },
]

const TIME_SLOTS = ['8:00 AM', '9:30 AM', '11:00 AM', '1:00 PM', '2:30 PM', '4:00 PM']
const SERVICE_TEMPLATES = [
  { label: 'Weekly Mow & Edge',     description: 'Standard weekly service: mow, edge, blow walkways. Most common service.',  basePriceCents: 6500  },
  { label: 'Monthly Full Service',  description: 'Complete monthly yard care: mow, edge, hedge trim, leaf cleanup.',          basePriceCents: 13500 },
]

// ───────────── Helpers
const headers = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json', 'X-Goog-User-Project': PROJECT_ID }

function unwrap(v) {
  if (!v) return null
  if ('stringValue'   in v) return v.stringValue
  if ('booleanValue'  in v) return v.booleanValue
  if ('integerValue'  in v) return Number(v.integerValue)
  if ('doubleValue'   in v) return v.doubleValue
  if ('nullValue'     in v) return null
  if ('timestampValue'in v) return v.timestampValue
  if ('mapValue'      in v) { const o = {}; for (const [k, vv] of Object.entries(v.mapValue.fields || {})) o[k] = unwrap(vv); return o }
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(unwrap)
  return null
}

function wrap(val) {
  if (val === null || val === undefined) return { nullValue: null }
  if (typeof val === 'string')  return { stringValue: val }
  if (typeof val === 'boolean') return { booleanValue: val }
  if (typeof val === 'number')  return Number.isInteger(val) ? { integerValue: String(val) } : { doubleValue: val }
  if (Array.isArray(val)) return { arrayValue: { values: val.map(wrap) } }
  if (typeof val === 'object') return { mapValue: { fields: Object.fromEntries(Object.entries(val).map(([k, v]) => [k, wrap(v)])) } }
  return { stringValue: String(val) }
}

async function queryByGardenerUid(coll, uid) {
  const r = await fetch(`${FS}:runQuery`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: coll }],
        where: { fieldFilter: { field: { fieldPath: 'gardenerUid' }, op: 'EQUAL', value: { stringValue: uid } } },
      },
    }),
  })
  if (!r.ok) throw new Error(`${coll}: ${r.status}: ${(await r.text()).slice(0, 200)}`)
  const d = await r.json()
  return (Array.isArray(d) ? d : []).filter(x => x.document).map(x => {
    const fields = {}
    for (const [k, v] of Object.entries(x.document.fields || {})) fields[k] = unwrap(v)
    return { id: x.document.name.split('/').pop(), name: x.document.name, fields }
  })
}

async function patchDoc(docName, updates) {
  // Build updateMask query string and fields body
  const maskParams = Object.keys(updates).map(k => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join('&')
  const fields = {}
  for (const [k, v] of Object.entries(updates)) fields[k] = wrap(v)
  const url = `https://firestore.googleapis.com/v1/${docName}?${maskParams}`
  const r = await fetch(url, { method: 'PATCH', headers, body: JSON.stringify({ fields }) })
  if (!r.ok) return { ok: false, status: r.status, err: (await r.text()).slice(0, 200) }
  return { ok: true }
}

// ──────── EXECUTE MODE
if (EXECUTE) {
  if (!existsSync(PROPOSAL_FILE)) {
    console.error(`No proposal at ${PROPOSAL_FILE}. Run dry-run first.`)
    process.exit(1)
  }
  const proposal = JSON.parse(readFileSync(PROPOSAL_FILE, 'utf8'))
  console.log(`Loaded proposal: ${proposal.changes.length} doc updates`)
  let ok = 0, fail = 0
  for (const ch of proposal.changes) {
    const r = await patchDoc(ch.docName, ch.updates)
    if (r.ok) {
      console.log(`✓ ${ch.collection}/${ch.id}`)
      ok++
    } else {
      console.log(`✗ ${ch.collection}/${ch.id}: ${r.status}: ${r.err}`)
      fail++
    }
  }
  console.log(`\nDone — ${ok} OK, ${fail} failed`)
  process.exit(0)
}

// ──────── PROPOSAL MODE
console.log('Reading Victor Scales\' data...')
const clients   = (await queryByGardenerUid('clients',   VICTOR_UID)).sort((a, b) => a.id.localeCompare(b.id))
const schedules = (await queryByGardenerUid('schedules', VICTOR_UID)).sort((a, b) => a.id.localeCompare(b.id))
const invoices  = (await queryByGardenerUid('invoices',  VICTOR_UID)).sort((a, b) => a.id.localeCompare(b.id))
const services  = (await queryByGardenerUid('services',  VICTOR_UID)).sort((a, b) => a.id.localeCompare(b.id))
console.log(`  ${clients.length} clients, ${schedules.length} schedules, ${invoices.length} invoices, ${services.length} services\n`)

const changes = []
const clientNewByOldId = new Map()

// ── CLIENTS
console.log('══════════════════════ CLIENTS — BEFORE vs PROPOSED ══════════════════════')
for (let i = 0; i < clients.length; i++) {
  const c = clients[i]
  const t = CLIENT_TEMPLATES[i] || CLIENT_TEMPLATES[i % CLIENT_TEMPLATES.length]
  const newEmail = JAY_EMAILS[i % 2]
  const updates = {
    name:             t.name,
    address:          t.address,
    phone:            JAY_PHONE,
    email:            newEmail,
    language:         t.language,
    preferredDay:     t.preferredDay,
    preferredChannel: 'both',
    packageLabel:     t.packageLabel,
    packageDesc:      t.packageDesc,
    basePriceCents:   t.priceCents,
  }
  console.log(`\n[${i + 1}] ${c.id}`)
  console.log(`    BEFORE  name=${c.fields.name || '(none)'}   addr=${c.fields.address || '(none)'}`)
  console.log(`            phone=${c.fields.phone || '(none)'}   email=${c.fields.email || '(none)'}`)
  console.log(`            pkg=${c.fields.packageLabel || '(none)'}   lang=${c.fields.language || '(none)'}   day=${c.fields.preferredDay || '(none)'}`)
  console.log(`    AFTER   name=${updates.name}   addr=${updates.address}`)
  console.log(`            phone=${updates.phone}   email=${updates.email}`)
  console.log(`            pkg=${updates.packageLabel} ($${(updates.basePriceCents/100).toFixed(2)})   lang=${updates.language}   day=${updates.preferredDay}`)
  changes.push({ collection: 'clients', id: c.id, docName: c.name, updates })
  clientNewByOldId.set(c.id, { name: t.name, priceCents: t.priceCents, packageLabel: t.packageLabel })
}

// ── SCHEDULES — redistribute dates
console.log('\n══════════════════════ SCHEDULES — date redistribution ══════════════════════')
const now = new Date()
const todayStr = now.toISOString().slice(0, 10)
// Layout: last 10 → upcoming (next 14 days, scheduled)
//         prior 20 → recent past (last 21 days, completed)
//         everything else → older past (60-180 days ago, completed)
const total = schedules.length
const upcomingCount  = Math.min(10, total)
const recentCount    = Math.min(20, total - upcomingCount)
const olderCount     = total - upcomingCount - recentCount

let upcomingExamples = 0, recentExamples = 0, olderExamples = 0
for (let i = 0; i < schedules.length; i++) {
  const s = schedules[i]
  let date, status, smsSent, bucket
  if (i < olderCount) {
    const daysAgo = 60 + ((i * 7) % 120)
    date = new Date(now.getTime() - daysAgo * 86400000)
    status = 'completed'; smsSent = true; bucket = 'OLDER'
  } else if (i < olderCount + recentCount) {
    const daysAgo = ((i - olderCount) % 21) + 1
    date = new Date(now.getTime() - daysAgo * 86400000)
    status = 'completed'; smsSent = true; bucket = 'RECENT'
  } else {
    const daysAhead = ((i - olderCount - recentCount) % 14) + 1
    date = new Date(now.getTime() + daysAhead * 86400000)
    status = 'scheduled'; smsSent = false; bucket = 'UPCOMING'
  }
  const serviceDate = date.toISOString().slice(0, 10)
  const time = TIME_SLOTS[i % TIME_SLOTS.length]
  const updates = { serviceDate, time, status, smsSent }
  changes.push({ collection: 'schedules', id: s.id, docName: s.name, updates })
  // Show 2 examples of each bucket
  const want = (bucket === 'OLDER' && olderExamples < 2) || (bucket === 'RECENT' && recentExamples < 2) || (bucket === 'UPCOMING' && upcomingExamples < 2)
  if (want) {
    if (bucket === 'OLDER') olderExamples++
    if (bucket === 'RECENT') recentExamples++
    if (bucket === 'UPCOMING') upcomingExamples++
    const cli = clientNewByOldId.get(s.fields.clientId)?.name || `(unknown clientId ${s.fields.clientId})`
    console.log(`  [${bucket}] ${s.id}  client=${cli}`)
    console.log(`             before: ${s.fields.serviceDate || '(no date)'}/${s.fields.status || '?'}   after: ${serviceDate} ${time}/${status}`)
  }
}
console.log(`\n  Totals — upcoming(scheduled): ${upcomingCount}    recent(completed): ${recentCount}    older(completed): ${olderCount}`)

// ── INVOICES
console.log('\n══════════════════════ INVOICES — BEFORE vs PROPOSED ══════════════════════')
for (let i = 0; i < invoices.length; i++) {
  const inv = invoices[i]
  const cli = clientNewByOldId.get(inv.fields.clientId)
  if (!cli) {
    console.log(`\n  ⚠ invoice ${inv.id} has clientId=${inv.fields.clientId} not in client map — skipping`)
    continue
  }
  const totalCents = cli.priceCents
  // First 10 paid, last 5 pending
  const isPaid = i < Math.min(10, invoices.length - 5)
  const status = isPaid ? 'paid' : 'pending'
  const updates = {
    totalCents,
    status,
    note: `${cli.packageLabel} — ${cli.name}`,
  }
  if (isPaid) {
    // Paid in the last 30 days
    const paidDaysAgo = (i * 3) + 1
    updates.paidAt = new Date(now.getTime() - paidDaysAgo * 86400000).toISOString()
  }
  console.log(`\n  [${i + 1}/${invoices.length}] ${inv.id}  → ${cli.name}`)
  console.log(`    BEFORE  total=$${((inv.fields.totalCents || 0)/100).toFixed(2)}   status=${inv.fields.status || '?'}`)
  console.log(`    AFTER   total=$${(totalCents/100).toFixed(2)}   status=${status}${isPaid ? `   paidAt=${updates.paidAt.slice(0,10)}` : ''}`)
  changes.push({ collection: 'invoices', id: inv.id, docName: inv.name, updates })
}

// ── SERVICES
console.log('\n══════════════════════ SERVICES — BEFORE vs PROPOSED ══════════════════════')
for (let i = 0; i < services.length; i++) {
  const s = services[i]
  const t = SERVICE_TEMPLATES[i % SERVICE_TEMPLATES.length]
  const updates = {
    label: t.label,
    description: t.description,
    basePriceCents: t.basePriceCents,
  }
  console.log(`\n  [${i + 1}/${services.length}] ${s.id}`)
  console.log(`    BEFORE  label=${s.fields.label || '(none)'}   desc=${s.fields.description || '(none)'}   price=$${((s.fields.basePriceCents || 0)/100).toFixed(2)}`)
  console.log(`    AFTER   label=${t.label}   desc=${t.description}   price=$${(t.basePriceCents/100).toFixed(2)}`)
  changes.push({ collection: 'services', id: s.id, docName: s.name, updates })
}

// ── SAVE PROPOSAL + SAFETY ASSERTION
console.log('\n══════════════════════ SAFETY CHECK ══════════════════════')
const clientChanges = changes.filter(c => c.collection === 'clients')
const phonesOk = clientChanges.every(c => c.updates.phone === JAY_PHONE)
const emailsOk = clientChanges.every(c => JAY_EMAILS.includes(c.updates.email))
console.log(`  All ${clientChanges.length} clients have phone=${JAY_PHONE}: ${phonesOk ? '✓' : '✗ FAIL'}`)
console.log(`  All ${clientChanges.length} clients have email in [${JAY_EMAILS.join(', ')}]: ${emailsOk ? '✓' : '✗ FAIL'}`)
if (!phonesOk || !emailsOk) { console.error('SAFETY VIOLATION — aborting before save.'); process.exit(2) }

writeFileSync(PROPOSAL_FILE, JSON.stringify({ generatedAt: now.toISOString(), changes }, null, 2))
console.log(`\n══════════════════════ SUMMARY ══════════════════════`)
console.log(`  Total proposed updates: ${changes.length}`)
console.log(`  Saved to:               ${PROPOSAL_FILE}`)
console.log(`\nNothing written to Firestore yet. On your go, re-run with --execute.`)
