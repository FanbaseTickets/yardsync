# Free Access — "Pay nothing until your first client pays you"

> Status: **SPEC / not yet built.** Authored 2026-06-24. Owner: Jay.
> Supersedes the subscribe-first gate for new signups. This is the single
> biggest funnel change since launch — read the whole doc before touching code.

## 1. The pitch (and why it's scam-proof)

A new contractor signs up, connects Stripe, and uses **everything** — clients,
scheduling, the digital business card + QR + lead funnel, invoicing, SMS — for
**$0**. We capture a card at signup but **do not charge it**. The $39/mo
subscription does not begin until their **first client invoice is paid**.

The billing trigger is *"you got paid through YardSync."* That is what makes it
abuse-proof, and it's the objection Jay raised ("they sign up, get their money,
then quit"):

- You **cannot** extract money from YardSync without a client first paying you
  *through the platform* — and that same payment already nets YardSync its 5.5%
  application fee (direct charge, see `DIRECT_CHARGES_AND_RECEIPTS.md`).
- The moment that first payment settles, the subscription activates and the
  card on file is charged. There is **no window** to "get paid and quit before
  paying us" — getting paid *is* the thing that bills you.
- A contractor who signs up and never gets a client paid costs us ~pennies (a
  Stripe SetupIntent + Firestore storage). No recurring liability, no support
  burden gate. They're a dormant lead, not a loss.

Net: we trade a near-zero-cost free tier for a massively wider top-of-funnel,
and we only ever bill people who have demonstrably made money with the product.

## 2. Why this is an architectural inversion (not a config flag)

Today the gate is **subscription-first**:

- `components/layout/AppShell.js:115-143` — requires
  `subscriptionStatus ∈ {active, canceling}` or it redirects to `/subscribe`.
- Bank/Stripe-Connect onboarding is gated *behind* an active subscription
  (`AppShell.js:122-128`, and commit `8bd343f` "gate bank-connect on an active
  subscription").
- Checkout (`app/api/stripe/checkout/route.js`) opens a Stripe Checkout in
  `mode: 'subscription'` that charges **immediately**; the webhook writes
  `subscriptionStatus: 'active'` in `checkout.session.completed`
  (`webhook/route.js:66-92`).

The new model **inverts** that: connecting Stripe + invoicing must be **free**
(that's the entire funnel). A **card on file** replaces the active subscription
as the anti-free-rider mechanism. The subscription is *triggered by* getting
paid, not a prerequisite to it.

### Stripe constraint that shapes the whole design

Stripe's native subscription trials are **time-based** (`trial_end` is a date),
not **event-based**. There is no "trial until first invoice paid" primitive. So
we cannot lean on a Stripe trial. We must:

1. Capture a payment method at signup **without charging** (SetupIntent), and
2. **Programmatically create the subscription** when the first invoice is paid,
   billing immediately.

## 3. State model

New `subscriptionStatus` value: **`free_until_paid`**.

| Status | Meaning | App access | Card |
|---|---|---|---|
| `free_until_paid` | Signed up, card on file, no paid invoice yet | **Full** | On file, never charged |
| `active` | First invoice paid → subscription created & billing | Full | Charged $39/mo (or annual) |
| `past_due` | Sub charge failed | Read-only after grace | On file, retrying |
| `canceled` / `canceling` | Existing flows, unchanged | Per existing | — |
| `none` | Legacy / no card captured | Redirect to capture | — |

New profile fields:

- `pmOnFile: boolean` — a payment method is saved to the Stripe Customer.
- `stripeCustomerId` — created at signup now (today it's created at checkout).
- `freeUntilPaidSince: ISO` — when they entered the free state (analytics).
- `firstPaidInvoiceId` / `firstPaidAt` — set when activation fires (idempotency).

## 4. Flows

### 4.1 Signup → card capture (no charge)

1. Account created (Firebase Auth + `users` doc) — unchanged.
2. Create a Stripe **Customer** immediately (store `stripeCustomerId`).
3. Open a **Stripe Checkout in `mode: 'setup'`** (or a SetupIntent + Elements)
   to save a card to that Customer. **No charge.** On success the webhook
   `checkout.session.completed` (mode=setup) writes `pmOnFile: true`,
   `subscriptionStatus: 'free_until_paid'`, `freeUntilPaidSince`.
   - The existing `$99 Pro Setup` add-on: offer it as an **optional one-time
     charge** here (mode=`setup` can't take a one-time line item, so Pro Setup
     becomes its own PaymentIntent or a separate Checkout). Keep it optional and
     decoupled — do **not** make it a barrier to the free tier.
4. Redirect to `/onboarding/connect-stripe` (now reachable in `free_until_paid`).

### 4.2 Use the app free

`AppShell` allows `free_until_paid` exactly like `active`. The contractor
connects Stripe, builds their card, adds clients, sends invoices. Each invoice
is a **direct charge** on their connected account (existing PR #37 path).

### 4.3 First invoice paid → activate subscription

Hook point: **`webhook/route.js:413` `payment_intent.succeeded`** (direct-charge
invoice paid on the connected account). After the existing invoice-paid write
(line 434) and trust-state increment, add:

```
// Activate the subscription on the contractor's FIRST paid invoice.
const gardenerUid = invDoc.data.gardenerUid
const gardener = await getDocument('users', gardenerUid)
if (gardener?.data?.subscriptionStatus === 'free_until_paid'
    && !gardener.data.firstPaidInvoiceId) {
  // Create the platform subscription on the SaaS Stripe account (NOT the
  // connected account — this is YardSync billing the contractor, on the card
  // captured at signup).
  const sub = await stripe.subscriptions.create({
    customer: gardener.data.stripeCustomerId,
    items: [{ price: gardener.data.subscriptionPlan === 'annual'
              ? process.env.STRIPE_PRICE_ANNUAL
              : process.env.STRIPE_PRICE_MONTHLY }],
    default_payment_method: <the saved PM>,
    metadata: { gardenerUid },
    // Apply any volume-reward coupon that already applies (see §6).
  })
  await updateDocument('users', gardenerUid, {
    subscriptionStatus: 'active',
    stripeSubscriptionId: sub.id,
    firstPaidInvoiceId: invDoc.id,
    firstPaidAt: new Date().toISOString(),
  })
}
```

Idempotency: guarded by `firstPaidInvoiceId` being unset + the per-invoice
`countedTowardTrust` flag already in this handler. If two paid invoices race,
only the first creates a subscription.

### 4.4 The activation charge declines

The card was valid at signup (SetupIntent) but could decline at activation.
Handle like any sub: `subscriptionStatus: 'past_due'`, dunning via Stripe Smart
Retries, a **grace period** (recommend 7 days) of continued access, then
read-only. Critically: they **already collected** the client payment (they're
the merchant of record), so this isn't us being out money on the client side —
just the $39. Low risk, standard dunning.

## 5. File-by-file changes

| File | Change |
|---|---|
| `app/signup/**` | After account create, create Stripe Customer + open `mode:'setup'` Checkout. |
| `app/api/stripe/setup-card/route.js` (NEW) | Creates Customer + setup-mode Checkout session. |
| `app/api/stripe/webhook/route.js` | (a) handle `checkout.session.completed` with `mode==='setup'` → `pmOnFile`, `free_until_paid`. (b) at `payment_intent.succeeded` → first-paid activation (§4.3). |
| `components/layout/AppShell.js:115-143` | Treat `free_until_paid` as full-access. Remove the subscribe-first redirect for it; redirect to card-capture only if `!pmOnFile`. Un-gate Connect onboarding from active sub. |
| `app/subscribe/**` | Repurpose: this becomes the **card-on-file capture** page for new signups, not an immediate charge. Existing reactivation flow stays. |
| `app/api/stripe/checkout/route.js` | Keep for explicit upgrades / Pro Setup; no longer the primary signup path. |
| Landing (`app/(landing)/page.js`) | New hero/pricing copy (§7). **No Firebase import** (constraint #2). |
| `/grow` admin card (`app/grow/**`) | Founder's referral card copy (§7). |
| `app/terms/page.js` §4 | Disclose the free-until-first-paid model + that billing starts on first paid invoice. **Run terms-reviewer.** |

## 6. Interactions / edge cases

- **Volume rewards.** Already grant free/50%-off subs at $1.5k/$3k.month. Under
  this model everyone is free until first-paid anyway; volume rewards layer on
  *after* activation as coupons on the created subscription. A contractor who
  hits $3k/mo in the same cycle as activation should get the free-sub coupon
  applied at `subscriptions.create` time — confirm the reward engine runs before
  or at activation.
- **Annual plan.** `subscriptionPlan` is chosen at signup (or defaulted to
  monthly) and read at activation. Annual = one $390 charge at first-paid.
- **Pro Setup $99.** Decoupled one-time charge, optional, never blocks free tier.
- **Contractor never gets paid.** Stays `free_until_paid` indefinitely — that's
  the promise. Consider a re-engagement email at 30/60 days (not billing).
- **Existing active accounts.** Untouched. This is for **new** signups; no
  migration of current subscribers.
- **Admin bypass.** Unchanged (`AppShell.js:100-104`).

## 7. Copy (EN/ES)

### Landing hero / pricing
- EN: **"Start free. Pay nothing until your first client pays you."**
  Sub: "Build your card, send invoices, get paid — $0 until money lands in your
  account. Then it's $39/mo. No risk, no upfront cost."
- ES: **"Empieza gratis. No pagas nada hasta que tu primer cliente te pague."**
  Sub: "Crea tu tarjeta, envía facturas y cobra — $0 hasta que el dinero llegue
  a tu cuenta. Después son $39/mes. Sin riesgo, sin costo inicial."

### /grow founder referral card
- EN: "Try YardSync free — you don't pay a cent until your first client pays
  you. Scan to start."
- ES: "Prueba YardSync gratis — no pagas ni un centavo hasta que tu primer
  cliente te pague. Escanea para empezar."

## 8. Build order (suggested)

1. `setup-card` route + signup card-capture (no charge) + `free_until_paid`
   webhook write.
2. AppShell gate inversion (free_until_paid = full access; gate on `pmOnFile`).
3. First-paid activation in `payment_intent.succeeded`.
4. Decline/dunning grace handling.
5. Landing + /grow copy.
6. terms-reviewer + privacy-reviewer pass; ToS §4 disclosure.
7. Full E2E on Preview: signup → card captured (not charged) → connect → send $1
   invoice → pay with test card → verify subscription created & $39 charged →
   verify second paid invoice does NOT re-create a sub.

## 9. Open decisions for Jay

- Grace period length on activation-charge decline (recommend **7 days**).
- Re-engagement cadence for never-paid accounts (email only, no billing).
- Whether Pro Setup is offered at signup or deferred to an in-app upsell.
- Annual-vs-monthly selection: at signup, or default monthly + upsell later?
