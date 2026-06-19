import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { queryCollection, getDocument, setDocument, updateDocument } from '@/lib/firestoreRest'
import { sendAdminEmail } from '@/lib/email'
import { getSubscriptionPeriodEndISO } from '@/lib/stripeHelpers'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

/**
 * Verify a Stripe webhook signature against multiple possible secrets.
 *
 * Modern Stripe Workbench issues a separate signing secret per destination,
 * so platform-account events and connected-account events come signed with
 * different secrets even when both destinations point to the same URL.
 * We try each configured secret in turn and return the first event that
 * verifies — or throw if none do.
 *
 * Order: STRIPE_WEBHOOK_SECRET (platform events, present in every env)
 *        STRIPE_WEBHOOK_SECRET_CONNECT (connected-account events, optional —
 *        skipped if env var is unset, e.g. in environments that don't yet
 *        have the connect destination configured in Stripe Dashboard).
 */
function verifyWebhookSignature(body, signature) {
  const secrets = [
    process.env.STRIPE_WEBHOOK_SECRET,
    process.env.STRIPE_WEBHOOK_SECRET_CONNECT,
  ].filter(Boolean)

  if (secrets.length === 0) {
    throw new Error('No STRIPE_WEBHOOK_SECRET configured')
  }

  let lastErr
  for (const secret of secrets) {
    try {
      return stripe.webhooks.constructEvent(body, signature, secret)
    } catch (err) {
      lastErr = err
    }
  }
  throw lastErr || new Error('Webhook signature did not verify against any configured secret')
}

export async function POST(request) {
  console.log('Webhook received:', request.headers.get('stripe-signature') ? 'has signature' : 'no signature')
  const body      = await request.text()
  const signature = request.headers.get('stripe-signature')

  let event
  try {
    event = verifyWebhookSignature(body, signature)
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
          currentPeriodEnd:     getSubscriptionPeriodEndISO(subscription),
          createdAt:            new Date().toISOString(),
          updatedAt:            new Date().toISOString(),
        })

        await setDocument('users', gardenerUid, {
          subscriptionStatus:   'active',
          subscriptionPlan:     plan,
          stripeCustomerId:     customerId,
          stripeSubscriptionId: subscriptionId,
          currentPeriodEnd:     getSubscriptionPeriodEndISO(subscription),
          lastPaymentAt:        new Date().toISOString(),
          hasSeenRewardsIntro:  false,
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
          console.log('Pro Setup admin SMS gate — ADMIN_PHONE_NUMBER:', adminPhone ? 'SET' : 'MISSING')
          if (adminPhone) {
            try {
              const twilioSid    = process.env.TWILIO_ACCOUNT_SID
              const twilioToken  = process.env.TWILIO_AUTH_TOKEN
              const twilioMsgSvc = process.env.TWILIO_MESSAGING_SERVICE_SID
              const digits       = adminPhone.replace(/\D/g, '')
              const to           = digits.startsWith('1') ? `+${digits}` : `+1${digits}`
              const cbAppUrl     = process.env.NEXT_PUBLIC_APP_URL || 'https://yardsync.vercel.app'
              const cbUrl        = `${cbAppUrl}/api/twilio/status-callback?ctx=pro_setup_admin&gardenerUid=${gardenerUid}`
              const smsBody      = new URLSearchParams({
                To:                  to,
                MessagingServiceSid: twilioMsgSvc,
                Body:                `New YardSync Pro Setup purchase – ${gardenerName} (${gardenerEmail}). Reach out to onboard. https://yardsync.vercel.app/admin/dashboard`,
                StatusCallback:      cbUrl,
              })
              console.log('Admin SMS firing to:', process.env.ADMIN_PHONE_NUMBER, '— msg svc:', process.env.TWILIO_MESSAGING_SERVICE_SID ? 'SET' : 'MISSING')
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
            text: `A new contractor just purchased the $99 Pro Setup add-on.\n\nName: ${gardenerName}\nEmail: ${gardenerEmail}\nUID: ${gardenerUid}\n\nReach out to begin onboarding their client list.\n\nAdmin dashboard: https://yardsync.vercel.app/admin/dashboard`,
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
                  <a href="https://yardsync.vercel.app/admin/dashboard" style="display:inline-block;margin-top:16px;background:#0F6E56;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">Open admin dashboard →</a>
                  <a href="https://yardsyncapp.com/YardSync_Client_Import_Template.xlsx" style="display:inline-block;margin-top:10px;background:#f0f4f1;color:#0F6E56;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:600;font-size:13px;border:1px solid #d4e0d8;">📋 Download client import template</a>
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
              currentPeriodEnd: getSubscriptionPeriodEndISO(subscription),
              updatedAt:        new Date().toISOString(),
            })
            await setDocument('users', uid, {
              subscriptionStatus: 'active',
              currentPeriodEnd:   getSubscriptionPeriodEndISO(subscription),
              lastPaymentAt:      new Date().toISOString(),
              updatedAt:          new Date().toISOString(),
            })
            console.log(`Subscription renewed for ${uid}`)
          } else {
            console.warn(`[webhook] invoice.payment_succeeded: No subscriptions doc found for stripeSubscriptionId=${subscriptionId}. User fields (lastPaymentAt, currentPeriodEnd) NOT updated. This account may predate the checkout webhook or have a mismatched subscription doc.`)
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
        if (!subDoc) {
          console.warn(`[webhook] invoice.payment_failed: No subscriptions doc found for stripeSubscriptionId=${subscriptionId}. User status NOT updated to past_due.`)
          break
        }

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
          // Persist cancel_at_period_end + cancel_at so the Settings UI can
          // show a "Subscription ends {date}" banner with a Reactivate
          // button. Without this, the in-app cancellation toast was the
          // only feedback and the Cancel link kept showing as if nothing
          // had happened — risk of confused contractors filing chargebacks.
          await setDocument('users', userDoc.id, {
            subscriptionPlan:              plan,
            subscriptionStatus:            subscription.status,
            subscriptionCancelAtPeriodEnd: subscription.cancel_at_period_end || false,
            subscriptionCancelAt:          subscription.cancel_at
              ? new Date(subscription.cancel_at * 1000).toISOString()
              : null,
            updatedAt:                     new Date().toISOString(),
          })
          console.log(`Subscription updated for ${userDoc.id} (cancel_at_period_end=${subscription.cancel_at_period_end})`)
        }
        break
      }

      /* ── customer.subscription.deleted ──────────── */
      case 'customer.subscription.deleted': {
        const subscriptionId = session.id
        const subDoc = await queryCollection('subscriptions', 'stripeSubscriptionId', subscriptionId)
        if (!subDoc) {
          console.warn(`[webhook] customer.subscription.deleted: No subscriptions doc found for stripeSubscriptionId=${subscriptionId}. User status NOT updated to canceled.`)
          break
        }

        const uid = subDoc.data.gardenerUid

        await updateDocument('subscriptions', uid, {
          status:    'canceled',
          updatedAt: new Date().toISOString(),
        })
        // Clear the cancel-pending fields — the subscription is fully
        // canceled now, so the Settings UI should show the standard
        // "subscription canceled" state rather than the "ends on {date}"
        // pending banner.
        await setDocument('users', uid, {
          subscriptionStatus:            'canceled',
          subscriptionCancelAtPeriodEnd: false,
          subscriptionCancelAt:          null,
          updatedAt:                     new Date().toISOString(),
        })

        console.log(`Subscription canceled for ${uid}`)
        break
      }

      /* ── account.updated ─────────────────────────
         Fires whenever a Stripe Connect connected account changes —
         most importantly when its `requirements.currently_due` /
         `eventually_due` arrays change as Stripe asks for KYC info
         (SSN last 4, DOB, bank account, etc.) or accepts what we sent.
         Persisting these to the user doc lets:
           - The contractor's Settings page show a "Stripe needs more
             info" banner with a Complete-on-Stripe button.
           - The admin dashboard surface a "Contractors needing Stripe
             info" widget so Jay can proactively send remediation links.
         Without this handler, contractors fly blind on KYC needs and
         only discover them when payouts get blocked.
      */
      case 'account.updated': {
        const account = event.data.object
        if (account?.object !== 'account') break
        const accountId = account.id
        if (!accountId) break

        const userDoc = await queryCollection('users', 'stripeAccountId', accountId)
        if (!userDoc) {
          console.warn(`[webhook] account.updated: no user with stripeAccountId=${accountId}`)
          break
        }

        const reqs = account.requirements || {}
        await setDocument('users', userDoc.id, {
          stripeRequirementsCurrentlyDue:    Array.isArray(reqs.currently_due)    ? reqs.currently_due    : [],
          stripeRequirementsEventuallyDue:   Array.isArray(reqs.eventually_due)   ? reqs.eventually_due   : [],
          stripeRequirementsPastDue:         Array.isArray(reqs.past_due)         ? reqs.past_due         : [],
          stripeRequirementsDisabledReason:  reqs.disabled_reason || null,
          stripeChargesEnabled:              account.charges_enabled || false,
          stripePayoutsEnabled:              account.payouts_enabled || false,
          stripeRequirementsUpdatedAt:       new Date().toISOString(),
          updatedAt:                         new Date().toISOString(),
        })
        console.log(`account.updated persisted for ${userDoc.id} — currently_due: ${reqs.currently_due?.length || 0}, past_due: ${reqs.past_due?.length || 0}`)
        break
      }

      /* ── payment_intent.succeeded ───────────────── */
      case 'payment_intent.succeeded': {
        const pi = event.data.object
        console.log('payment_intent.succeeded fired:', { id: pi.id, gardenerUid: pi.metadata?.gardenerUid })

        const invDoc = await queryCollection('invoices', 'stripePaymentIntentId', pi.id)
        console.log('Invoice query result – empty:', !invDoc, 'searching for:', pi.id)

        if (invDoc) {
          // Compute Stripe processing fee from the standard US card formula:
          // 2.9% of the amount + $0.30 (30¢) fixed. This is the rate Stripe
          // charges on a destination charge, taken from the platform's portion
          // (the application_fee_amount). The fee is stable and predictable
          // across the common card types YardSync sees.
          //
          // Previously we tried to fetch `latest_charge.balance_transaction.fee`
          // via stripe.paymentIntents.retrieve(), but for destination charges
          // the balance_transaction lives on the connected account, not the
          // platform — the retrieve returned null and the fields were never
          // written. (Found via Phase G of the 2026-06-03 SMS sweep.)
          //
          // ALSO: queryCollection returns { id, name, data } — earlier code
          // read invDoc.applicationFee directly (always undefined) instead of
          // invDoc.data.applicationFee. That's now fixed.
          const amountCents          = pi.amount || 0
          const applicationFee       = invDoc.data.applicationFee || pi.application_fee_amount || 0
          const stripeProcessingFee  = Math.round(amountCents * 0.029) + 30
          const netToPlatform        = applicationFee - stripeProcessingFee

          await updateDocument('invoices', invDoc.id, {
            status:               'paid',
            paidAt:               new Date().toISOString(),
            updatedAt:            new Date().toISOString(),
            stripeProcessingFee,
            netToPlatform,
          })
          console.log(`Invoice ${invDoc.id} marked paid via PaymentIntent ${pi.id} — amount: ${amountCents}¢, appFee: ${applicationFee}¢, stripeFee: ${stripeProcessingFee}¢, net: ${netToPlatform}¢`)
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
