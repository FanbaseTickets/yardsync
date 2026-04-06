import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

const TEST_STRIPE_ACCOUNT_ID = 'acct_1TIdSq1wen7Bjvpl'
const TEST_AMOUNT = 500 // $500 invoice

async function runTest() {
  const amountInCents = Math.round(TEST_AMOUNT * 100)
  const applicationFee = Math.round(amountInCents * 0.055)

  console.log('--- Fee Breakdown ---')
  console.log(`Invoice total:        $${TEST_AMOUNT}.00`)
  console.log(`Application fee 5.5%: $${(applicationFee / 100).toFixed(2)}`)
  console.log(`Contractor receives:  $${((amountInCents - applicationFee) / 100).toFixed(2)}`)
  console.log(`Jay nets (pre-Stripe fees): $${(applicationFee / 100).toFixed(2)}`)
  console.log('--------------------')

  const paymentIntent = await stripe.paymentIntents.create({
    amount: amountInCents,
    currency: 'usd',
    application_fee_amount: applicationFee,
    transfer_data: {
      destination: TEST_STRIPE_ACCOUNT_ID,
    },
    description: 'YardSync test invoice - $500',
    payment_method: 'pm_card_visa',
    confirm: true,
    return_url: 'https://yardsync.vercel.app/dashboard',
  })

  console.log('PaymentIntent status:', paymentIntent.status)
  console.log('PaymentIntent ID:', paymentIntent.id)
  console.log('Application fee amount:', paymentIntent.application_fee_amount)
  console.log('Transfer destination:', paymentIntent.transfer_data?.destination)
}

runTest().catch(console.error)
