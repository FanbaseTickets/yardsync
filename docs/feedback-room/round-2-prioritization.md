# Feedback Room — Round 2 Triangulation & Profit-Weighted Build Order

> Date: 2026-06-24 · Inputs: `round-2-feedback.md` (current build) · Rubric: `01_FEEDBACK_ROOM_FRAMEWORK.md` §3.
> Fee model corrected: DIRECT charges → YardSync nets full 5.5%; contractor all-in ~8.4% and now VISIBLE.

---

## 1. What changed vs Round 1

- **F14 (quotes + deposits) jumped from #6 to #1** — now named by **11 of 13** personas. Making the 8.4% visible made everyone want to collect deposits (anti-ghost) and send signed estimates. Deposits also = captured in-platform GMV (anti-fee-flight).
- **Fee-flight got worse and more specific.** With ~8.4% visible, high-ticket personas set explicit flight points and asked for concrete fixes. This elevated a cheap new cluster to the top: **pass-fee-to-client toggle + per-invoice cap + ACH tier**.
- Shipped features (CSV export, branded receipts, QR/social card, reschedule, per-client pricing) **warmed the core** (Marco, Eager, Diego, Joaquín moved more positive) but **did not convert the high-GMV segment** — their gates (F20, F14, F6, fee cap) are still unbuilt.

## 2. Profit-weighted scores (Round 2)

`PWS = (2.0 × R) + (1.5 × C) + (1.0 × Dn) − (1.5 × B)`  (R=revenue lever 1-5, C=churn-prevention, Dn=normalized demand, B=build cost 1-3).

| Rank | Item | Demand (of 13) | C | R | B | **PWS** | Tier |
|---|---|---|---|---|---|---|---|
| 1 | **F14 — Quotes/estimates + e-sign + DEPOSITS** | 11 | 5 | 5 | 2 | **18.5** | BUILD NOW |
| 2 | **F20 — Recurring auto-billing / contracts** | 8 | 5 | 5 | 2 | **17.5** | BUILD NOW |
| — | **P0: Fee cap / ACH low-fee tier** | 6 raised | 5 | 5 | 1.5 | **17.25** | DO FIRST (cheap) |
| — | **P0: "Pass fee to client" surcharge toggle** | 3 named, many implied | 5 | 5 | 1 | **17.0** | DO FIRST (cheapest) |
| — | **P0: Stripe Connect onboarding explainer** | 2 friction | 3 | 4 | 1 | **~12** | DO FIRST (cheap) |
| 3 | F9 — Crew mgmt + per-seat Crew tier | 2 | 3 | 5 | 2.5 | **11.75** | NEXT |
| 4 | F5 — Device pay (Apple/Google Pay) | 4 | 2 | 4 | 1 | **11.5** | NEXT (cheap) |
| 5 | F6 — QuickBooks Online sync (native) | 4 | 3 | 4 | 2 | **11.5** | NEXT |
| 6 | F11 — Before/after job photos | 2 | 1 | 3 | 1 | **7.0** | NEXT (cheap) |
| 7 | F4 — Stripe Terminal (in-person) | 1 | 1 | 4 | 2 | **6.5** | LATER |
| 8 | F12 — Verified reviews from invoices | 1 | 1 | 4 | 2 | **6.5** | LATER |
| 9 | F8 — Route optimization | 2 | 2 | 3 | 3 | **5.5** | LATER |
| 10 | F10 — Customer self-serve portal | 2 | 2 | 3 | 3 | **5.5** | LATER |
| 11 | Lite/starter tier (<$20/mo) | 1 | 1 | 2 | 1 | **4.0** | PARK (ratio-negative) |

## 3. The P0 cluster — cheapest money on the board (do before features)

Making the ~8.4% all-in visible turned fee pain into the dominant theme. Three cheap moves protect the engine:

1. **"Pass fee to client" surcharge toggle (B=Low).** Let the contractor add YardSync's 5.5% (or the full 8.4%) to the customer's invoice as a line item. This converts the fee from contractor pain into a customer charge — contractors stop routing payments out, and **you keep your full 5.5%**. Marco asked by name; every fee-flight persona is implicitly solved by it. *Caveat:* card surcharging has Stripe/state rules (no surcharge on debit; some states cap/forbid) — frame as a "service/convenience fee," verify compliance.
2. **Per-invoice fee cap or low-fee ACH tier (B=Low–Med).** Sasha: $75 cap or ACH 0.8%/$15 max. Brittany: $300/mo above $15k. Charlie: flat $1.50–2 per recurring member. Capturing a capped fee on jobs that *run through you* beats 5.5% of the high-ticket jobs that **flee to check** (which earn you $0).
3. **Stripe Connect onboarding explainer (B=Low).** Plain-language + Spanish pre-step ("personal checking works, no EIN, this is Stripe"). Lifts signup→first-invoice conversion across the cheap core (Eager, Joaquín, Linda, Diego all named it).

These are days of work, not weeks, and they defend revenue you already have. **Note:** keep additive/optional to respect the Early Adopter 5.5% lock (Terms §6).

## 4. The two BUILD-NOW features (the unlock)

- **F14 quotes + deposits (PWS 18.5).** Now the single most-demanded thing. Gates high-ticket verticals (tree, HVAC, landscaping installs, organizing) AND wanted by the solo core to stop ghosting. Deposits = captured GMV.
- **F20 recurring auto-billing (PWS 17.5).** Still the hard gate for the entire recurring half (pool, HVAC, cleaning, pest, recurring lawn). Pair with the recurring-fee accommodation from P0.

## 5. Build order (profit + member-ratio optimized)

**Sprint 0 (days):** Pass-fee-to-client toggle · fee cap/ACH tier · Stripe Connect onboarding explainer · confirm F1 SMS fires (Linda/Joaquín want proof). Cheapest wins; defend the fee engine.
**Sprint 1:** F14 quotes + deposits + e-sign. → unlocks high-ticket + stops ghosting.
**Sprint 2:** F20 recurring auto-billing (+ per-member fee option). → unlocks recurring verticals.
**Sprint 3:** F5 device pay (cheap, conversion) · begin F9 Crew tier with a **published ship quarter** (Diego/Rosa adopt on a date) · F11 before/after photos (cheap, feeds reviews).
**Fast-follow:** F6 QuickBooks native sync (Dave/Brittany/Jenny) · F12 reviews · F4 Terminal.
**Later/Park:** F8 route, F10 portal (High cost, narrow), lite tier.

## 6. Cost-benefit one-liners

- **Cheapest, highest-certainty:** the P0 fee cluster + F5 — low build, protect/expand fee GMV and conversion. Do regardless.
- **Highest absolute upside:** F14 + F20 — unlock the high-GMV verticals where 5.5% compounds into 4-figure monthly fees per contractor.
- **Best new revenue line:** F9 Crew tier — the only feature that adds a NEW price point.
- **Member-ratio guardrail:** do not chase the Linda (<$20k/yr) profile at $39/mo — net-unprofitable and churn-prone. Lite tier scores lowest (4.0) for a reason.
- **Positioning debt:** keep "YardSync" out of the client-facing flow (Charlie) — trade-neutral receipts widen the fee-generating market cheaply.

## 7. Next round to run

- Re-test against a **live fee schedule** (pass-through toggle vs $75 cap vs ACH tier) to find the design that minimizes fee-flight while maximizing captured GMV.
- Re-run after F14 + F20 ship to confirm Sasha/Jenny/Charlie/Dave convert.
- Add a **commercial / property-management buyer** persona (Diego/Dave's target; gates F14/contracts).
