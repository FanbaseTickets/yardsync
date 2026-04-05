const PROJECT_ID = 'yardsync-41886'

async function migrateUsers() {
  const token = process.env.GCLOUD_TOKEN || await getToken()

  const res = await fetch(
    `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/users?pageSize=100`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  const data = await res.json()

  let migrated = 0
  let skipped = 0

  for (const doc of data.documents || []) {
    const fields = doc.fields || {}
    const subscriptionStatus = fields.subscriptionStatus?.stringValue
    const stripeAccountStatus = fields.stripeAccountStatus?.stringValue
    const uid = doc.name.split('/').pop()
    const email = fields.email?.stringValue || '(no email)'

    if (subscriptionStatus === 'active' && !stripeAccountStatus) {
      const patchRes = await fetch(
        `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/users/${uid}?updateMask.fieldPaths=stripeAccountStatus&updateMask.fieldPaths=paymentPath`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            fields: {
              stripeAccountStatus: { stringValue: 'complete' },
              paymentPath: { stringValue: 'stripe' },
            },
          }),
        }
      )
      if (patchRes.ok) {
        console.log(`Migrated: ${uid} (${email})`)
        migrated++
      } else {
        const err = await patchRes.text()
        console.log(`Failed: ${uid} — ${err}`)
      }
    } else {
      console.log(`Skipped: ${uid} (${email}) — sub=${subscriptionStatus}, stripeAcctStatus=${stripeAccountStatus}`)
      skipped++
    }
  }

  console.log(`\nDone. Migrated: ${migrated}, Skipped: ${skipped}`)
}

async function getToken() {
  const { execSync } = await import('child_process')
  return execSync('gcloud auth application-default print-access-token', { encoding: 'utf-8' }).trim()
}

migrateUsers().catch(console.error)
