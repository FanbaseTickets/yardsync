import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { getDocument, updateDocument } from '@/lib/firestoreRest'
import { getBaseUrl } from '@/lib/baseUrl'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2026-02-25.clover' })
const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY || process.env.NEXT_PUBLIC_FIREBASE_API_KEY

async function verifyCallerUid(req) {
  const auth = req.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) return null
  try {
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_API_KEY}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken: auth.slice(7) }) }
    )
    if (!res.ok) return null
    const data = await res.json()
    return data.users?.[0]?.localId || null
  } catch {
    return null
  }
}

// AUTO-CHARGE Phase 1: mint a Stripe Checkout mode:'setup' session ON THE
// CONTRACTOR'S CONNECTED ACCOUNT to save a CLIENT's card for future off-session
// recurring charges (direct charges settle on the connected account, so the card
// must be vaulted there). The contractor sends the returned URL to their client;
// the client enters the card + agrees to the recurring authorization. The
// connect webhook (checkout.session.completed, mode:'setup', kind:'client_card')
// stores the customer + payment method on the client doc and enables auto-billing.
export async function POST(req) {
  try {
    const callerUid = await verifyCallerUid(req)
    if (!callerUid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { clientId } = await req.json()
    if (!clientId) return NextResponse.json({ error: 'Missing clientId' }, { status: 400 })

    // The connected account must be live (direct charges require card_payments).
    const gardenerDoc     = await getDocument('users', callerUid)
    const stripeAccountId = gardenerDoc?.data?.stripeAccountId
    const chargesEnabled  = gardenerDoc?.data?.stripeChargesEnabled === true
    if (!stripeAccountId || !chargesEnabled) {
      return NextResponse.json({ error: 'Finish payment setup first', code: 'no_connect' }, { status: 400 })
    }

    // The client must belong to this contractor.
    const clientDoc = await getDocument('clients', clientId)
    if (!clientDoc || clientDoc.data?.gardenerUid !== callerUid) {
      return NextResponse.json({ error: 'Client not found', code: 'no_client' }, { status: 404 })
    }
    const client = clientDoc.data

    // Reuse the client's connected-account customer if one exists, else create it
    // ON the connected account (where the card will be charged from).
    let customerId = client.clientStripeCustomerId || null
    if (!customerId) {
      const customer = await stripe.customers.create(
        {
          email:    client.email || undefined,
          name:     client.name || undefined,
          phone:    client.phone || undefined,
          metadata: { yardsyncClientId: clientId, gardenerUid: callerUid },
        },
        { stripeAccount: stripeAccountId }
      )
      customerId = customer.id
      await updateDocument('clients', clientId, {
        clientStripeCustomerId: customerId,
        updatedAt:              new Date().toISOString(),
      })
    }

    const baseUrl = getBaseUrl(req)
    const session = await stripe.checkout.sessions.create(
      {
        mode:                 'setup',
        payment_method_types: ['card'],
        customer:             customerId,
        // off_session future usage = the card can be charged automatically later.
        // Stripe shows the client a mandate; we add explicit recurring-authorization
        // text so the consent is unmistakable.
        custom_text: {
          submit: {
            message: `By saving your card you authorize ${gardenerDoc?.data?.businessName || 'this business'} to charge it automatically for your recurring service. You'll get a reminder before each charge and can cancel anytime by reply.`,
          },
        },
        success_url: `${baseUrl}/card-saved?ok=1`,
        cancel_url:  `${baseUrl}/card-saved?ok=0`,
        metadata: {
          kind:        'client_card',
          gardenerUid: callerUid,
          clientId,
        },
      },
      { stripeAccount: stripeAccountId }
    )

    return NextResponse.json({ url: session.url })
  } catch (err) {
    console.error('client-card error:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
