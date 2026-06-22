# Branded Receipts + Contractor Liability — Direct-Charges Migration

> **Status:** PLANNING / FOR REVIEW. No payment code has been changed.
> Drafted 2026-06-22. Two parts: (1) a Terms of Service redline for legal
> review, (2) a technical spec for migrating YardSync Pay from destination
> charges to **direct charges**.
>
> **Goal (Jay, 2026-06-22):** the contractor — not YardSync — should be the
> merchant of record on client payments, so receipts/statements are
> contractor-branded **and** refund/chargeback/dispute liability falls on the
> contractor. YardSync is the intermediary/platform, not the seller.
>
> **Timing advantage:** there are currently **no live contractor Connect
> accounts**, so this is a clean change to onboarding — not a re-onboarding of
> existing merchants.

---

## Why the change

**Today (destination charges):** the charge is created on the *platform*
account with `transfer_data.destination` → **JNew Technologies is the merchant
of record**, funds settle to the platform, the contractor's share is
transferred, and the platform is (by default) liable for disputes. The current
ToS Section 5 says exactly this.

**Problem:** (1) the client's card statement + Stripe receipt read "YardSync"
(unrecognized-charge → chargeback risk), and (2) the platform carries dispute/
refund liability — the opposite of the intended marketplace model.

**Target (direct charges):** the charge is created **on the connected
account** (`Stripe-Account: <acct>`), with the platform's 5.5% taken as
`application_fee_amount`. The **contractor is the merchant of record** →
contractor-branded receipt + statement, and **the contractor is liable for
refunds/disputes**. Requires the connected account to have the `card_payments`
capability (in addition to `transfers`).

> Note: `destination + on_behalf_of` only fixes *branding*; its dispute-
> *liability* treatment can still debit the platform. **Direct charges** is the
> model that cleanly moves both branding and liability to the contractor.
> **Verify** exact dispute-liability behavior (incl. Express "loss-liable"
> settings) against current Stripe docs before implementation.

---

## Part 1 — ToS Section 5 redline (DRAFT — requires lawyer review)

> ⚠️ Not legal advice. This is draft language for counsel to review/finalize.
> It changes the merchant-of-record and allocates refund/chargeback liability
> to the service provider, so it must be reviewed before going live.

**REPLACE** the current final paragraph of Section 5:

> ~~YardSync uses destination charges. For each client payment processed
> through YardSync Pay, JNew Technologies is the merchant of record. The
> contractor (connected account) receives the payment net of the 5.5%
> application fee.~~

**WITH:**

> YardSync facilitates payments between service providers and their clients
> using Stripe Connect **direct charges**. **The service provider (the
> connected Stripe account) is the merchant of record for each client
> payment.** JNew Technologies acts solely as a technology platform and payment
> facilitator and is **not** the merchant of record, the seller, or the
> provider of the underlying field-service work.
>
> **Refunds, chargebacks, and disputes.** Because the service provider is the
> merchant of record, **the service provider is solely responsible for all
> refunds, chargebacks, disputed charges, and any related fees** arising from
> payments collected through YardSync Pay. Refunds are issued from the service
> provider's connected account. The service provider authorizes Stripe and JNew
> Technologies to debit the connected account for the amount of any refund,
> chargeback, dispute, or associated fee. JNew Technologies does not guarantee
> any client payment and is not a party to, or liable for, any dispute between
> a service provider and its client.
>
> **Fees.** A 5.5% application fee is collected by JNew Technologies on each
> client payment. Stripe's own processing fees are charged by Stripe directly
> against each payment and are borne by the service provider's connected
> account, separate from and in addition to the 5.5% application fee.

**Open decisions for counsel / Jay:**
- On a client refund, is the **5.5% application fee refunded** to the client/
  contractor, or retained by YardSync? (Stripe supports `refund_application_fee`.)
  Recommend: retained by default (work to send the invoice was done), but state
  the policy explicitly.
- Confirm wording aligns with the **Stripe Connected Account Agreement** the
  contractor already accepts (Section 5 first paragraph).
- Cross-check **Section 12 (Limitation of Liability)** and **Section 4 (Fees)**
  for consistency with the new liability allocation.

---

## Part 2 — Technical spec (direct-charges migration)

### 2.1 Onboarding — request `card_payments`
`app/api/stripe/connect/create-account/route.js`
- Request both capabilities at account creation:
  `capabilities: { transfers: { requested: true }, card_payments: { requested: true } }`.
- Stripe's hosted onboarding then collects the additional KYC `card_payments`
  requires (identity/business verification). No custom UI — Express handles it.
- **Gate invoicing** on `capabilities.card_payments === 'active'` (today the
  Connect gate checks `charges_enabled`/`transfers`). Surface a clear status in
  AppShell + the admin Stripe-requirements widget (reuse `account.updated`
  webhook + `lib/stripeRequirementLabels.js`).

### 2.2 Invoice creation — direct charge
`app/api/stripe/invoice/route.js`
- Create the PaymentIntent **on the connected account**, drop `transfer_data`:
  ```
  stripe.paymentIntents.create(
    {
      amount: chargeCents,
      currency: 'usd',
      application_fee_amount: applicationFeeAmount, // platform's 5.5%
      description,            // e.g. "<business> — service invoice"
      receipt_email: clientEmail || undefined,
      metadata: { gardenerUid, clientId, clientName, ... },
    },
    { stripeAccount: stripeAccountId }              // <-- direct charge
  )
  ```
- The PI now lives on the **connected account**; its `client_secret` is scoped
  to that account.

### 2.3 Pay page — connected-account Stripe.js
`app/pay/[paymentIntentId]/` + `PayContent.js`
- To retrieve + confirm a direct-charge PI, the **`Stripe-Account` header** must
  be set. The server route that loads PI details for the pay page must use the
  connected-account context and pass the `connectedAccountId` to the client.
- Client-side Stripe.js must init with `{ stripeAccount: connectedAccountId }`
  so `confirmPayment` targets the right account.
- The contractor's `logoUrl` can also render here (already a backlog item) as a
  trust signal.

### 2.4 Webhook — Connect events
`app/api/stripe/webhook/route.js`
- Direct-charge events (`payment_intent.succeeded`, `charge.succeeded`,
  `charge.refunded`, `charge.dispute.*`) fire on the **connected account** and
  arrive as **Connect events** carrying `event.account`. The Connect webhook
  endpoint + `STRIPE_WEBHOOK_SECRET_CONNECT` already exist (PR #10).
- **Move invoice-paid reconciliation** from the platform `payment_intent.
  succeeded` handler to the Connect path keyed by `event.account` ===
  contractor's `stripeAccountId`.
- Handle `charge.refunded` and `charge.dispute.created/closed` → update invoice
  status; decide application-fee-refund policy.

### 2.5 Fee / net economics (CHANGES — update admin P&L)
- **Platform net = the full 5.5% application fee.** On direct charges, **Stripe's
  processing fee is borne by the connected account**, not the platform.
- So `netToPlatform` ≈ `application_fee` (no Stripe-fee subtraction for the
  platform). The contractor receives `amount − stripe_fee − application_fee`.
- Update the webhook's `stripeProcessingFee`/`netToPlatform` writes and the
  **admin dashboard P&L** (per-contractor breakdown) to reflect this — the
  Stripe fee becomes the *contractor's* cost line, not the platform's.

### 2.6 Refund flow
- Any refund must be issued **on the connected account**
  (`stripe.refunds.create({ payment_intent }, { stripeAccount })`).
- Decide `refund_application_fee` (see Part 1 open decision).

### Risks / sequencing
1. **Legal first** — finalize the ToS redline (Part 1) with counsel before
   shipping; the liability shift must be backed by the Terms.
2. Confirm Stripe dispute-liability semantics for direct charges + Express.
3. Build behind the capability gate so an account can't invoice until
   `card_payments === 'active'`.
4. Test end-to-end on a fresh test connected account: onboarding (with
   card_payments KYC) → invoice (direct charge) → pay page → Connect webhook →
   reconcile → refund → dispute. Use the stable `dev` webhook alias (INFRA-1).
5. P&L/display changes ride along (2.5).

### Estimated surface
`create-account`, `invoice/route.js`, `pay/[paymentIntentId]` (+ PayContent),
`webhook/route.js` (Connect path), admin dashboard P&L, any refund route, and
the ToS page. Meaningful but well-bounded; gate-able and testable in isolation.
