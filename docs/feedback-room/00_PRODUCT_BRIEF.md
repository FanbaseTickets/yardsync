# YardSync — Reviewer Brief & Product Mental Model

> **Purpose:** The shared context every persona subagent reads before reviewing.
> Also the canonical "how YardSync works, why it's useful, what its reputation is" mental model.
> Last updated: 2026-06-24 (Round 2 — reflects the DIRECT-CHARGE migration + features shipped through PR #36+).

---

## 1. What YardSync is (in one breath)

A bilingual (EN/ES) phone-first PWA that lets a field-service contractor run the whole back office
from their truck: client list, drag-to-route calendar, Stripe invoice the moment a job is done, get
paid fast, automatic bilingual SMS reminders, and a free digital business card with QR intake — no
laptop, no office, no English fluency required.

Primary audience: **Hispanic lawn-care operators in San Antonio**, expanding to 12 verticals
(lawn care, landscaping, pressure washing, pool service, cleaning, pest control, handyman, tree
service, irrigation, window washing, HVAC maintenance, recurring electrical), then Houston → Dallas → Miami → LA.

## 2. How the money works (this governs every prioritization call)

**IMPORTANT — fee model changed to DIRECT CHARGES (contractor = merchant of record):**
The contractor's connected Stripe account is the merchant of record. The customer's payment is charged
on the contractor's account; **Stripe's processing fee (~2.9% + $0.30) is paid by the contractor**, and
YardSync takes its **5.5% as a separate `application_fee_amount` on top**. So:

- **YardSync nets the FULL 5.5% of GMV** (no Stripe haircut on the platform side).
- **The contractor pays BOTH fees** → their all-in card cost is **~8.4%** (5.5% YardSync + ~2.9% Stripe). This is now shown to them in the fee breakdown.

| Stream | Detail | Margin character |
|---|---|---|
| **SaaS subscription** | $39/mo or $390/yr | recurring, predictable, retention anchor |
| **Per-invoice fee** | **5.5%** application fee, net to YardSync (contractor also pays Stripe separately) | scales with GMV; the real upside |
| **Pro Setup** | $99 one-time; YardSync imports the client list | one-time, cuts time-to-value |
| **Volume rewards** | $1,500+/mo invoiced 2 months → 50% off sub; $3,000+/mo → free sub. **5.5% always applies.** | trades sub for fee volume + lock-in |
| **Early Adopter Lock** | Accounts before Apr 15 2028 keep 5.5% for life | acquisition lever + switching-cost moat |

**Core economic truths:**
1. The **5.5% per-invoice fee is the engine** (full net now). A contractor doing $20k/mo GMV = $1,100/mo to YardSync, dwarfing the $39 sub.
2. **High-GMV contractors are the prize** — but the visible ~8.4% all-in makes **fee-flight the #1 revenue risk** (high-ticket operators routing payments to check/ACH).
3. **Low-volume contractors can be net-unprofitable** (support cost > $39 with little fee volume). The "member ratio" goal = members who *transact*, not just sign up.

## 3. What's SHIPPED today (live / in `dev`, don't re-pitch as new)

- Direct-charge Stripe invoicing with the 5.5% app fee; **contractor-branded receipts** (merchant of record); processing fee shown in the breakdown; accurate contractor-net display.
- **Automated bilingual SMS** reminders + morning summaries + **AI message drafting** (Claude, EN/ES), A2P 10DLC approved, STOP enforced, delivery status callbacks.
- **Smart Business Card** — public `/join/[slug]` QR intake page, vCard download, **downloadable QR PNG + social post/story images**, headshot + logo, contact-visibility toggles, lead alerts.
- Drag-to-route **calendar**; **reschedule a job or a whole day** with client SMS notice; collapsible cards + filter chips.
- **Clients:** per-client price override, inline package creator, biweekly package type, Active/Inactive filters, **CSV export of clients + invoice history (data ownership)**.
- **Settings** tabbed refactor (Profile · Card · SMS · Billing); volume-reward tracker.
- Subscription checkout, cancel + reactivate; **bank-connect gated on an active subscription** (closes the free-rider hole); `/pricing` page.
- **Volume rewards** (50% off / free sub) + Early Adopter lock; **Terms + Privacy consent recorded at signup**.
- A shareable **`/grow` referral card** (branded pitch + QR) — note: sharing only, **no tracked affiliate rewards yet**.
- Bilingual EN/ES throughout; admin dashboard.

## 4. What's NOT built (the candidate gaps — score these, F1–F20)

Status tags: ✅ shipped · 🟡 partial · ⬜ not built.

| ID | Feature | Status | Rough build cost |
|---|---|---|---|
| F1 | Automated SMS reminders | ✅ shipped | — |
| F2 | Smart Business Card + QR intake (+ social assets) | ✅ shipped | — |
| F3 | Bulk SMS broadcast | ⬜ | Low |
| F4 | Stripe Terminal / in-person card reader | ⬜ | Med |
| F5 | Device pay (Apple/Google Pay) on payment page | ⬜ | Low |
| F6 | QuickBooks Online sync (native 2-way) | ⬜ | Med |
| F7 | Square-footage / Maps photo quoting (AI) | ⬜ | Med–High |
| F8 | Route optimization (multi-stop ordering) | ⬜ | High |
| F9 | Crew management + per-seat Crew tier | ⬜ | Med–High |
| F10 | Customer self-serve portal | ⬜ | High |
| F11 | Before/after job photo auto-send | ⬜ (headshot/logo done) | Low |
| F12 | Verified reviews from paid invoices | ⬜ Phase 3 | Med |
| F13 | Contractor discovery / visibility engine | ⬜ Phase 3 | High |
| F14 | Recurring quotes / estimates + e-signature + **deposits** | ⬜ | Med |
| F15 | Year-end tax pack | ⬜ (CSV export shipped) | Med |
| F16 | Equipment maintenance tracking | ⬜ | Low |
| F17 | Referral / affiliate program (tracked rewards) | 🟡 share card only | Low |
| F18 | Full material cost calculator (margin/job) | 🟡 partial | Med |
| F19 | Native iOS/Android apps (push + offline) | ⬜ | High |
| F20 | **Recurring billing / contracts (auto-charge saved card on schedule)** | ⬜ | Med |

## 5. Current reputation / image (honest read)

- **Stage:** Live on `yardsyncapp.com`, live Stripe keys, **pre-first-paying-customer.** Marco is a dogfood account.
- **Strengths:** genuinely bilingual; A2P compliance handled; clean dual-fee pricing with contractor-branded receipts; data-ownership (CSV export); ships fast and hardens aggressively; already iterating on persona feedback.
- **Risks:** solo-founder vendor risk; visible ~8.4% all-in invites fee-flight on big tickets; no recurring-billing / quotes / crew / QuickBooks / portal yet; no social proof / reviews yet; "lawn-care" branding strains credibility with non-lawn trades.
- **Positioning to protect:** "the no-brainer for the operator the big tools ignore" — Spanish-first, phone-first, cash-flow-first. Don't drift into feature-for-feature war with Jobber for the $400k Anglo shop.

## 6. What we want OUT of each persona (output contract)

Return exactly this so results triangulate:

1. **VERDICT** — 1–2 sentences in voice (Adopt / Conditional / Walk away).
2. **PAY?** — Adopt now / Conditional (name the condition) / Walk away (name the dealbreaker).
3. **WHAT'S NOW THERE** — one line on whether anything newly shipped (CSV export, reschedule, QR/social assets, per-client pricing, contractor-branded receipts, free-rider gate) changes your view vs. before.
4. **FEE REACTION** — honest reaction to the **~8.4% all-in** (your 5.5% + Stripe ~2.9%, now visible) at *your* ticket size/volume. Surface fee-flight.
5. **TOP 3 MUST-HAVES** — from F1–F20 (write-ins ok). One line each on why it changes your decision.
6. **TOP FRICTION** — the single moment you'd hesitate or churn.
7. **CHURN TRIGGER** — what would make you cancel after signing up.
8. **ONE-LINE QUOTE.**
