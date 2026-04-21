// Seed test charges on a connected Stripe account to simulate a target
// monthly volume. Use this to prove the reward-check cron logic.
//
// Run:
//   node scripts/seed-volume-reward-test.js --account acct_XXX --amount 150000
//   node scripts/seed-volume-reward-test.js --account acct_XXX --amount 300000 --month 2026-03
//
// Arguments:
//   --account <stripeAccountId>  Required. Connected account to create charges on.
//   --amount <totalCents>        Required. Total volume to simulate (in cents).
//   --month <YYYY-MM>            Optional. Defaults to previous month (what the cron reads).
//   --count <N>                  Optional. Split into N charges. Default 3.
//
// STRIPE MUST BE IN TEST MODE. Script aborts if STRIPE_SECRET_KEY starts with sk_live_.

require('dotenv').config({ path: '.env.local' })
const Stripe = require('stripe')

function parseArgs() {
  const args = {}
  for (let i = 2; i < process.argv.length; i++) {
    const a = process.argv[i]
    if (a.startsWith('--')) {
      args[a.slice(2)] = process.argv[i + 1]
      i++
    }
  }
  return args
}

async function main() {
  const args = parseArgs()
  if (!args.account) { console.error('Missing --account <stripeAccountId>'); process.exit(1) }
  if (!args.amount) { console.error('Missing --amount <totalCents>'); process.exit(1) }

  const key = process.env.STRIPE_SECRET_KEY
  if (!key) { console.error('STRIPE_SECRET_KEY not set'); process.exit(1) }
  if (key.startsWith('sk_live_')) {
    console.error('STRIPE_SECRET_KEY is LIVE — this script is test-mode only. Aborting.')
    process.exit(1)
  }
  const stripe = new Stripe(key)

  const accountId = args.account
  const totalCents = parseInt(args.amount, 10)
  const count = parseInt(args.count || '3', 10)
  const perCharge = Math.floor(totalCents / count)
  const remainder = totalCents - (perCharge * count)

  // Resolve target month. Default = previous calendar month (what the cron scans).
  const now = new Date()
  let year, monthIdx
  if (args.month) {
    const [y, m] = args.month.split('-').map(n => parseInt(n, 10))
    year = y
    monthIdx = m - 1
  } else {
    year = now.getUTCMonth() === 0 ? now.getUTCFullYear() - 1 : now.getUTCFullYear()
    monthIdx = now.getUTCMonth() === 0 ? 11 : now.getUTCMonth() - 1
  }

  // Pick a safe timestamp inside the target month — middle of the 5th at noon UTC.
  // Stripe rejects timestamps more than ~1hr in the future; always in the past.
  const created = Math.floor(Date.UTC(year, monthIdx, 5, 12, 0, 0) / 1000)
  const nowSec = Math.floor(Date.now() / 1000)
  if (created > nowSec) {
    console.error(`Target month ${year}-${String(monthIdx + 1).padStart(2, '0')} is in the future. Stripe won't accept future-dated charges.`)
    process.exit(1)
  }

  console.log(`\n=== Seed volume reward test ===`)
  console.log(`Account:     ${accountId}`)
  console.log(`Target:      $${(totalCents / 100).toFixed(2)} in ${year}-${String(monthIdx + 1).padStart(2, '0')}`)
  console.log(`Charges:     ${count} × $${(perCharge / 100).toFixed(2)}` + (remainder ? ` (+ $${(remainder / 100).toFixed(2)} remainder on first)` : ''))
  console.log(`Stripe mode: ${key.startsWith('sk_test_') ? 'TEST' : 'UNKNOWN'}\n`)

  let totalCreated = 0
  for (let i = 0; i < count; i++) {
    const amount = perCharge + (i === 0 ? remainder : 0)
    try {
      const charge = await stripe.charges.create(
        {
          amount,
          currency: 'usd',
          source: 'tok_visa', // test-mode succeeds-with-no-auth token
          description: `YardSync reward-cron seed ${i + 1}/${count}`,
          metadata: { seeded: 'reward-cron-test', targetMonth: `${year}-${String(monthIdx + 1).padStart(2, '0')}` },
        },
        { stripeAccount: accountId }
      )
      console.log(`  ✓ ${charge.id}  $${(amount / 100).toFixed(2)}  created=${charge.created}`)
      totalCreated += amount
    } catch (err) {
      console.error(`  ✗ charge ${i + 1} failed: ${err.message}`)
    }
  }

  console.log(`\nSeeded $${(totalCreated / 100).toFixed(2)} on ${accountId}`)
  console.log(`\nNote: Stripe won't let us set \`created\` directly on a charge. All seeded`)
  console.log(`charges are dated "now". The reward cron filters by created date — you'll`)
  console.log(`need to run the cron immediately while these charges are still in the`)
  console.log(`current calendar month, OR wait until next month for them to count as`)
  console.log(`"previous month" volume.`)
}

main().catch(err => { console.error(err); process.exit(1) })
