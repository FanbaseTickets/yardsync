// Full Firestore integrity audit + cleanup, read-only by default.
//
// Verifies every doc in every collection ties back to one of the three
// remaining valid owners. Auth via gcloud OAuth token in
// process.env.GCLOUD_TOKEN. No Admin SDK.
//
// USAGE (PowerShell — write token without BOM):
//   $env:GCLOUD_TOKEN | Out-File -FilePath .gcloud-token -NoNewline -Encoding utf8NoBOM
//   node scripts/firestore-integrity-audit.mjs              # dry run
//   node scripts/firestore-integrity-audit.mjs --execute    # actually delete orphans
//
// Ownership model per collection:
//   users          — doc.id IS the uid
//   clients        — fields.gardenerUid (direct)
//   schedules      — fields.gardenerUid + relational: fields.clientId must exist
//   invoices       — fields.gardenerUid + relational: fields.clientId must exist (if present)
//   services       — fields.gardenerUid (direct)
//   feePayments    — fields.gardenerUid (direct)
//   subscriptions  — fields.gardenerUid (direct; doc.id usually equals uid)
//   smsStatus      — fields.gardenerUid (direct; doc.id is Twilio MessageSid)
//   icalEvents     — doc.id IS the scheduleId; owner derived via the schedule

const PROJECT_ID = 'yardsync-41886'
const FS = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`

const VALID = {
  admin: 'VghNtJbGGpUVSJYNZGjJSyUhQBT2',
  rub:   'sLN366NEuGZLM28pZ56tCd56rLC3',
  scals: 'vRGRZqBh0zYThZFKpCk7zjNj6Qz2',
}
const VALID_UIDS = new Set(Object.values(VALID))
const UID_TO_NAME = Object.fromEntries(Object.entries(VALID).map(([n, u]) => [u, n]))

const COLLECTIONS = ['users', 'clients', 'schedules', 'invoices', 'services', 'feePayments', 'subscriptions', 'smsStatus', 'icalEvents']

const DRY_RUN = !process.argv.includes('--execute')

const TOKEN = process.env.GCLOUD_TOKEN
if (!TOKEN || TOKEN.length < 100) {
  console.error('GCLOUD_TOKEN missing/short. In PowerShell:')
  console.error('  $env:GCLOUD_TOKEN | Out-File -FilePath .gcloud-token -NoNewline -Encoding utf8NoBOM')
  console.error('Then run the script from bash with: GCLOUD_TOKEN=$(cat .gcloud-token) node ...')
  process.exit(1)
}
console.log(`Token loaded (length ${TOKEN.length})`)
console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'EXECUTE'}\n`)

function unwrap(v) {
  if (!v) return null
  if ('stringValue' in v) return v.stringValue
  if ('booleanValue' in v) return v.booleanValue
  if ('integerValue' in v) return Number(v.integerValue)
  if ('doubleValue' in v) return v.doubleValue
  if ('nullValue' in v) return null
  if ('timestampValue' in v) return v.timestampValue
  if ('mapValue' in v) { const o = {}; for (const [k, vv] of Object.entries(v.mapValue.fields || {})) o[k] = unwrap(vv); return o }
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(unwrap)
  return null
}

async function listAll(coll) {
  const out = []
  let pageToken = null
  do {
    const url = new URL(`${FS}/${coll}`)
    url.searchParams.set('pageSize', '300')
    if (pageToken) url.searchParams.set('pageToken', pageToken)
    const r = await fetch(url, {
      headers: { Authorization: `Bearer ${TOKEN}`, 'X-Goog-User-Project': PROJECT_ID },
    })
    if (!r.ok) {
      // 404 on missing/empty collection is fine — return empty
      if (r.status === 404) return []
      throw new Error(`${coll}: ${r.status}: ${(await r.text()).slice(0, 200)}`)
    }
    const d = await r.json()
    for (const doc of (d.documents || [])) {
      const fields = {}
      for (const [k, v] of Object.entries(doc.fields || {})) fields[k] = unwrap(v)
      out.push({ id: doc.name.split('/').pop(), name: doc.name, fields })
    }
    pageToken = d.nextPageToken || null
  } while (pageToken)
  return out
}

// ── 1) Load all collections
console.log('Loading every collection...')
const data = {}
for (const c of COLLECTIONS) {
  data[c] = await listAll(c)
  console.log(`  ${c.padEnd(14)} ${data[c].length} docs`)
}

// ── 2) Build helper sets
// Valid client IDs = clients owned by one of the 3 valid UIDs
const validClientIds = new Set()
for (const c of data.clients) {
  if (VALID_UIDS.has(c.fields.gardenerUid)) validClientIds.add(c.id)
}

// Valid schedule IDs + scheduleId -> ownerUid map
const validScheduleIds = new Set()
const scheduleOwner = new Map()
for (const s of data.schedules) {
  if (VALID_UIDS.has(s.fields.gardenerUid)) {
    validScheduleIds.add(s.id)
    scheduleOwner.set(s.id, s.fields.gardenerUid)
  }
}

// ── 3) Classify every doc per collection
const tally = {}   // { collection: { admin, rub, scals, orphan, orphans: [...] } }
for (const c of COLLECTIONS) tally[c] = { admin: 0, rub: 0, scals: 0, orphan: 0, orphans: [] }

function classify(coll, doc) {
  if (coll === 'users') {
    if (VALID_UIDS.has(doc.id)) return { bucket: UID_TO_NAME[doc.id] }
    return { bucket: 'orphan', reason: `doc.id "${doc.id}" not in valid UID set` }
  }
  if (coll === 'icalEvents') {
    // doc.id IS scheduleId
    const owner = scheduleOwner.get(doc.id)
    if (!owner) return { bucket: 'orphan', reason: `dangling scheduleId ${doc.id}` }
    return { bucket: UID_TO_NAME[owner] }
  }
  // gardenerUid-based collections
  const owner = doc.fields.gardenerUid
  if (!owner) return { bucket: 'orphan', reason: 'missing gardenerUid' }
  if (!VALID_UIDS.has(owner)) return { bucket: 'orphan', reason: `bad gardenerUid ${owner.slice(0, 14)}...` }
  // Relational integrity for schedules / invoices
  if ((coll === 'schedules' || coll === 'invoices') && doc.fields.clientId && !validClientIds.has(doc.fields.clientId)) {
    return { bucket: 'orphan', reason: `dangling clientId ${doc.fields.clientId}` }
  }
  return { bucket: UID_TO_NAME[owner] }
}

for (const c of COLLECTIONS) {
  for (const doc of data[c]) {
    const cls = classify(c, doc)
    if (cls.bucket === 'orphan') {
      tally[c].orphan++
      tally[c].orphans.push({ id: doc.id, name: doc.name, reason: cls.reason })
    } else {
      tally[c][cls.bucket]++
    }
  }
}

// ── 4) Print per-collection tables
console.log('\n══════════════════════ PER-COLLECTION BREAKDOWN ══════════════════════\n')
console.log('collection       total  admin    rub  scals  ORPH  →  notes')
console.log('---------------- -----  -----  -----  -----  ----     ----------------------')
let grandTotal = 0
let grandOrphan = 0
for (const c of COLLECTIONS) {
  const t = tally[c]
  const total = data[c].length
  grandTotal += total
  grandOrphan += t.orphan
  console.log(`${c.padEnd(16)} ${String(total).padStart(5)}  ${String(t.admin).padStart(5)}  ${String(t.rub).padStart(5)}  ${String(t.scals).padStart(5)}  ${String(t.orphan).padStart(4)}`)
}
console.log('---------------- -----  -----  -----  -----  ----')
console.log(`TOTAL            ${String(grandTotal).padStart(5)}                       ${String(grandOrphan).padStart(4)}`)

// ── 5) Print orphan examples + reasons per collection
console.log('\n══════════════════════ ORPHAN DETAIL ══════════════════════')
for (const c of COLLECTIONS) {
  const orphs = tally[c].orphans
  if (orphs.length === 0) continue
  console.log(`\n── ${c} (${orphs.length} orphan${orphs.length === 1 ? '' : 's'}) ──`)
  // Group by reason
  const byReason = {}
  for (const o of orphs) {
    const key = o.reason.replace(/[0-9a-zA-Z]{8,}/g, '<id>')  // generalize for grouping
    byReason[key] = byReason[key] || []
    byReason[key].push(o)
  }
  for (const [reason, list] of Object.entries(byReason)) {
    console.log(`  ${list.length}×  ${reason}`)
    for (const example of list.slice(0, 3)) {
      console.log(`     • ${example.id}  (full reason: ${example.reason})`)
    }
    if (list.length > 3) console.log(`     • ... and ${list.length - 3} more`)
  }
}

// ── 6) Grand totals
console.log('\n══════════════════════ GRAND TOTALS ══════════════════════')
console.log(`Docs scanned:    ${grandTotal}`)
console.log(`Valid (admin):   ${COLLECTIONS.reduce((s, c) => s + tally[c].admin, 0)}`)
console.log(`Valid (rub):     ${COLLECTIONS.reduce((s, c) => s + tally[c].rub, 0)}`)
console.log(`Valid (scals):   ${COLLECTIONS.reduce((s, c) => s + tally[c].scals, 0)}`)
console.log(`ORPHANED:        ${grandOrphan}`)

if (DRY_RUN) {
  console.log('\n══ DRY RUN — nothing deleted ══')
  if (grandOrphan === 0) console.log('Nothing to clean up.')
  else console.log(`To delete the ${grandOrphan} orphan(s): node scripts/firestore-integrity-audit.mjs --execute`)
  process.exit(0)
}

// ── EXECUTE: delete orphans
if (grandOrphan === 0) { console.log('\nNothing to delete.'); process.exit(0) }

console.log('\n══════════════════════ EXECUTING DELETES ══════════════════════\n')
const result = { ok: 0, fail: 0, failures: [] }
for (const c of COLLECTIONS) {
  for (const orph of tally[c].orphans) {
    const r = await fetch(`https://firestore.googleapis.com/v1/${orph.name}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${TOKEN}`, 'X-Goog-User-Project': PROJECT_ID },
    })
    if (r.ok) {
      console.log(`✓ ${c}/${orph.id}`)
      result.ok++
    } else {
      const err = (await r.text()).slice(0, 160)
      console.log(`✗ ${c}/${orph.id} — ${r.status}: ${err}`)
      result.fail++
      result.failures.push({ coll: c, id: orph.id, err })
    }
  }
}

console.log(`\n══════════════════════ FINAL SUMMARY ══════════════════════`)
console.log(`Deleted:  ${result.ok}`)
console.log(`Failed:   ${result.fail}`)
if (result.failures.length > 0) {
  console.log(`\n── Failures ──`)
  for (const f of result.failures) console.log(`  ${f.coll}/${f.id}  —  ${f.err}`)
}
