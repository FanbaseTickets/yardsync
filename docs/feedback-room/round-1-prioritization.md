# Feedback Room — Round 1 Triangulation & Profit-Weighted Build Order

> Date: 2026-06-24 · Inputs: 13 independent persona reviews (`round-1-feedback.md`) · Rubric: `01_FEEDBACK_ROOM_FRAMEWORK.md` §3.
> Goal lens (per Jarius): **maximize revenue while keeping a healthy ratio of transacting members** — i.e. don't just acquire signups, acquire members who generate 5.5% fee GMV and stay.

---

## 1. Headline finding (read this first)

**The single highest-leverage profit move is NOT a feature — it's a fee-model redesign.** Nine of thirteen
personas independently did the 5.5% math and concluded they would **route their biggest payments
outside YardSync** (check, ACH, Zelle, Stripe-direct). Because the 5.5% per-invoice fee is the actual
revenue engine, fee-flight on high-GMV contractors leaks more money than any feature could earn. The
flat 5.5% is a lawn-care-ticket fee structure colliding with high-ticket and high-frequency verticals.

**The market splits cleanly in two**, and the two halves want opposite things:

| | CORE / low-end (cheap to acquire) | HIGH-GMV / established (the profit) |
|---|---|---|
| Personas | Marco, Eager, Joaquín, Tyrell, Linda | Dave, Brittany, Jenny, Diego, Sasha, Charlie |
| Fee reaction | tolerable at low ticket | **fee-flight — would route payments out** |
| What they need | F1, F2, F5, simple onboarding, ES support | F20, F14, F9, F6, F10 + fee accommodation |
| Profit role | volume + word-of-mouth, but Linda shows a **low-volume floor that's net-unprofitable** | **where the 5.5% actually compounds — if you can keep it in-platform** |
| Risk | acquire-then-churn (worsens member ratio) | won't adopt at all without heavy features |

**Strategic implication for the member ratio:** chasing the very low end (Linda profile) at $39/mo
produces members who barely transact, carry support load, and churn — *worsening* the member/non-member
ratio. The profit-and-ratio-optimal target is the **mid-to-high-GMV transacting operator**, won by
(a) fixing fee-flight so their GMV stays in-platform and (b) shipping the recurring/quote/crew features
that gate them — while keeping the cheap core conversion-ready with low-cost wins.

---

## 2. Profit-weighted scores

`PWS = (2.0 × R) + (1.5 × C) + (1.0 × Dn) − (1.5 × B)` — R=revenue lever(1-5), C=churn-prevention count, Dn=normalized demand, B=build cost(1-3). See framework §3.

| Rank | Feature | Demand (of 13) | C (churn-save) | R (rev) | B (cost) | **PWS** | Tier |
|---|---|---|---|---|---|---|---|
| — | **P0: Fee-model redesign** (cap / ACH tier / recurring-exempt) | 9 raised it | 6 | 5 | 2 | **see §3** | **DO FIRST** |
| — | **P0: Stripe Connect onboarding fix** | 5 (top friction) | 4 | 4 | 1 | **see §3** | **DO FIRST** |
| 1 | F20 Recurring billing / contracts (auto-charge) | 6 | 4 | 5 | 2 | **15.0** | BUILD NOW |
| 2 | F14 E-sign quotes/estimates + **deposits** | 6 | 3 | 5 | 2 | **13.5** | BUILD NOW |
| 3 | F9 Crew mgmt + per-seat Crew tier | 4 | 3 | 5 | 2.5 | **12.75** | BUILD NOW |
| 4 | F5 Device pay (Apple/Google Pay) | 5 | 2 | 4 | 1 | **11.5** | BUILD NOW |
| 5 | F1 Automated SMS reminders (harden + prove) | 4 | 3 | 3 | 1 | **11.0** | BUILD NOW |
| 6 | F2 Smart Business Card + QR (finish/ship) | 3 | 2 | 4 | 1.5 | **9.75** | BUILD NOW |
| 7 | F6 QuickBooks Online sync (native 2-way) | 2 | 2 | 4 | 2 | **9.0** | NEXT |
| 8 | F11 Before/after photo auto-send | 2 | 1 | 3 | 1 | **7.0** | NEXT |
| 9 | F4 Stripe Terminal (in-person reader) | 1 | 1 | 4 | 2 | **6.5** | NEXT |
| 10 | F12 Verified reviews from invoices | 1 | 1 | 4 | 2 | **6.5** | NEXT |
| 11 | F8 Route optimization | 2 | 2 | 3 | 3 | **5.5** | LATER |
| 12 | F10 Customer self-serve portal | 2 | 2 | 3 | 3 | **5.5** | LATER |
| 13 | F17 Referral / affiliate program | 1 | 0 | 3 | 1 | **4.5** | LATER |
| 14 | F15 Year-end tax pack | 1 | 1 | 3 | 2 | **4.5** | LATER |

Tiers: BUILD NOW ≥ 9.5 · NEXT 6.0–9.4 · LATER 4.0–5.9. (F3 bulk SMS, F7 AI quoting, F13 discovery, F16 equipment, F18 margin calc, F19 native apps drew no top-3 votes this round → PARK.)

---

## 3. The two P0 pricing/funnel fixes (higher ROI than any feature)

### P0-A — Fee-model redesign (protect the engine)
**Problem:** 9/13 personas would route their highest-value payments outside YardSync. Worst at high ticket
(Sasha: every job >$1,500 leaves; $176 fee on a $3,200 removal) and high-frequency recurring (Jenny: $540/mo;
Charlie: $1,700/mo on agreement auto-charges).
**Options surfaced by the panel (cost: pricing/config + light code, days not weeks):**
- **Per-invoice fee cap** (e.g. 5.5% up to a ~$75 ceiling). Converts Sasha, softens Dave/Diego big tickets.
- **ACH / bank-transfer tier** at ~1% or flat ~$20 — keeps high-ticket payments in-platform instead of off-platform checks.
- **Recurring-agreement accommodation** — flat ~$1–2/active member/mo (Charlie) or a GMV-threshold flat rate (Jenny, Brittany, Dave) instead of 5.5% on every recurring charge.
**Cost-benefit:** A capped/tiered fee *reduces* headline take-rate per big job but **converts fee-flight $0 into real fee revenue**, because today those payments generate **nothing**. Capturing 1%–"$75 cap" on a $43k/mo tree operation beats capturing 5.5% of the jobs that never run through the platform (≈ the small ones only). This is the highest-dollar decision on the page. **Recommend: model 2–3 fee schedules against the panel's GMV profiles before any high-ticket-vertical outreach.** Note: respect the Early Adopter Lock language (Terms §6) — any new schedule should be additive/optional, not a retroactive change.

### P0-B — Stripe Connect onboarding simplification (protect conversion)
**Problem:** 5/13 (Marco, Eager, Joaquín, Linda, Diego) name the Connect bank/SSN/EIN wall as the moment they
close the tab — and these are exactly the cheap-to-acquire core. A signup that never reaches first-invoice
generates $0 sub and $0 fee.
**Fixes (low cost):** plain-language pre-step ("personal checking works, no EIN needed, here's the 4 things you'll need"), Spanish-first copy, progress framing ("you're 3 steps from your first invoice"), and a "finish later / we'll text you the link" path. **Cost-benefit:** cheap, and it lifts the conversion rate on *every* acquisition dollar — multiplies the value of all downstream features.

---

## 4. Recommended build order (profit + ratio optimized)

**Sprint 0 — Protect the money you can already make (P0, days–2 wks):**
1. P0-A fee-model: design + model cap/ACH/recurring schedules. **Gate high-ticket outreach on this.**
2. P0-B Stripe Connect onboarding polish + Spanish-first copy.
3. F1: verify/harden the SMS reminder cron end-to-end and *prove* delivery (Marco/Rosa/Joaquín/Linda all say "show me it fires"). Mostly built — this is hardening, not new build. Cheapest retention win on the board.

**Sprint 1 — Unlock the high-GMV market (the profit engine):**
4. **F20 Recurring billing/contracts** (PWS 15.0). Single biggest unlock — opens pool, HVAC, cleaning, pest, and recurring lawn. Without it, Jenny/Charlie walk and Rosa/Marco/Linda lose their top want. Pairs with the recurring-fee accommodation from P0-A.
5. **F14 E-sign quotes + deposit capture** (13.5). Gates every high-ticket vertical *and* fights fee-flight (a captured deposit is in-platform GMV). Sasha/Charlie/Dave/Brittany/Diego all gate on it.

**Sprint 2 — Convert the cheap core + start the upsell tier:**
6. **F5 Device pay** (11.5). Low cost, high payment-conversion, reduces small-ticket fee-flight (tap vs check). Wanted across both segments.
7. **F2 Smart Business Card/QR** (9.75) — finish/ship the rev3 work + add **deposit-on-intake** (Tyrell's gap). Cheap acquisition channel that feeds fee GMV.
8. **F9 Crew tier** (12.75 by score, sequenced here because it's the heaviest of the BUILD-NOW set) — begin the per-seat Crew tier. New paid tier = direct new revenue + retains the highest-LTV growing operators (Diego is a live demand signal; Rosa needs multi-cleaner; Dave needs it to drop Jobber). Ship at least a dated roadmap immediately — Diego adopts on a *date*, not a feature.

**Fast-follow (NEXT tier):**
9. F6 QuickBooks 2-way sync — unlocks the established high-GMV switchers (Dave, Brittany). Must be native API, not CSV (Brittany churns on a CSV "sync").
10. F11 before/after photos + F12 verified reviews — cheap trust/acquisition flywheel (Tyrell, Eager); F12 also seeds Phase 3.
11. F4 Stripe Terminal — captures in-person GMV currently going to Square (Marcus).

**Later / Park:** F8 route optimization, F10 portal (both High cost, narrower demand), F17 referral, F15 tax pack, and the unscored F3/F7/F13/F16/F18/F19.

---

## 5. Cost-benefit summary (the money logic)

- **Cheapest, highest-certainty revenue:** P0-B onboarding + F1 hardening + F5 device pay. Low/near-zero build, lift conversion and payment capture across the whole base. Do regardless.
- **Highest absolute upside:** F20 + F14 + the P0-A fee redesign — these together unlock the high-GMV verticals where 5.5% compounds into four-figure monthly fees per contractor, *and* stop those same contractors from routing payments out. This is where "make as much money as possible" actually lives.
- **Best new-revenue line:** F9 Crew tier — the only feature that creates a *new price point* (per-seat) rather than discounting the existing one. Protects the highest-LTV cohort (growing operators) from churning to Jobber.
- **Ratio guardrail:** resist over-investing to win the Linda (sub-$20k/yr, ~8-client) profile at $39/mo — they're net-unprofitable and churn-prone, dragging the member ratio. Either serve them with a deliberately cheaper/lighter starter tier (annual $199 / sub-$15/mo) *or* let them be word-of-mouth, not acquisition targets. Spend the acquisition energy on transacting operators.
- **Positioning debt:** "lawn-care" branding actively costs credibility with HVAC/cleaning/tree/pest (Charlie, Rosa, Marcus, Brittany). A trade-neutral client-facing experience (receipts, `/pay`, `/join`) is a low-cost change that widens the addressable, fee-generating market.

---

## 6. What to re-test next round

- Re-run the panel against a **concrete fee schedule** (cap vs ACH tier vs recurring-flat) to find the design that minimizes fee-flight while maximizing captured GMV — this is the highest-value experiment available.
- Re-run after F20 ships to confirm Jenny/Charlie/Rosa convert.
- Add a **commercial/property-management buyer** persona (the entity Diego/Dave want to win) — currently unrepresented and relevant to F14/contracts.
- Validate the low-end starter-tier hypothesis (Linda) vs. deliberately not targeting that segment.
