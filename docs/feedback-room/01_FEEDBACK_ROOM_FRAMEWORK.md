# YardSync Feedback Room — Operating Framework & Triangulation Rubric

> **Purpose:** Define how the persona panel runs on a recurring basis and exactly how
> their feedback is triangulated into a profit-weighted build order. This is the
> "constitution" of the feedback room. Last updated: 2026-06-24.

---

## 1. The panel (13 personas)

Three originals + ten new, deliberately spread across verticals, language, crew size,
tech comfort, ticket size, and — most importantly for revenue — **fee sensitivity**.

| # | Persona | Vertical | Lang | Size | Ticket | Strategic lens |
|---|---|---|---|---|---|---|
| 1 | Marco | Lawn care | ES | Solo | $60 | Core target / acquisition fruit |
| 2 | Dave (skeptic) | Lawn/landscape | EN | 4 trucks, 6 emp | recurring | Established switcher / parity |
| 3 | Eager newbie | Lawn care | EN | Solo, new | low | Frictionless onboarding |
| 4 | Rosa | House cleaning | ES | Crew of 3 | $120–180 | Crew-tier demand / female crew |
| 5 | Tyrell | Pressure washing | EN | Solo | $150–700 | Social lead-gen / reviews / QR |
| 6 | Jenny | Pool service | EN | Solo+1 | $130–160/mo | **Fee-flight (high-freq recurring)** |
| 7 | Joaquín | Pest control | ES only | Solo | $90–150 | Anti-tech / hardest to acquire |
| 8 | Brittany | Cleaning/organizing | EN | 5 emp | $150–2,000 | Feature maximalist / books-first |
| 9 | Marcus | Handyman | EN | Solo | $80–900 | One-off jobs / in-person pay |
| 10 | Diego | Landscape/irrigation | Bilingual | Solo→crew | $80–6,000 | **Upsell path (crew transition)** |
| 11 | Linda | Window washing | EN | Solo PT | $90–160 | **Low-volume pricing floor** |
| 12 | Sasha | Tree service | EN | Solo+3 | $800–3,500 | **Fee-flight (high ticket)** |
| 13 | Charlie | HVAC/electrical | EN/ES | Solo+2 | recurring agreements | Recurring contracts / portal |

The bolded lenses are the ones that map straight to Jarius's stated goal: maximize
profit while keeping the member base healthy (members who actually transact, not just sign up).

## 2. Cadence (how the room runs)

1. **Trigger.** A new feature idea, a shipped change, a roadmap reprioritization, or a scheduled review.
2. **Brief.** Every persona reads `00_PRODUCT_BRIEF.md` (updated to reflect the current product) + the specific thing under review.
3. **Round.** Each persona returns the fixed output contract (Section 7 of the brief). Personas do NOT see each other's answers — independence keeps the signal honest.
4. **Triangulate.** Aggregate into the scoring rubric below. Output a ranked build order with cost-benefit.
5. **Decide.** Jay makes the final call; decisions and rationale are logged.
6. **Re-run** after any material product change or new market input.

A feature is only added to the build queue if it clears one of: (a) named must-have by ≥3 personas, (b) named churn trigger by ≥2 personas, or (c) a clear fee-GMV protection / upsell ROI hypothesis. (Inherited from `ROADMAP.md` methodology.)

## 3. The profit-weighted triangulation rubric

For each candidate feature, score four inputs:

- **D — Demand (acquisition signal).** Raw count of personas naming it a top-3 must-have (0–13). Normalized: `Dn = round(D / 13 × 5)` → 1–5.
- **C — Churn-prevention (retention signal).** Count of personas who name its absence as a churn trigger or dealbreaker (0–13), capped/normalized to 1–5.
- **R — Revenue lever (1–5).** Direct money impact. Score high when the feature **protects or expands 5.5% fee GMV** (keeps payments inside YardSync / prevents fee-flight), **unlocks a paid upsell tier**, or **directly prevents subscription churn**. Score low for pure convenience.
- **B — Build cost (1–3).** Low=1, Med=2, High=3 (halves allowed, e.g. Low–Med=1.5).

**Profit-Weighted Score:**

```
PWS = (2.0 × R) + (1.5 × C) + (1.0 × Dn) − (1.5 × B)
```

**Why these weights (profit-first, retention-second):**
- **R is weighted highest (2.0)** because the 5.5% fee on transacting members is the real engine; a feature that keeps a $3k tree-removal payment *inside* YardSync is worth more than ten low-volume signups.
- **C (1.5)** because keeping members beats acquiring them — recurring sub + compounding fee volume rewards retention. This is the "member vs non-member ratio" guardrail: don't ship acquisition bait that churns.
- **Dn (1.0)** captures top-of-funnel pull but is discounted, since easy signups who don't transact don't move revenue (and worsen the member/non-member ratio).
- **−1.5 × B** enforces ROI discipline: a High-cost feature must clear a meaningfully higher bar.

**Tiering by PWS:**
- **≥ 9.0 → BUILD NOW** (launch-gating or first post-launch sprint)
- **6.0–8.9 → NEXT** (fast-follow once the no-brainers ship)
- **3.0–5.9 → LATER** (validated but not urgent)
- **< 3.0 → PARK** (revisit on new signal)

## 4. The fee-flight overlay (special revenue guardrail)

Independent of feature scores, every round captures **fee reactions** across ticket sizes.
If high-ticket personas (Sasha, Charlie, Brittany, Jenny) consistently say they'd route
payments *around* the 5.5% fee, that is a **revenue leak more urgent than any feature** and
gets its own recommendation (e.g. per-invoice fee cap, ACH/check tier, job-type fee rules).
Protecting fee GMV is the highest-leverage profit move available and is treated as a
first-class output of every round, not a feature in the queue.

## 5. Outputs of each round

- `round-N-feedback.md` — raw per-persona responses (the honest, in-voice signal).
- `round-N-prioritization.md` — the triangulated, profit-weighted build order + fee-flight overlay + cost-benefit narrative.

These accumulate so trends are visible across rounds (a feature climbing or falling as the product changes).
