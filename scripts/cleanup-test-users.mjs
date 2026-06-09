// Cleanup of stale test users — Auth + Firestore + orphan subcollection docs.
//
// Auth via gcloud OAuth2 token (IAM Owner) — bypasses Firestore security
// rules AND the stale local FIREBASE_ADMIN_PASSWORD. Does NOT use the
// Firebase Admin SDK (org policy blocks service-account key creation).
//
// USAGE (from PowerShell):
//   $env:GCLOUD_TOKEN = (gcloud auth print-access-token)
//   node scripts/cleanup-test-users.mjs              # dry run — no deletes
//   node scripts/cleanup-test-users.mjs --execute    # actually delete
//
// PATTERNS (delete if email matches ANY, case-insensitive):
//   ends with @yardsyncdemo.com, contains "scenarioa", contains "protest",
//   contains "testflash", contains "yardsynctest", ends with @test.com
//
// HARD KEEP-LIST (never delete):
//   admin@fanbasetickets.net, rub@test.com, scals@test.com
//
// SAFETY NET: any user with Firestore users/{uid}.subscriptionStatus
// === 'active' is preserved regardless of email match.

const PROJECT_ID = 'yardsync-41886'
const FS_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`
const IT_BASE = `https://identitytoolkit.googleapis.com/v1/projects/${PROJECT_ID}`

const PATTERNS = ['@yardsyncdemo.com', 'scenarioa', 'protest', 'testflash', 'yardsynctest', '@test.com']
const KEEP_EMAILS = new Set(['admin@fanbasetickets.net', 'rub@test.com', 'scals@test.com'])

// Top-level collections that reference user UID via `gardenerUid`.
// icalEvents + smsStatus omitted: icalEvents has no gardenerUid (keyed by
// scheduleId), and smsStatus delivery records are harmless leftovers.
const ORPHAN_COLLECTIONS = ['clients', 'schedules', 'invoices', 'subscriptions', 'feePayments']

const DRY_RUN = !process.argv.includes('--execute')

const token = process.env.GCLOUD_TOKEN
if (!token || token.length < 100) {
  console.error('\nERROR: process.env.GCLOUD_TOKEN is missing or too short.')
  console.error('In the SAME PowerShell terminal you will run this script, do:')
  console.error('  gcloud config set auth/disable_ssl_validation true')
  console.error('  $env:GCLOUD_TOKEN = (gcloud auth print-access-token)')
  console.error('  gcloud config set auth/disable_ssl_validation false')
  console.error('  $env:GCLOUD_TOKEN.Length    # sanity-check; should print a number > 100')
  console.error('Then re-run:')
  console.error('  node scripts/cleanup-test-users.mjs')
  process.exit(1)
}
console.log(`Token loaded (length ${token.length})`)
console.log(`Mode: ${DRY_RUN ? 'DRY RUN — no deletes' : 'EXECUTE — deletions will happen'}\n`)

function unwrap(v) {
  if (!v) return null
  if ('stringValue'   in v) return v.stringValue
  if ('booleanValue'  in v) return v.booleanValue
  if ('integerValue'  in v) return Number(v.integerValue)
  if ('doubleValue'   in v) return v.doubleValue
  if ('nullValue'     in v) return null
  if ('timestampValue'in v) return v.timestampValue
  if ('mapValue'      in v) {
    const out = {}
    for (const [k, vv] of Object.entries(v.mapValue.fields || {})) out[k] = unwrap(vv)
    return out
  }
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(unwrap)
  return null
}

// ── 1) List ALL Auth users via Identity Toolkit accounts:query
async function listAllAuthUsers() {
  const out = []
  let nextPageToken = null
  do {
    const body = { limit: '500', returnUserInfo: true }
    if (nextPageToken) body.nextPageToken = nextPageToken
    const res = await fetch(`${IT_BASE}/accounts:query`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      console.error('AUTH_LIST_FAILED:', res.status, (await res.text()).slice(0, 500))
      process.exit(2)
    }
    const data = await res.json()
    for (const u of (data.userInfo || [])) {
      out.push({
        uid:         u.localId,
        email:       (u.email || '').toLowerCase(),
        displayName: u.displayName || '',
        createdAt:   u.createdAt,
      })
    }
    nextPageToken = data.nextPageToken || null
  } while (nextPageToken)
  return out
}

// ── 2) Build map of every Firestore users/ doc (for subscriptionStatus check)
async function buildFirestoreUserMap() {
  const map = new Map()
  let pageToken = null
  do {
    const url = new URL(`${FS_BASE}/users`)
    url.searchParams.set('pageSize', '300')
    if (pageToken) url.searchParams.set('pageToken', pageToken)
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    if (!res.ok) {
      console.error('FS_USERS_LIST_FAILED:', res.status, (await res.text()).slice(0, 500))
      process.exit(3)
    }
    const data = await res.json()
    for (const doc of (data.documents || [])) {
      const fields = {}
      for (const [k, v] of Object.entries(doc.fields || {})) fields[k] = unwrap(v)
      map.set(doc.name.split('/').pop(), { name: doc.name, fields })
    }
    pageToken = data.nextPageToken || null
  } while (pageToken)
  return map
}

// ── 3) Find orphan docs (collection-by-collection) for a given uid
async function findOrphans(uid) {
  const out = {}
  for (const coll of ORPHAN_COLLECTIONS) {
    const res = await fetch(`${FS_BASE}:runQuery`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        structuredQuery: {
          from:  [{ collectionId: coll }],
          where: { fieldFilter: { field: { fieldPath: 'gardenerUid' }, op: 'EQUAL', value: { stringValue: uid } } },
        },
      }),
    })
    if (!res.ok) {
      out[coll] = { docs: [], err: `${res.status}` }
      continue
    }
    const data = await res.json()
    const docs = (Array.isArray(data) ? data : []).filter(r => r.document).map(r => r.document.name)
    out[coll] = { docs, err: null }
  }
  return out
}

// ── MAIN
console.log('Listing Auth users...')
const authUsers = await listAllAuthUsers()
console.log(`  Auth: ${authUsers.length} users`)

console.log('Listing Firestore users/...')
const fsMap = await buildFirestoreUserMap()
console.log(`  Firestore users/: ${fsMap.size} docs`)

// Classify every Auth user
const kept = []
const candidates = []
for (const u of authUsers) {
  const email = u.email || ''
  const matchedPattern = PATTERNS.find(p => email.includes(p))
  const fsDoc = fsMap.get(u.uid) || null
  const subStatus = fsDoc?.fields?.subscriptionStatus
  if (!matchedPattern) {
    kept.push({ ...u, reason: 'no-match', subStatus })
    continue
  }
  if (KEEP_EMAILS.has(email)) {
    kept.push({ ...u, reason: 'safe-list', matchedPattern, subStatus })
    continue
  }
  if (subStatus === 'active') {
    kept.push({ ...u, reason: 'active-sub', matchedPattern, subStatus })
    continue
  }
  candidates.push({ ...u, matchedPattern, subStatus, fsDocName: fsDoc?.name || null })
}

// Find orphans for each candidate
if (candidates.length > 0) {
  console.log(`\nScanning orphan subcollection docs for ${candidates.length} candidate(s)...`)
  for (const c of candidates) {
    c.orphans = await findOrphans(c.uid)
  }
}

// ── REPORT
console.log(`\n══════════════════════════ KEPT ══════════════════════════`)
const keptMatched = kept.filter(k => k.reason !== 'no-match')
const keptUnmatched = kept.filter(k => k.reason === 'no-match')
for (const k of keptMatched) {
  const ss = k.subStatus ? ` status=${k.subStatus}` : ''
  const mp = k.matchedPattern ? ` [pattern: ${k.matchedPattern}]` : ''
  console.log(`KEEP (${k.reason.padEnd(10)}) | ${k.email.padEnd(46)} | ${k.uid}${mp}${ss}`)
}
console.log(`(+ ${keptUnmatched.length} user(s) with no matching pattern — assumed real contractors)`)

console.log(`\n══════════════════════ DELETE CANDIDATES (${candidates.length}) ══════════════════════`)
let totalOrphanDocs = 0
for (const c of candidates) {
  console.log(`\n• ${c.email}  (uid ${c.uid})`)
  console.log(`    pattern: ${c.matchedPattern}    status: ${c.subStatus || 'none'}    fsDoc: ${c.fsDocName ? 'yes' : 'no'}`)
  let orphSum = 0
  for (const [coll, r] of Object.entries(c.orphans || {})) {
    if (r.err) {
      console.log(`    ${coll}: query ERROR (${r.err})`)
    } else if (r.docs.length) {
      console.log(`    ${coll}: ${r.docs.length} doc(s)`)
      orphSum += r.docs.length
    }
  }
  if (orphSum === 0) console.log('    (no orphan docs)')
  totalOrphanDocs += orphSum
}

console.log(`\n══ TOTALS ══`)
console.log(`Auth users scanned:    ${authUsers.length}`)
console.log(`Kept (matched):        ${keptMatched.length}`)
console.log(`Kept (no pattern):     ${keptUnmatched.length}`)
console.log(`Delete candidates:     ${candidates.length}`)
console.log(`Orphan docs found:     ${totalOrphanDocs}`)

if (DRY_RUN) {
  console.log(`\n══ DRY RUN COMPLETE ══`)
  if (candidates.length === 0) {
    console.log(`Nothing to delete.`)
  } else {
    console.log(`Review the candidate list above. When ready, run:`)
    console.log(`  node scripts/cleanup-test-users.mjs --execute`)
  }
  process.exit(0)
}

// ════ EXECUTE MODE — deletes
if (candidates.length === 0) {
  console.log(`\nNothing to delete — exiting.`)
  process.exit(0)
}

console.log(`\n══════════════════════ EXECUTING DELETIONS ══════════════════════\n`)
const results = {
  fsUsers: { ok: [], fail: [] },
  authUsers: { ok: [], fail: [] },
  orphans: { ok: [], fail: [] },
}

// 1) Orphan subcollection docs FIRST, then user doc — minimizes dangling refs
for (const c of candidates) {
  for (const [coll, r] of Object.entries(c.orphans || {})) {
    for (const docName of r.docs) {
      const res = await fetch(`https://firestore.googleapis.com/v1/${docName}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      const docId = docName.split('/').pop()
      if (res.ok) {
        console.log(`  ✓ orphan ${coll}/${docId} (uid ${c.uid})`)
        results.orphans.ok.push({ uid: c.uid, coll, doc: docName })
      } else {
        const err = (await res.text()).slice(0, 160)
        console.log(`  ✗ orphan ${coll}/${docId} — ${res.status}: ${err}`)
        results.orphans.fail.push({ uid: c.uid, coll, doc: docName, err })
      }
    }
  }
  if (c.fsDocName) {
    const res = await fetch(`https://firestore.googleapis.com/v1/${c.fsDocName}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.ok) {
      console.log(`✓ Firestore users/${c.uid}  (${c.email})`)
      results.fsUsers.ok.push(c)
    } else {
      const err = (await res.text()).slice(0, 200)
      console.log(`✗ Firestore users/${c.uid} — ${res.status}: ${err}`)
      results.fsUsers.fail.push({ ...c, err })
    }
  } else {
    console.log(`— No Firestore user doc for ${c.email} (uid ${c.uid}) — no FS user delete needed`)
  }
}

// 2) Auth batchDelete (groups of up to 1000)
console.log(`\n── Auth batchDelete ──`)
const localIds = candidates.map(c => c.uid)
for (let i = 0; i < localIds.length; i += 1000) {
  const batch = localIds.slice(i, i + 1000)
  const res = await fetch(`${IT_BASE}/accounts:batchDelete`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ localIds: batch, force: true }),
  })
  if (res.ok) {
    const data = await res.json()
    const errors = data.errors || []
    const errIdx = new Set(errors.map(e => e.index))
    batch.forEach((uid, idx) => {
      const c = candidates.find(x => x.uid === uid)
      if (errIdx.has(idx)) {
        const err = errors.find(e => e.index === idx)
        console.log(`✗ Auth ${uid} (${c?.email || '?'}) — ${err?.message || JSON.stringify(err)}`)
        results.authUsers.fail.push({ uid, email: c?.email, err: err?.message })
      } else {
        console.log(`✓ Auth ${uid} (${c?.email || '?'})`)
        results.authUsers.ok.push({ uid, email: c?.email })
      }
    })
  } else {
    const err = (await res.text()).slice(0, 500)
    console.log(`✗ batchDelete (${batch.length} ids) failed: ${res.status}: ${err}`)
    for (const uid of batch) {
      const c = candidates.find(x => x.uid === uid)
      results.authUsers.fail.push({ uid, email: c?.email, err: `batch ${res.status}: ${err.slice(0, 100)}` })
    }
  }
}

// 3) FINAL REPORT
console.log(`\n══════════════════════ FINAL SUMMARY ══════════════════════`)
console.log(`Orphan docs:    deleted ${results.orphans.ok.length}    failed ${results.orphans.fail.length}`)
console.log(`Firestore user: deleted ${results.fsUsers.ok.length}    failed ${results.fsUsers.fail.length}`)
console.log(`Auth user:      deleted ${results.authUsers.ok.length}    failed ${results.authUsers.fail.length}`)

if (results.authUsers.fail.length > 0) {
  console.log(`\n── Auth users that did NOT delete — handle manually in Console ──`)
  console.log(`https://console.firebase.google.com/project/${PROJECT_ID}/authentication/users`)
  for (const f of results.authUsers.fail) console.log(`  ${f.uid}    ${f.email || ''}    ${f.err}`)
}
if (results.fsUsers.fail.length > 0) {
  console.log(`\n── Firestore user docs that did NOT delete ──`)
  for (const f of results.fsUsers.fail) console.log(`  ${f.fsDocName}    ${f.email}    ${f.err}`)
}
if (results.orphans.fail.length > 0) {
  console.log(`\n── Orphan docs that did NOT delete ──`)
  for (const f of results.orphans.fail) console.log(`  ${f.doc}    ${f.err}`)
}
