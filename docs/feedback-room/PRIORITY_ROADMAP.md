# YardSync — Current Priority Roadmap (for Claude Code / dev assistant)

> Source: Feedback Room round 2 (2026-06-24). Order = profit-weighted; rationale + scores in `round-2-prioritization.md`.
> Purpose: tell the dev assistant what's already built (don't rebuild) and the exact next items, in order.

---

## ALREADY SHIPPED — do NOT rebuild

- **Payments:** Stripe **direct charges** (contractor = merchant of record), 5.5% application fee, contractor-branded receipts, Stripe processing fee shown in the breakdown, accurate contractor-net display.
- **SMS:** automated reminders + morning summaries + AI bilingual drafting (Claude EN/ES), A2P 10DLC approved, server-side STOP enforcement, Twilio status callbacks.
- **Smart Business Card:** public `/join/[slug]` QR intake, vCard, downloadable QR PNG, social post/story images, headshot + logo, contact-visibility toggles, lead alerts.
- **Calendar:** drag-to-route, reschedule a job or whole day w/ client SMS notice, filter chips. **Recurring VISIT scheduling + cadence tracking** (weekly / biweekly / 3x_month / monthly / quarterly / annual) and no-double-charge on the recurring base.
- **Clients:** per-client price override, inline package creator, biweekly package type, Active/Inactive filters, **CSV export of clients + invoice history**.
- **Account:** Settings tabs (Profile · Card · SMS · Billing), volume rewards + tracker, subscription cancel/reactivate, bank-connect gated on active subscription (free-rider gate), `/pricing`, `/grow` referral card (share only), Terms/Privacy consent at signup.

### Important nuance for the assistant
Recurring **billing is NOT automatic yet.** The app tracks the package cadence and schedules visits, but a human still pushes each invoice. The old `cron/billing` (`off_session` charge) is **disabled** and used the Firebase client SDK. F20 below = wiring the existing cadence + card-on-file to real auto-charge.

---

## NEXT — in priority order

### P0 — Fee strategy (cheap; protects the 5.5% revenue engine)
Why: contractor all-in is now ~8.4% and visible → high-ticket operators flee to check/ACH. These are days of work and defend revenue you already have.
- **Pass-the-fee option.** Ship the **price-baked** form first (contractor sets a fee-inclusive price; no surcharge rules apply). Treat a **visible surcharge line as a separate, later variant** that needs legal review (card-network cap ~3%, credit-only, disclosure, network registration, state rules).
- **Per-invoice fee cap** — configurable ceiling (e.g. $75) so a big invoice doesn't generate a fee that drives the contractor off-platform.
- **ACH / bank-transfer payment option** at a lower fee tier (cheap rail for big tickets).
- **Stripe Connect onboarding explainer** (EN/ES): "personal checking works, no EIN needed, this is Stripe." Reduce signup→first-invoice drop-off.
- Keep all of this **additive/optional** to respect the Early Adopter 5.5% lock (Terms §6).

### P1 — F14 Quotes / estimates + e-signature + deposits
Send an itemized estimate → client approves/e-signs → collect a deposit (% or $) **before** work starts. For high-ticket one-time jobs (electrical installs, tree removal, landscape installs, deep cleans). Deposit captured in-platform = GMV + doubles as chargeback evidence. Named by 11/13 personas.

### P2 — F20 Recurring auto-billing
Wire the existing cadence (weekly/biweekly/monthly/quarterly/annual) + card-on-file (`setup-intent`) → **automatic off-session charge on schedule**, with failed-card retry, renewal notice, and receipt. Re-enable/replace the disabled `cron/billing` using **`firestoreRest`** (not the client SDK). Add an optional **flat per-active-member fee** path for recurring agreements (HVAC/pool/pest), as an alternative to 5.5% on every recurring charge.

### P3 — F9 Crew tier (per-seat) — publish a ship quarter now
Invite crew members, assign jobs/stops per worker (bilingual), basic hours for 1099 prep. Adds a NEW per-seat price point. Diego/Rosa adopt on a *date*, so publish the quarter even before building.

### P4 — F5 device pay + F4 in-person
Apple/Google Pay on `/pay/[paymentIntentId]`; then Stripe Terminal for card-present walk-in jobs.

---

## BUNDLE WITH PAYMENTS WORK — chargeback protection
- Delayed/rolling payout schedule + reserves on new and high-ticket accounts (instant payout only for seasoned, low-risk accounts).
- Dispute-evidence tooling: attach the signed quote (F14) + before/after photos to the payment for dispute defense.

---

## LOWER PRIORITY / PARK (not next)
F6 QuickBooks Online sync (native 2-way) · F11 before/after job photos · F12 verified reviews · F8 route optimization · F10 customer self-serve portal · F18 full margin calculator · F17 tracked referral rewards · lite/starter tier (ratio-negative — net-unprofitable low-volume segment).
