import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { queryCollection, getDocument, setDocument, updateDocument } from '@/lib/firestoreRest'
import { sendAdminEmail } from '@/lib/email'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

export async function POST(request) {
  console.log('Webhook received:', request.headers.get('stripe-signature') ? 'has signature' : 'no signature')
  const body      = await request.text()
  const signature = request.headers.get('stripe-signature')

  let event
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    )
  } catch (err) {
    console.error('Webhook signature error:', err.message)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  console.log('Webhook event type:', event.type)
  const session     = event.data.object
  const gardenerUid = session.metadata?.gardenerUid || session.subscription_details?.metadata?.gardenerUid

  try {
    switch (event.type) {

      /* ── checkout.session.completed ─────────────── */
      case 'checkout.session.completed': {
        if (!gardenerUid) {
          console.error('Webhook: No gardenerUid found in session metadata – skipping write')
          break
        }

        const subscriptionId = session.subscription
        const customerId     = session.customer

        const subscription = await stripe.subscriptions.retrieve(subscriptionId)
        const priceId      = subscription.items.data[0]?.price?.id
        const plan         = priceId === process.env.STRIPE_PRICE_ANNUAL ? 'annual' : 'monthly'

        await setDocument('subscriptions', gardenerUid, {
          gardenerUid,
          stripeCustomerId:     customerId,
          stripeSubscriptionId: subscriptionId,
          stripePriceId:        priceId,
          plan,
          status:               'active',
          currentPeriodEnd:     subscription.current_period_end
                                    ? new Date(subscription.current_period_end * 1000).toISOString()
                                    : null,
          createdAt:            new Date().toISOString(),
          updatedAt:            new Date().toISOString(),
        })

        await setDocument('users', gardenerUid, {
          subscriptionStatus:   'active',
          subscriptionPlan:     plan,
          stripeCustomerId:     customerId,
          stripeSubscriptionId: subscriptionId,
          updatedAt:            new Date().toISOString(),
        })

        console.log('webhook write complete', { uid: gardenerUid, stripeSubscriptionId: subscriptionId })
        console.log(`Subscription activated for ${gardenerUid} – ${plan}`)

        // Detect Pro Setup add-on by inspecting line items
        let hasSetup = false
        try {
          const lineItems = await stripe.checkout.sessions.listLineItems(session.id)
          const setupPriceId = process.env.STRIPE_PRICE_SETUP
          hasSetup = setupPriceId && lineItems.data.some(li => li.price?.id === setupPriceId)
          console.log('Pro Setup detection:', { hasSetup, setupPriceId, lineItemCount: lineItems.data.length })
        } catch (liErr) {
          console.error('listLineItems failed (non-fatal):', liErr.message)
        }

        if (hasSetup) {
          // Look up gardener name + email
          let gardenerName  = ''
          let gardenerEmail = ''
          try {
            const userDoc = await getDocument('users', gardenerUid)
            if (userDoc) {
              gardenerName  = userDoc.data.name || 'Unknown'
              gardenerEmail = userDoc.data.email || session.customer_email || ''
            }
          } catch { /* best-effort */ }

          await setDocument('users', gardenerUid, {
            setupFeePaid:     true,
            setupPaidAt:      new Date().toISOString(),
            setupContacted:   false,
            setupContactedAt: null,
            setupNotes:       '',
          })

          console.log(`Pro Setup purchased by ${gardenerUid} — ${gardenerName}`)

          // ── Admin SMS alert ──
          const adminPhone = process.env.ADMIN_PHONE_NUMBER
          if (adminPhone) {
            try {
              const twilioSid   = process.env.TWILIO_ACCOUNT_SID
              const twilioToken = process.env.TWILIO_AUTH_TOKEN
              const twilioFrom  = process.env.TWILIO_PHONE_NUMBER
              const digits      = adminPhone.replace(/\D/g, '')
              const to          = digits.startsWith('1') ? `+${digits}` : `+1${digits}`
              const smsBody     = new URLSearchParams({
                To:   to,
                From: twilioFrom,
                Body: `New YardSync Pro Setup purchase – ${gardenerName} (${gardenerEmail}). Reach out to onboard. https://yardsyncapp.com/admin/dashboard`,
              })
              await fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`, {
                method:  'POST',
                headers: {
                  'Content-Type':  'application/x-www-form-urlencoded',
                  'Authorization': 'Basic ' + Buffer.from(`${twilioSid}:${twilioToken}`).toString('base64'),
                },
                body: smsBody.toString(),
              })
              console.log('Admin SMS sent for Pro Setup')
            } catch (smsErr) {
              console.error('Admin SMS failed (non-fatal):', smsErr.message)
            }
          }

          // ── Admin email alert ──
          await sendAdminEmail({
            subject: `🛠 New Pro Setup purchase — ${gardenerName}`,
            text: `A new contractor just purchased the $99 Pro Setup add-on.\n\nName: ${gardenerName}\nEmail: ${gardenerEmail}\nUID: ${gardenerUid}\n\nReach out to begin onboarding their client list.\n\nAdmin dashboard: https://yardsyncapp.com/admin/dashboard`,
            html: `
              <div style="font-family:-apple-system,sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#f8faf9;">
                <div style="background:#0F6E56;color:#fff;padding:20px 24px;border-radius:12px 12px 0 0;">
                  <h1 style="margin:0;font-size:20px;font-weight:700;">🛠 New Pro Setup purchase</h1>
                  <p style="margin:6px 0 0;opacity:.9;font-size:13px;">A contractor needs onboarding</p>
                </div>
                <div style="background:#fff;padding:24px;border-radius:0 0 12px 12px;border:1px solid #e4e9e5;border-top:none;">
                  <p style="margin:0 0 16px;font-size:15px;color:#1a2420;"><strong>${gardenerName}</strong> just paid $99 for Pro Setup migration.</p>
                  <table style="width:100%;font-size:14px;color:#5a6b60;">
                    <tr><td style="padding:6px 0;">Name</td><td style="text-align:right;color:#1a2420;font-weight:600;">${gardenerName}</td></tr>
                    <tr><td style="padding:6px 0;">Email</td><td style="text-align:right;color:#1a2420;font-weight:600;">${gardenerEmail}</td></tr>
                    <tr><td style="padding:6px 0;">UID</td><td style="text-align:right;font-family:monospace;font-size:11px;color:#5a6b60;">${gardenerUid}</td></tr>
                  </table>
                  <p style="margin:20px 0 0;font-size:13px;color:#5a6b60;">Reach out within 24 hours to begin onboarding their client list.</p>
                  <a href="https://yardsyncapp.com/admin/dashboard" style="display:inline-block;margin-top:16px;background:#0F6E56;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">Open admin dashboard →</a>
                </div>
                <p style="margin:16px 0 0;text-align:center;font-size:11px;color:#8aaa96;">YardSync · JNew Technologies, LLC</p>
              </div>
            `,
          })
        }

        break
      }

      /* ── invoice.payment_succeeded ──────────────── */
      case 'invoice.payment_succeeded': {
        console.log('invoice.payment_succeeded fired:', { subscription: session.subscription, payment_intent: session.payment_intent })

        // Handle subscription renewal
        const subscriptionId = session.subscription
        if (subscriptionId) {
          const subDoc = await queryCollection('subscriptions', 'stripeSubscriptionId', subscriptionId)
          if (subDoc) {
            const uid = subDoc.data.gardenerUid
            const subscription = await stripe.subscriptions.retrieve(subscriptionId)
            await updateDocument('subscriptions', uid, {
              status:           'active',
              currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
              updatedAt:        new Date().toISOString(),
            })
            await setDocument('users', uid, {
              subscriptionStatus: 'active',
              updatedAt:          new Date().toISOString(),
            })
            console.log(`Subscription renewed for ${uid}`)
          }
        }

        // Also check if this is a Connect invoice payment
        const piId = session.payment_intent
        if (piId) {
          const invDoc = await queryCollection('invoices', 'stripePaymentIntentId', piId)
          console.log('Invoice query result – empty:', !invDoc, 'searching for:', piId)
          if (invDoc) {
            await updateDocument('invoices', invDoc.id, {
              status:    'paid',
              paidAt:    new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            })
            console.log(`Invoice ${invDoc.id} marked paid via PaymentIntent ${piId}`)
          } else {
            console.log('No invoice found for PaymentIntent:', piId)
          }
        }
        break
      }

      /* ── invoice.payment_failed ─────────────────── */
      case 'invoice.payment_failed': {
        const subscriptionId = session.subscription
        if (!subscriptionId) break

        const subDoc = await queryCollection('subscriptions', 'stripeSubscriptionId', subscriptionId)
        if (!subDoc) break

        const uid = subDoc.data.gardenerUid

        await updateDocument('subscriptions', uid, {
          status:    'past_due',
          updatedAt: new Date().toISOString(),
        })
        await setDocument('users', uid, {
          subscriptionStatus: 'past_due',
          updatedAt:          new Date().toISOString(),
        })

        console.log(`Payment failed for ${uid}`)
        break
      }

      /* ── customer.subscription.updated ──────────── */
      case 'customer.subscription.updated': {
        const subscription = event.data.object
        const customerId   = subscription.customer
        const userDoc      = await queryCollection('users', 'stripeCustomerId', customerId)
        if (userDoc) {
          const priceId = subscription.items.data[0]?.price?.id
          const plan    = priceId === process.env.STRIPE_PRICE_ANNUAL ? 'annual' : 'monthly'
          await setDocument('users', userDoc.id, {
            subscriptionPlan:   plan,
            subscriptionStatus: subscription.status,
            updatedAt:          new Date().toISOString(),
          })
          console.log(`Subscription updated for ${userDoc.id}`)
        }
        break
      }

      /* ── customer.subscription.deleted ──────────── */
      case 'customer.subscription.deleted': {
        const subscriptionId = session.id
        const subDoc = await queryCollection('subscriptions', 'stripeSubscriptionId', subscriptionId)
        if (!subDoc) break

        const uid = subDoc.data.gardenerUid

        await updateDocument('subscriptions', uid, {
          status:    'canceled',
          updatedAt: new Date().toISOString(),
        })
        await setDocument('users', uid, {
          subscriptionStatus: 'canceled',
          updatedAt:          new Date().toISOString(),
        })

        console.log(`Subscription canceled for ${uid}`)
        break
      }

      /* ── payment_intent.succeeded ───────────────── */
      case 'payment_intent.succeeded': {
        const pi = event.data.object
        console.log('payment_intent.succeeded fired:', { id: pi.id, gardenerUid: pi.metadata?.gardenerUid })

        const invDoc = await queryCollection('invoices', 'stripePaymentIntentId', pi.id)
        console.log('Invoice query result – empty:', !invDoc, 'searching for:', pi.id)

        if (invDoc) {
          await updateDocument('invoices', invDoc.id, {
            status:    'paid',
            paidAt:    new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          })
          console.log(`Invoice ${invDoc.id} marked paid via PaymentIntent ${pi.id}`)
        } else {
          console.log('No invoice found for PaymentIntent:', pi.id)
        }
        break
      }
    }
  } catch (err) {
    console.error('Webhook handler error:', err.message, err.stack)
    return NextResponse.json({ error: 'Webhook handler failed', message: err.message }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
