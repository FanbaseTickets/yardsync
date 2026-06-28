# ACH / Bank-Transfer Tier — Spec

> Status: scoped 2026-06-27. Decisions locked with Jay. Build staged (live pay
> path — ship in reviewable pieces, CC-test between stages).

## Why
Big-ticket play. Stripe's ACH cost (~0.8%, capped $5) is a fraction of cards
(2.9%+30¢), and clients paying $2–5k often prefer a bank transfer to a card.
ACH lets YardSync capture large jobs that would otherwise go off-platform
(cash/check) and gives contractors a genuinely cheaper option on big tickets.

## Locked decisions
1. **YardSync fee on ACH:** reduced rate — **2% capped at $100** (vs card 5.5%
   capped $100). Tunable via `NEXT_PUBLIC_ACH_FEE_RATE` / `NEXT_PUBLIC_ACH_FEE_CAP_CENTS`.
2. **Offered on:** large invoices only — **$500+** (`NEXT_PUBLIC_ACH_MIN_CENTS`,
   default 50000). Below the threshold, card-only (ACH's slow settlement isn't
   worth it on small jobs).
3. Card remains the default/instant path everywhere.

## The fee-by-method problem + solution
`application_fee_amount` is set when the PaymentIntent is created — but the client
picks card vs bank on the pay page, AFTER creation. A single PI can't carry two
fees. Solution:
- Create the PI allowing both methods, with the **card** fee as the initial
  `application_fee_amount` (conservative — the higher fee).
- When the client selects **Pay by bank**, the pay page calls a small authed
  endpoint that **updates `application_fee_amount`** on the PI to the ACH rate
  *before confirmation* (Stripe allows updating it pre-confirm), then confirms.
- Card payers keep the card fee; bank payers get the ACH rate. Clean per-method.

## Pass-through interaction
When "cover my fees" is on, the gross-up uses the **card** rate (the worse case).
If the client then pays by bank, the contractor simply **nets more** — never
short. So `grossUpForFees` needs no method-awareness. The inclusive total shown
is the card-grossed amount.

## Settlement states (ACH is async — ~4 business days, can fail)
Card is instant: `sent → paid`. ACH adds a middle state:
- `sent → processing` (ACH initiated, `payment_intent.processing` webhook)
- `processing → paid` (`payment_intent.succeeded`, days later) — THIS is when the
  free-access first-paid activation + completedJobsCount + receipt fire.
- `processing → failed` (`payment_intent.payment_failed`, e.g. R01 insufficient
  funds) — invoice flips to a payable/failed state; notify contractor.
Contractor invoice list/detail shows a "Processing" badge; "You receive" is
labeled pending until settled.

## Bank verification
Instant via Stripe Financial Connections (no microdeposit delay). Client links
their bank on the pay page and confirms in one sitting.

## Capability gate
ACH on direct charges needs the connected account's ACH capability active (like
`card_payments` today). Gate the ACH option on it; fall back to card-only if not
active. Surface in the Connect requirements sync.

## Staged build (each stage = its own PR, CC-tested)
- **Stage 1 — economics + plumbing (no client-facing change):** ACH fee helpers
  + constants in `lib/fee.js`; invoice route accepts `us_bank_account` as an
  allowed method on $500+ PIs (card fee initial); new authed
  `/api/stripe/pay/set-method-fee` endpoint that updates `application_fee_amount`
  to the ACH rate. Unit-verify the math.
- **Stage 2 — pay page:** "Pay by bank" option on eligible invoices (Financial
  Connections), calls the set-method-fee endpoint, confirms ACH.
- **Stage 3 — async settlement:** webhook `processing`/`succeeded`/`payment_failed`
  handlers; invoice `processing`/`failed` states; contractor "Processing" badge +
  pending net; failed-payment notification. Move activation/receipt to ACH success.
- **Stage 4 — capability gate + Connect explainer copy** for ACH.

## Open/default implementation choices (no decision needed unless you object)
- Activation (free-access) fires on ACH **success**, not initiation. ✔
- ACH `application_fee` also respects the $100 cap (2% of $5k = $100 anyway). ✔
- Refunds on ACH: same connected-account refund path; ACH refund settles to the
  bank. ✔
