// One-shot backfill for test accounts that predate webhook field writes.
// Populates lastPaymentAt, currentPeriodEnd, stripeSubscriptionId on user docs
// and matching subscriptions/{uid} docs using Stripe as the source of truth.
//
// Run:
//   gcloud auth application-default login        # one-time
//   node scripts/backfill-user-subscription-fields.js              # DRY RUN
//   node scripts/backfill-user-subscription-fields.js --execute    # write
//
// Safeguards:
//   - Skips admin@fanbasetickets.net (intentional dual-role account)
//   - Skips users with no stripeCustomerId AND no stripeSubscriptionId (unbackfillable)
//   - Every Stripe call wrapped in try/catch; a failure on one account doesn't abort the run
//   - Does NOT write stripeAccountId (Connect-only field, can't be derived from sub data)

require('dotenv').config({ path: '.env.local' })
const { execSync } = require('child_process')
const Stripe = require('stripe')

const PROJECT_ID = 'yardsync-41886'
const EXECUTE = process.argv.includes('--execute')
const ADMIN_EMAIL = 'admin@fanbasetickets.net'
const ACTIVE_STATUSES = new Set(['active', 'canceling', 'trialing', 'past_due'])

if (!process.env.STRIPE_SECRET_KEY) {
  console.error('STRIPE_SECRET_KEY not set in .env.local. Aborting.')
  process.exit(1)
}
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

function getToken() {
  return execSync('gcloud auth application-default print-access-token', { encoding: 'utf-8' }).trim()
}

function tsToISO(tsSec) {
  if (!tsSec) return null
  return new Date(tsSec * 1000).toISOString()
}

// Convert a plain JS object to Firestore REST fields shape
function toFirestoreFields(obj) {
  const fields = {}
  for (const [k, v] of Object.entries(obj)) {
    if (v === null || v === undefined) {
      fields[k] = { nullValue: null }
    } else if (typeof v === 'string') {
      fields[k] = { stringValue: v }
    } else if (typeof v === 'boolean') {
      fields[k] = { booleanValue: v }
    } else if (typeof v === 'number') {
      fields[k] = Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v }
    } else {
      fields[k] = { stringValue: String(v) }
    }
  }
  return fields
}

async function firestorePatch(token, collection, docId, updates) {
  const mask = Object.keys(updates).map(k => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join('&')
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${collection}/${docId}?${mask}`
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ fields: toFirestoreFields(updates) }),
  })
  if (!res.ok) {
    throw new Error(`Firestore PATCH failed (${res.status}): ${await res.text()}`)
  }
}

async function main() {
  const token = getToken()
  const mode = EXECUTE ? 'EXECUTE' : 'DRY RUN'
  console.log(`\n=== User subscription field backfill — ${mode} ===\n`)

  const res = await fetch(
    `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/users?pageSize=200`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  const data = await res.json()
  if (!data.documents) {
    console.error('No users found or error:', JSON.stringify(data))
    process.exit(1)
  }

  let stats = { scanned: 0, skippedAdmin: 0, skippedUnbackfillable: 0, skippedCurrent: 0, backfilled: 0, errors: 0 }

  for (const doc of data.documents) {
    const f = doc.fields || {}
    const uid = doc.name.split('/').pop()
    const email = f.email?.stringValue || '(no email)'
    const customerId = f.stripeCustomerId?.stringValue
    const existingSubId = f.stripeSubscriptionId?.stringValue
    const status = f.subscriptionStatus?.stringValue
    const lastPaymentAt = f.lastPaymentAt?.stringValue
    const currentPeriodEnd = f.currentPeriodEnd?.stringValue

    stats.scanned++

    // Only target active-ish subscriptions
    if (!ACTIVE_STATUSES.has(status)) continue

    // Safeguard 1: skip admin account
    if (email === ADMIN_EMAIL) {
      stats.skippedAdmin++
      console.log(`SKIP admin : ${uid.slice(0, 10)} | ${email}`)
      continue
    }

    // Safeguard 2: skip if nothing to look up with
    if (!customerId && !existingSubId) {
      stats.skippedUnbackfillable++
      console.log(`SKIP       : ${uid.slice(0, 10)} | ${email.padEnd(36)} | no customerId + no subId (unbackfillable)`)
      continue
    }

    // Skip if already fully populated
    if (existingSubId && lastPaymentAt && currentPeriodEnd) {
      stats.skippedCurrent++
      continue
    }

    try {
      let subscription = null
      let subId = existingSubId

      if (subId) {
        subscription = await stripe.subscriptions.retrieve(subId)
      } else {
        // Discover via customer
        const list = await stripe.subscriptions.list({ customer: customerId, limit: 3, status: 'all' })
        subscription = list.data.find(s => s.status === 'active' || s.status === 'trialing')
          || list.data.find(s => s.status === 'past_due')
          || list.data[0]
        if (subscription) subId = subscription.id
      }

      if (!subscription) {
        console.log(`NO SUB     : ${uid.slice(0, 10)} | ${email.padEnd(36)} | Stripe has no subscription for customer ${customerId}`)
        stats.skippedUnbackfillable++
        continue
      }

      // Build updates
      const userUpdates = {}
      const subUpdates = {}
      if (!existingSubId) userUpdates.stripeSubscriptionId = subId

      // current_period_end moved to SubscriptionItem on newer Stripe API versions.
      // Try subscription.current_period_end first (legacy), fall back to items[0].
      const periodEndSec = subscription.current_period_end
        || subscription.items?.data?.[0]?.current_period_end
      const periodStartSec = subscription.current_period_start
        || subscription.items?.data?.[0]?.current_period_start
      userUpdates.currentPeriodEnd = tsToISO(periodEndSec)

      // Use latest invoice's paid time as lastPaymentAt; fall back to period_start
      let lastPayIso = null
      if (subscription.latest_invoice) {
        try {
          const inv = await stripe.invoices.retrieve(subscription.latest_invoice)
          if (inv.status === 'paid' && inv.status_transitions?.paid_at) {
            lastPayIso = tsToISO(inv.status_transitions.paid_at)
          }
        } catch {}
      }
      if (!lastPayIso) lastPayIso = tsToISO(periodStartSec)
      userUpdates.lastPaymentAt = lastPayIso

      subUpdates.status = subscription.status === 'canceled' ? 'canceled' : 'active'
      subUpdates.currentPeriodEnd = userUpdates.currentPeriodEnd
      subUpdates.updatedAt = new Date().toISOString()
      userUpdates.updatedAt = new Date().toISOString()

      console.log(`BACKFILL   : ${uid.slice(0, 10)} | ${email.padEnd(36)}`)
      console.log(`             subId=${subId}`)
      console.log(`             currentPeriodEnd=${userUpdates.currentPeriodEnd}`)
      console.log(`             lastPaymentAt=${userUpdates.lastPaymentAt}`)

      if (EXECUTE) {
        await firestorePatch(token, 'users', uid, userUpdates)
        await firestorePatch(token, 'subscriptions', uid, subUpdates)
        console.log(`             ✓ wrote users/${uid.slice(0, 10)} + subscriptions/${uid.slice(0, 10)}`)
      }
      stats.backfilled++
    } catch (err) {
      stats.errors++
      console.error(`ERROR      : ${uid.slice(0, 10)} | ${email} | ${err.message}`)
    }
  }

  console.log('\n--- Summary ---')
  console.log(`Scanned:          ${stats.scanned}`)
  console.log(`Backfilled:       ${stats.backfilled}`)
  console.log(`Already current:  ${stats.skippedCurrent}`)
  console.log(`Skipped (admin):  ${stats.skippedAdmin}`)
  console.log(`Skipped (no IDs): ${stats.skippedUnbackfillable}`)
  console.log(`Errors:           ${stats.errors}`)
  if (!EXECUTE) console.log('\n(dry-run — re-run with --execute to write)')
}

main().catch(err => { console.error(err); process.exit(1) })
