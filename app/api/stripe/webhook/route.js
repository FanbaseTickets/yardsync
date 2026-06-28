import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { queryCollection, getDocument, setDocument, updateDocument } from '@/lib/firestoreRest'
import { sendAdminEmail, sendClientEmail } from '@/lib/email'
import { getSubscriptionPeriodEndISO } from '@/lib/stripeHelpers'
import { getBaseUrl } from '@/lib/baseUrl'
import { sendPush } from '@/lib/push'

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

        // ── Card-on-file capture (free-access model) ──────────────────
        // A mode:'setup' session means the contractor saved a card with NO
        // charge at the "get paid" setup step. Mark pmOnFile + store/default
        // the payment method so the first-paid activation can bill it. Do NOT
        // touch subscriptionStatus — it stays 'free_until_paid' until their
        // first client invoice is paid. (See docs/FREE_ACCESS_SPEC.md §4.1.)
        if (session.mode === 'setup') {
          try {
            // Expand the payment method so we can store the brand + last4 for
            // the "card on file" display + the Update-card flow.
            const si = session.setup_intent
              ? await stripe.setupIntents.retrieve(session.setup_intent, { expand: ['payment_method'] })
              : null
            const pm   = si?.payment_method || null
            const pmId = (pm && typeof pm === 'object') ? pm.id : (pm || null)
            const cust = session.customer || null
            if (pmId && cust) {
              // Set as the customer's default PM — this REPLACES any prior card,
              // which is exactly what the Update-card-on-file flow needs.
              await stripe.customers.update(cust, {
                invoice_settings: { default_payment_method: pmId },
              })
              // CRITICAL: our subscriptions are created with a SUBSCRIPTION-level
              // default_payment_method (at first-paid activation), which takes
              // precedence over the customer default. So an existing subscriber
              // updating their card must also have the SUBSCRIPTION default
              // updated, or the new card would never actually be charged.
              try {
                const u = await getDocument('users', gardenerUid)
                const subId = u?.data?.stripeSubscriptionId
                if (subId) await stripe.subscriptions.update(subId, { default_payment_method: pmId })
              } catch (e) {
                console.error('subscription default PM update failed (non-fatal):', e.message)
              }
            }
            await updateDocument('users', gardenerUid, {
              stripeCustomerId:      cust,
              stripePaymentMethodId: pmId,
              cardBrand:             pm?.card?.brand || null,
              cardLast4:             pm?.card?.last4 || null,
              pmOnFile:              true,
              pmOnFileAt:            new Date().toISOString(),
              updatedAt:             new Date().toISOString(),
            })
            console.log(`Card on file saved for ${gardenerUid} — pm ${pmId} (${pm?.card?.brand} ****${pm?.card?.last4})`)
          } catch (e) {
            console.error('setup-mode checkout handling failed:', e.message)
          }
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
              // Twilio status callback for the admin SMS — uses the
              // request's base URL so Preview-side test webhooks route
              // delivery updates back to Preview Firestore. The admin
              // dashboard link inside the SMS body itself stays hardcoded
              // to https://yardsync.vercel.app/admin/dashboard since the
              // admin dashboard only exists on Production.
              const cbUrl        = `${getBaseUrl(request)}/api/twilio/status-callback?ctx=pro_setup_admin&gardenerUid=${gardenerUid}`
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

            // Trust-state mechanic (spec §6.3): on first paid invoice for an
            // intake-sourced client (billingMode='upfront'), increment the
            // completedJobsCount. Once it crosses 1, the /clients UI offers
            // the contractor a one-time "switch to post-visit?" prompt.
            //
            // Idempotent via per-invoice countedTowardTrust flag — Stripe can
            // re-fire payment_succeeded after retries, and we don't want to
            // inflate the counter. The check + flag write isn't transactional
            // but the failure mode (double-count under tight concurrency) is
            // benign for a trust-building counter.
            if (!invDoc.data.countedTowardTrust && invDoc.data.clientId) {
              try {
                const clientDoc = await getDocument('clients', invDoc.data.clientId)
                if (clientDoc?.data) {
                  const prev = clientDoc.data.completedJobsCount || 0
                  await updateDocument('clients', invDoc.data.clientId, {
                    completedJobsCount: prev + 1,
                    lastInvoicePaidAt:  new Date().toISOString(),
                    updatedAt:          new Date().toISOString(),
                  })
                  await updateDocument('invoices', invDoc.id, {
                    countedTowardTrust: true,
                  })
                  console.log(`Trust-state: clients/${invDoc.data.clientId}.completedJobsCount ${prev} -> ${prev + 1}`)
                } else {
                  console.warn(`[webhook] trust-state: clients/${invDoc.data.clientId} not found; skipping increment`)
                }
              } catch (trustErr) {
                console.error('[webhook] trust-state increment failed (non-fatal):', trustErr.message)
              }
            }
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
          // Direct charges require card_payments active (not just charges_enabled,
          // which can be true off the transfers capability alone). The invoice
          // route gates on this.
          stripeCardPaymentsActive:          account.capabilities?.card_payments === 'active',
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
          // DIRECT CHARGE economics (see docs/DIRECT_CHARGES_AND_RECEIPTS.md):
          // the connected account is the merchant of record, so Stripe's
          // processing fee (≈2.9% + $0.30) is borne by the CONTRACTOR, not the
          // platform. YardSync therefore nets the FULL 5.5% application fee.
          //   netToPlatform   = applicationFee            (full, no fee subtracted)
          //   stripeProcessingFee = the contractor's Stripe cost (recorded for
          //                         the contractor's net display, not ours)
          // (queryCollection returns { id, name, data } — read invDoc.data.*)
          const amountCents          = pi.amount || 0
          const applicationFee       = invDoc.data.applicationFee || pi.application_fee_amount || 0
          const stripeProcessingFee  = Math.round(amountCents * 0.029) + 30 // contractor's cost
          const netToPlatform        = applicationFee

          await updateDocument('invoices', invDoc.id, {
            status:               'paid',
            paidAt:               new Date().toISOString(),
            updatedAt:            new Date().toISOString(),
            stripeProcessingFee,
            netToPlatform,
            // Direct charge: contractor's actual take = total − our fee − their
            // Stripe fee. Overwrites the send-time estimate with the settled value.
            contractorReceives:   Math.max(0, amountCents - applicationFee - stripeProcessingFee),
          })
          console.log(`Invoice ${invDoc.id} marked paid via PaymentIntent ${pi.id} — amount: ${amountCents}¢, appFee: ${applicationFee}¢, contractorStripeFee: ${stripeProcessingFee}¢, netToPlatform(full appFee): ${netToPlatform}¢`)

          // Secondary push: alert the contractor that a client paid (additive;
          // no-op if they haven't enabled push).
          if (invDoc.data.gardenerUid) {
            await sendPush(invDoc.data.gardenerUid, {
              title: 'Payment received 💸',
              body:  `${invDoc.data.clientName || 'A client'} paid $${(amountCents / 100).toFixed(2)}`,
              url:   '/dashboard',
            })
          }

          // Trust-state mechanic (spec §6.3): a first paid invoice for an
          // intake-sourced upfront client increments completedJobsCount, which
          // flips the /clients "switch to post-visit?" prompt. One-off client
          // invoices are charged via a direct PaymentIntent, so they arrive
          // HERE (payment_intent.succeeded) — NOT in the invoice.payment_succeeded
          // handler (that's subscription invoices). The increment must live in
          // both paths. Idempotent via the per-invoice countedTowardTrust flag,
          // which also prevents any double-count if both events ever fire.
          if (!invDoc.data.countedTowardTrust && invDoc.data.clientId) {
            try {
              const clientDoc = await getDocument('clients', invDoc.data.clientId)
              if (clientDoc?.data) {
                const prev = clientDoc.data.completedJobsCount || 0
                await updateDocument('clients', invDoc.data.clientId, {
                  completedJobsCount: prev + 1,
                  lastInvoicePaidAt:  new Date().toISOString(),
                  updatedAt:          new Date().toISOString(),
                })
                await updateDocument('invoices', invDoc.id, { countedTowardTrust: true })
                console.log(`Trust-state: clients/${invDoc.data.clientId}.completedJobsCount ${prev} -> ${prev + 1}`)
              } else {
                console.warn(`[webhook] trust-state: clients/${invDoc.data.clientId} not found; skipping increment`)
              }
            } catch (trustErr) {
              console.error('[webhook] trust-state increment failed (non-fatal):', trustErr.message)
            }
          }

          // ── First-paid activation (free-access model) ──────────────────
          // The contractor's FIRST paid client invoice creates + bills their
          // $39/mo (or annual) subscription on the card captured at the "get
          // paid" step. This is the activation trigger for the whole free
          // model. Idempotent via firstPaidInvoiceId. The subscription bills
          // on the PLATFORM account (no { stripeAccount }) — YardSync billing
          // the contractor — using the platform customer + saved PM.
          // (docs/FREE_ACCESS_SPEC.md §4.3.)
          try {
            const gUid     = invDoc.data.gardenerUid
            const gardener = gUid ? await getDocument('users', gUid) : null
            const g        = gardener?.data
            if (g && g.subscriptionStatus === 'free_until_paid' && !g.firstPaidInvoiceId) {
              if (!g.stripeCustomerId || !g.stripePaymentMethodId) {
                console.error(`[webhook] first-paid activation BLOCKED for ${gUid}: missing customer/PM`, { cust: g.stripeCustomerId, pm: g.stripePaymentMethodId })
              } else {
                const plan    = g.subscriptionPlan === 'annual' ? 'annual' : 'monthly'
                const priceId = plan === 'annual' ? process.env.STRIPE_PRICE_ANNUAL : process.env.STRIPE_PRICE_MONTHLY
                const sub = await stripe.subscriptions.create({
                  customer:               g.stripeCustomerId,
                  items:                  [{ price: priceId }],
                  default_payment_method: g.stripePaymentMethodId,
                  // error_if_incomplete: a hard decline THROWS (caught below) rather
                  // than silently returning an 'incomplete' sub that never retries and
                  // expires in ~23h. On throw we do NOT write firstPaidInvoiceId, so the
                  // contractor stays 'free_until_paid' and the NEXT paid invoice retries
                  // activation (the SetupIntent card was valid, so declines are likely
                  // transient) — strictly better than parking them in an un-retried state.
                  payment_behavior:       'error_if_incomplete',
                  metadata:               { gardenerUid: gUid, activatedByInvoice: invDoc.id },
                }, {
                  // Per-gardener key: concurrent or re-delivered paid invoices can never
                  // create a second subscription or double-charge — Stripe returns the
                  // same sub for any repeat call.
                  idempotencyKey: `activation_${gUid}`,
                })
                const periodEnd = getSubscriptionPeriodEndISO(sub)
                const activated = sub.status === 'active' || sub.status === 'trialing'
                // Write the subscriptions doc too, so renewal handling
                // (invoice.payment_succeeded looks it up by stripeSubscriptionId)
                // and cancel/reactivate work for these accounts.
                await setDocument('subscriptions', gUid, {
                  gardenerUid:          gUid,
                  stripeCustomerId:     g.stripeCustomerId,
                  stripeSubscriptionId: sub.id,
                  stripePriceId:        priceId,
                  plan,
                  status:               sub.status,
                  currentPeriodEnd:     periodEnd,
                  createdAt:            new Date().toISOString(),
                  updatedAt:            new Date().toISOString(),
                })
                await updateDocument('users', gUid, {
                  subscriptionStatus:   activated ? 'active' : 'past_due',
                  subscriptionPlan:     plan,
                  stripeSubscriptionId: sub.id,
                  currentPeriodEnd:     periodEnd,
                  firstPaidInvoiceId:   invDoc.id,
                  firstPaidAt:          new Date().toISOString(),
                  lastPaymentAt:        activated ? new Date().toISOString() : (g.lastPaymentAt || null),
                  updatedAt:            new Date().toISOString(),
                })
                console.log(`[webhook] first-paid activation: ${gUid} sub ${sub.id} status=${sub.status} via invoice ${invDoc.id}`)
              }
            }
          } catch (actErr) {
            console.error('[webhook] first-paid activation failed (non-fatal):', actErr.message)
          }
        } else {
          console.log('No invoice found for PaymentIntent:', pi.id)
        }
        break
      }

      /* ── charge.refunded ────────────────────────── */
      // Direct-charge refunds fire on the CONNECTED account. The contractor
      // (merchant of record) issues the refund; we update the invoice so a
      // fully-refunded charge drops out of paid-revenue sums (volume rewards +
      // admin P&L). Partial refunds keep status 'paid' but record the refunded
      // amount. NOTE: the volume/P&L calculators sum totalCents on status
      // 'paid', so partial refunds are recorded but not yet netted out of
      // volume — TODO: subtract refundedAmountCents in those calculators.
      //
      // FEE-LOSS RISK (TODO, enforce at refund-creation time, not here): our
      // Terms say the 5.5% application fee is non-refundable. The API default
      // (refund_application_fee omitted = false) preserves it — BUT if a
      // contractor issues the refund from their own Stripe Express dashboard,
      // Stripe refunds the full charge AND pulls back our application fee. The
      // only reliable enforcement is an in-app "Refund" button that calls
      // stripe.refunds.create({ charge, refund_application_fee: false }, { stripeAccount }).
      // Until that exists, dashboard refunds silently cost us the 5.5%.
      case 'charge.refunded': {
        const charge = event.data.object
        const piId   = charge.payment_intent
        if (!piId) { console.log('charge.refunded: no payment_intent on charge', charge.id); break }

        const invDoc = await queryCollection('invoices', 'stripePaymentIntentId', piId)
        if (!invDoc) { console.log('charge.refunded: no invoice for PI', piId); break }

        const amountCents   = charge.amount || 0
        const refundedCents = charge.amount_refunded || 0
        const fullyRefunded = charge.refunded === true || refundedCents >= amountCents

        await updateDocument('invoices', invDoc.id, {
          status:              fullyRefunded ? 'refunded' : 'paid',
          refundedAmountCents: refundedCents,
          partiallyRefunded:   !fullyRefunded && refundedCents > 0,
          refundedAt:          new Date().toISOString(),
          updatedAt:           new Date().toISOString(),
        })
        console.log(`Invoice ${invDoc.id} ${fullyRefunded ? 'REFUNDED' : 'partially refunded'} (${refundedCents}/${amountCents}¢) via charge ${charge.id}`)

        // Reverse the trust-state increment on a FULL refund so the
        // first-time→post-visit mechanic + completedJobsCount stay honest.
        // Idempotent via the trustReversed flag.
        if (fullyRefunded && invDoc.data.countedTowardTrust && !invDoc.data.trustReversed && invDoc.data.clientId) {
          try {
            const clientDoc = await getDocument('clients', invDoc.data.clientId)
            if (clientDoc?.data) {
              const prev = clientDoc.data.completedJobsCount || 0
              await updateDocument('clients', invDoc.data.clientId, {
                completedJobsCount: Math.max(0, prev - 1),
                updatedAt:          new Date().toISOString(),
              })
              await updateDocument('invoices', invDoc.id, { trustReversed: true })
              console.log(`Trust-state reversed: clients/${invDoc.data.clientId}.completedJobsCount ${prev} -> ${Math.max(0, prev - 1)}`)
            }
          } catch (e) {
            console.error('[webhook] trust-state reversal failed (non-fatal):', e.message)
          }
        }
        break
      }

      /* ── charge.dispute.created ─────────────────── */
      // A client opened a dispute/chargeback on a direct charge. The contractor
      // is merchant of record and owns the response; we flag the invoice
      // 'disputed' (drops out of paid-revenue sums while contested) and alert
      // admin so the contractor can be helped to submit evidence before the
      // (tight) Stripe deadline.
      case 'charge.dispute.created': {
        const dispute = event.data.object
        let piId = dispute.payment_intent
        if (!piId && dispute.charge) {
          try {
            const ch = await stripe.charges.retrieve(dispute.charge, { stripeAccount: event.account })
            piId = ch.payment_intent
          } catch (e) { console.error('dispute.created: charge retrieve failed:', e.message) }
        }
        if (!piId) { console.log('dispute.created: could not resolve payment_intent', dispute.id); break }

        const invDoc = await queryCollection('invoices', 'stripePaymentIntentId', piId)
        if (!invDoc) { console.log('dispute.created: no invoice for PI', piId); break }

        // Stripe can re-deliver dispute.created — only alert admin the first
        // time we see this dispute id on the invoice.
        const alreadyKnown = invDoc.data.disputeId === dispute.id

        await updateDocument('invoices', invDoc.id, {
          status:             'disputed',
          disputeId:          dispute.id,
          disputeReason:      dispute.reason || null,
          disputeAmountCents: dispute.amount || 0,
          disputeStatus:      dispute.status || null,
          disputedAt:         new Date().toISOString(),
          updatedAt:          new Date().toISOString(),
        })
        console.log(`Invoice ${invDoc.id} DISPUTED (${dispute.reason}) via dispute ${dispute.id}`)

        // Urgent — alert admin (evidence deadlines are short). Skip on re-delivery.
        if (!alreadyKnown) try {
          const amt = ((dispute.amount || 0) / 100).toFixed(2)
          const who = invDoc.data.clientName || 'a client'
          await sendAdminEmail({
            subject: `⚠️ Payment dispute opened — ${who}`,
            text: `A dispute (${dispute.reason || 'unknown reason'}) was opened on invoice ${invDoc.id} for $${amt}. Contractor: ${invDoc.data.gardenerUid}. The contractor is merchant of record and must submit evidence before the Stripe deadline.`,
            html: `<p>A <strong>dispute</strong> was opened on a YardSync invoice.</p><ul><li>Invoice: ${invDoc.id}</li><li>Client: ${who}</li><li>Amount: $${amt}</li><li>Reason: ${dispute.reason || '—'}</li><li>Contractor: ${invDoc.data.gardenerUid}</li></ul><p>The contractor is merchant of record and must submit evidence before the Stripe evidence deadline.</p>`,
          })
        } catch (e) { console.error('[webhook] dispute admin email failed (non-fatal):', e.message) }

        // Alert the CONTRACTOR too — they're merchant of record and must submit
        // evidence before Stripe's deadline. Winning the dispute = not losing
        // the money, so this is the strongest protection we have. Email + push,
        // best-effort (never throws into the webhook). Skip on re-delivery.
        if (!alreadyKnown) try {
          const gUid     = invDoc.data.gardenerUid
          const userDoc  = gUid ? await getDocument('users', gUid) : null
          const cLang    = (userDoc?.data?.preferredLanguage || userDoc?.data?.language) === 'es' ? 'es' : 'en'
          const amt      = ((dispute.amount || 0) / 100).toFixed(2)
          const who      = invDoc.data.clientName || (cLang === 'es' ? 'un cliente' : 'a client')
          const dueBy    = dispute.evidence_details?.due_by
            ? new Date(dispute.evidence_details.due_by * 1000).toLocaleDateString(cLang === 'es' ? 'es-US' : 'en-US', { month: 'long', day: 'numeric', year: 'numeric' })
            : null
          // One-time link straight to their Stripe Express dashboard to respond.
          let loginUrl = null
          try {
            if (event.account) loginUrl = (await stripe.accounts.createLoginLink(event.account))?.url || null
          } catch (e) { console.error('[webhook] dispute login link failed (non-fatal):', e.message) }

          const cEmail = userDoc?.data?.email
          if (cEmail) {
            const subject = cLang === 'es'
              ? `⚠️ Disputa de pago${dueBy ? ` — responde antes del ${dueBy}` : ''}`
              : `⚠️ Payment dispute${dueBy ? ` — respond by ${dueBy}` : ''}`
            const text = cLang === 'es'
              ? `Un cliente (${who}) disputó un pago de $${amt} (motivo: ${dispute.reason || 'desconocido'}). Eres el comercio responsable y debes enviar evidencia (fotos del trabajo, registro del servicio)${dueBy ? ` antes del ${dueBy}` : ''} o perderás el pago.${loginUrl ? ` Responde aquí: ${loginUrl}` : ' Responde desde tu panel de Stripe Express.'}`
              : `A client (${who}) disputed a $${amt} payment (reason: ${dispute.reason || 'unknown'}). You're the merchant of record and must submit evidence (job photos, service record)${dueBy ? ` by ${dueBy}` : ''} or you'll lose the payment.${loginUrl ? ` Respond here: ${loginUrl}` : ' Respond from your Stripe Express dashboard.'}`
            const html = `<p>${cLang === 'es' ? 'Un cliente disputó un pago en YardSync.' : 'A client disputed a payment on YardSync.'}</p>
              <ul>
                <li>${cLang === 'es' ? 'Cliente' : 'Client'}: ${who}</li>
                <li>${cLang === 'es' ? 'Monto' : 'Amount'}: $${amt}</li>
                <li>${cLang === 'es' ? 'Motivo' : 'Reason'}: ${dispute.reason || '—'}</li>
                ${dueBy ? `<li>${cLang === 'es' ? 'Fecha límite' : 'Deadline'}: ${dueBy}</li>` : ''}
              </ul>
              <p><strong>${cLang === 'es' ? 'Eres el comercio responsable' : "You're the merchant of record"}</strong> — ${cLang === 'es' ? 'envía evidencia (fotos del trabajo, registro del servicio) o perderás el pago.' : 'submit evidence (job photos, service record) or you will lose the payment.'}</p>
              ${loginUrl
                ? `<p><a href="${loginUrl}" style="background:#0E7C66;color:#fff;padding:12px 20px;text-decoration:none;border-radius:6px;display:inline-block;font-weight:600;">${cLang === 'es' ? 'Responder en Stripe' : 'Respond in Stripe'}</a></p>`
                : `<p>${cLang === 'es' ? 'Responde desde tu panel de Stripe Express.' : 'Respond from your Stripe Express dashboard.'}</p>`}`
            await sendClientEmail({ to: cEmail, subject, html, text, fromName: 'YardSync' })
          }

          if (gUid) {
            await sendPush(gUid, {
              title: cLang === 'es' ? '⚠️ Disputa de pago' : '⚠️ Payment dispute',
              body:  cLang === 'es'
                ? `${who} disputó $${amt}. Responde${dueBy ? ` antes del ${dueBy}` : ''} para no perder el pago.`
                : `${who} disputed $${amt}. Respond${dueBy ? ` by ${dueBy}` : ''} so you don't lose the payment.`,
              url:   invDoc.data.clientId ? `/clients/${invDoc.data.clientId}` : '/clients',
            })
          }
        } catch (e) { console.error('[webhook] dispute contractor alert failed (non-fatal):', e.message) }
        break
      }

      /* ── charge.dispute.closed ──────────────────── */
      // Dispute resolved. Won → restore the invoice to 'paid' (re-counts toward
      // revenue). Lost → 'dispute_lost' (stays out of paid sums; the card
      // network pulled the funds + dispute fee back from the contractor).
      case 'charge.dispute.closed': {
        const dispute = event.data.object
        let piId = dispute.payment_intent
        if (!piId && dispute.charge) {
          try {
            const ch = await stripe.charges.retrieve(dispute.charge, { stripeAccount: event.account })
            piId = ch.payment_intent
          } catch (e) { console.error('dispute.closed: charge retrieve failed:', e.message) }
        }
        if (!piId) { console.log('dispute.closed: could not resolve payment_intent', dispute.id); break }

        const invDoc = await queryCollection('invoices', 'stripePaymentIntentId', piId)
        if (!invDoc) { console.log('dispute.closed: no invoice for PI', piId); break }

        // 'warning_closed' = an early-fraud-warning that expired without becoming
        // a real dispute — money was never pulled, so treat it like a win.
        const won = dispute.status === 'won' || dispute.status === 'warning_closed'
        // The refund and dispute lifecycles are independent on the same charge.
        // Only restore to 'paid' if the invoice is actually sitting in the
        // 'disputed' state — never clobber a (partial/full) refund back to paid.
        const currentStatus = invDoc.data.status
        const nextStatus = won
          ? (currentStatus === 'disputed' ? 'paid' : currentStatus)
          : 'dispute_lost'
        await updateDocument('invoices', invDoc.id, {
          status:          nextStatus,
          disputeStatus:   dispute.status || null,
          disputeClosedAt: new Date().toISOString(),
          updatedAt:       new Date().toISOString(),
        })
        console.log(`Invoice ${invDoc.id} dispute ${dispute.status} — status -> ${nextStatus}`)

        // On a LOST dispute the payment was effectively clawed back — reverse
        // the trust-state increment (idempotent via trustReversed).
        if (!won && invDoc.data.countedTowardTrust && !invDoc.data.trustReversed && invDoc.data.clientId) {
          try {
            const clientDoc = await getDocument('clients', invDoc.data.clientId)
            if (clientDoc?.data) {
              const prev = clientDoc.data.completedJobsCount || 0
              await updateDocument('clients', invDoc.data.clientId, {
                completedJobsCount: Math.max(0, prev - 1),
                updatedAt:          new Date().toISOString(),
              })
              await updateDocument('invoices', invDoc.id, { trustReversed: true })
            }
          } catch (e) { console.error('[webhook] trust reversal on lost dispute failed (non-fatal):', e.message) }
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
