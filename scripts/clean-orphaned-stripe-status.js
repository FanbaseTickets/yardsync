// One-shot cleanup for Bug C: find users with stripeAccountStatus set but no
// stripeAccountId (poisoned by the old migrate-stripe-status.js), and clear
// the poisoned field so AppShell + dashboard gates behave correctly.
//
// Run:
//   gcloud auth application-default login   # one-time
//   node scripts/clean-orphaned-stripe-status.js --dry-run   # preview
//   node scripts/clean-orphaned-stripe-status.js             # execute

const PROJECT_ID = 'yardsync-41886'
const DRY_RUN = process.argv.includes('--dry-run')

async function getToken() {
  const { execSync } = await import('child_process')
  return execSync('gcloud auth application-default print-access-token', { encoding: 'utf-8' }).trim()
}

async function cleanOrphans() {
  const token = process.env.GCLOUD_TOKEN || await getToken()

  const res = await fetch(
    `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/users?pageSize=200`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  const data = await res.json()

  const orphans = []
  for (const doc of data.documents || []) {
    const fields = doc.fields || {}
    const stripeAccountStatus = fields.stripeAccountStatus?.stringValue
    const stripeAccountId = fields.stripeAccountId?.stringValue
    const uid = doc.name.split('/').pop()
    const email = fields.email?.stringValue || '(no email)'

    if (stripeAccountStatus && !stripeAccountId) {
      orphans.push({ uid, email, stripeAccountStatus })
    }
  }

  console.log(`Found ${orphans.length} orphaned stripeAccountStatus doc(s):`)
  orphans.forEach(o => console.log(`  ${o.uid}  ${o.email}  status=${o.stripeAccountStatus}`))

  if (DRY_RUN) {
    console.log('\n(dry-run; no writes)')
    return
  }
  if (orphans.length === 0) {
    console.log('\nNothing to clean.')
    return
  }

  let cleaned = 0
  for (const o of orphans) {
    // Set stripeAccountStatus to null (delete the field) via updateMask + empty fields body
    const patchRes = await fetch(
      `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/users/${o.uid}?updateMask.fieldPaths=stripeAccountStatus`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ fields: {} }),
      }
    )
    if (patchRes.ok) {
      console.log(`Cleaned: ${o.uid} (${o.email})`)
      cleaned++
    } else {
      console.log(`Failed: ${o.uid} — ${await patchRes.text()}`)
    }
  }

  console.log(`\nDone. Cleaned: ${cleaned} / ${orphans.length}`)
}

cleanOrphans().catch(err => { console.error(err); process.exit(1) })
