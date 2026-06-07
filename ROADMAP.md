# YardSync Roadmap

> Living document. Last meaningful update: 2026-06-07.
> Phase 2 sections marked `[TBD: market-research]` are placeholders to be filled by the `market-research` subagent. Persona-feedback sections are placeholders to be filled by `persona-marco`, `persona-established-skeptic`, and `persona-newbie-eager` dogfooding the live app.

---

## Phase 1 — MVP Launch (current)

**Goal:** Get Marco (first customer) onto live keys with a complete, compliant, working stack.

### Done

- AI-powered SMS message drafting (Claude Sonnet 4.6) + 5-sample eval suite
- Public `/sms-opt-in` consent form (A2P-reviewer accessible, server-rendered, no auth)
- A2P STOP language across EN + ES templates, AI draft system prompt, landing demos
- Twilio Messaging Service SID migration (all 6 send sites: manual, AI, cron daily, cron summary, cron fee reminder, cron billing, webhook Pro Setup alert)
- A2P 10DLC campaign **APPROVED** (verified 2026-05-24)
- Stripe Connect Express embedded onboarding
- Invoice flow with 5.5% application fee (destination charges)
- Webhook handlers (subscription + invoice + payment_intent, all idempotent)
- Subscription cancel + reactivate
- Pro Setup ($99) add-on with admin SMS + email alerts
- Volume Rewards (50% off sub at $1500/mo for 2mo, free sub at $3000/mo)
- Bilingual EN/ES UI + SMS templates
- `yardsyncapp.com` custom domain on Vercel
- Twilio status-callback webhook backlogged for accurate delivery indicator before heavy volume

### Open (gates the live-key flip)

- [ ] **Pro Setup E2E test** — Scenario A in Stripe test mode (signup → checkout with Pro Setup → admin SMS + email + dashboard widget + Firestore `setupFeePaid: true`)
- [ ] **Paid invoice smoke test** — verify `stripeProcessingFee` + `netToPlatform` persist on invoice doc, 5.5% application fee transfers to platform balance
- [ ] **Email-only client invoice smoke** — Connect-complete contractor + email-only client → verify email-only path works, no SMS attempt logged
- [ ] **Full QA pass per QA_PHASE5_CHECKLIST.md** (if file exists; create if not)
- [ ] Replace Stripe `sk_test_*` → `sk_live_*` in Vercel env
- [ ] Replace Stripe `pk_test_*` → `pk_live_*` in Vercel env
- [ ] Set `TWILIO_MESSAGING_SERVICE_SID` on Vercel (Production + Preview + Development)
- [ ] Trigger a fresh deploy after the Twilio SID env var is set
- [ ] **Onboard Marco** (first customer canary)

### Backlog (not gating, do after Marco is live)

- [ ] Re-run AI draft 5-sample eval with the new STOP rule (expect 170-200 char outputs; structural checks should pass)
- [ ] Add `Reply STOP to opt out. – YardSync` presence assertion to the AI eval
- [ ] Twilio status-callback webhook (queued/sent/delivered/failed) — required before heavy SMS volume so the "SMS sent ✓" toast reflects reality
- [ ] LangContext → Firestore sync for `preferredLanguage` (so ES users actually get ES notifications by default)
- [ ] Admin dashboard overhaul PR 3 (CSV rebuild + email digest queue + mobile handling)
- [ ] Sweep dead Square code (`app/api/square/**` routes + `square` dep in `package.json`)
- [ ] `lib/firestoreRest.js:22` — remove `admin@fanbasetickets.net` silent fallback, fail loudly
- [ ] Remove dead `firebase-admin` dependency from `package.json`
- [ ] Clean up 4 orphan user docs (UTSA, testuser, johnsonjarius19, johnsoncandace009)

---

## Phase 2 — Post-Launch Growth (next 3-6 months)

**Goal:** Take YardSync from "works for Marco" to "10+ paying contractors with healthy retention".

### From documented customer pain
*[TBD: run `market-research` agent against Reddit r/lawncare + lawnsite.com + Facebook lawn care groups. Capture top pain points by frequency, with operator quotes and source URLs.]*

### From competitor analysis (Jobber, LawnPro, Service Autopilot, LMN, Yardbook)
*[TBD: run `market-research` agent. Output competitive feature matrix + pricing intel + named gaps to exploit.]*

### From persona feedback
*[TBD: run `persona-marco`, `persona-established-skeptic`, `persona-newbie-eager` agents against the live app. Capture top friction moments per persona and the moment each would either commit or close the tab.]*

### Hypothesis backlog (Jay's gut — to be validated by research above)

These are unvalidated. Treat as candidates pending market signal.

| Feature | Why it might matter | Implementation cost guess |
|---|---|---|
| Route optimization | Multi-stop ordering for daily schedule. QoL win for any contractor with 8+ stops/day. | High (mapping API + algorithm) |
| Crew management | Assign jobs to workers, simple timesheets, basic 1099 prep | Medium |
| AI quote generator | Photo of yard → AI estimates sq ft → suggests pricing | Medium (vision model + pricing logic) |
| Customer self-serve portal | Clients view upcoming visits, reschedule, pay outstanding invoices | High (new auth surface) |
| Photo before/after | Auto-send to client after job, builds trust | Low |
| Review requests | Auto-SMS after job: "rate your visit" → Google review push for 5-stars | Low |
| QuickBooks Online sync | Every contractor >$80k revenue uses QB; native sync removes manual export | Medium (QB OAuth + schema mapping) |
| Material cost calculator (full) | Currently partial; expand to track wholesale prices, profit margin per job | Medium |
| Mobile-native iOS/Android apps | Currently PWA; native for push notifications + offline mode | High |
| Equipment maintenance tracking | Mower service reminders, tied to hours-of-use | Low |
| Year-end tax pack | Auto-generated income summary + expense categorization for filing | Medium |
| Referral link / affiliate program | Contractors invite contractors; revenue share | Low |

---

## Phase 3 — YardSync Community & Visibility Platform
*Runs in parallel with Phase 2 post-launch growth*

### Overview
A YardSync-owned Facebook presence and contractor discovery platform that drives client acquisition for contractors — making YardSync valuable not just for managing work, but for getting more work.

### Core Features (in build order)

1. **YardSync Facebook Page**
   - Managed from yardsyncapp.com brand
   - Contractor spotlight posts by city/neighborhood
   - Service-specific promotion (lawn care, landscaping, pressure washing, etc.)
   - Real verified reviews sourced from completed YardSync invoices

2. **Verified Review System**
   - Reviews auto-generated from completed + paid invoices (client opts in at payment)
   - Tied to real transaction — not self-reported
   - Displayed on contractor's YardSync profile and Facebook page
   - Star rating + written review option for client at payment confirmation screen

3. **Location-Based Contractor Discovery**
   - Contractors searchable by ZIP code and service type
   - Public-facing contractor profile pages at `yardsyncapp.com/contractor/[slug]`
   - Embedded map showing service area

4. **AI-Powered Visibility Engine** *(future)*
   - Contractors who hit volume thresholds automatically get promoted
   - AI determines optimal posting time, neighborhood targeting, and service category for each contractor
   - Higher invoice volume = more visibility (aligns with volume reward model)

5. **Visibility Tiers** *(monetization)*
   - Base: included with YardSync subscription
   - Boosted: paid add-on for priority placement
   - Featured: premium neighborhood spotlight

### Strategic Notes
- Inspired by Black-Owned Market Movement model — community-sourced visibility that actually drives revenue for small operators
- Verified invoice-backed reviews are a stronger trust signal than any other review platform
- Creates a flywheel: more clients → more invoices → more reviews → more visibility → more clients
- Bilingual posts (EN/ES) align with YardSync's core differentiator for Spanish-speaking operators

### Dependencies
- Contractor public profile pages (build first)
- Client-facing payment confirmation screen (already partially built in `/pay/[id]`)
- Facebook Business API for automated posting
- Review collection flow at invoice payment

---

## Phase 4 — Scale & Partnerships (6-18 months)

**Goal:** Move beyond direct sales into channels and verticals.

### Hypotheses

- **White-label option** — larger franchises run YardSync under their brand
- **Geographic expansion** — Houston, Dallas, Miami, LA (per CLAUDE.md target markets)
- **Vendor integrations** — equipment dealers, material wholesalers (referral revenue)
- **Local SEO automation** — auto-update Google Business Profile, generate location pages
- **Insurance partnership** — connect contractors to liability insurance providers
- **Capital partnership** — equipment financing for established users (revenue share)
- **Industry vertical expansion** — adapt the platform for HVAC, pool service, pest control (same SMB ops shape)

---

## Methodology

This roadmap is updated by:

- **`market-research` agent** — pulls real signal from forums + reviews + competitor sites
- **Persona agents** (`persona-marco`, `persona-established-skeptic`, `persona-newbie-eager`) — pressure-test features against actual customer archetypes
- **Jay's roadmap calls** — final prioritization based on revenue impact + strategic fit

Phase 2 line items should not be added without one of:

- A real customer pain quote from forums/reviews
- A measurable competitor gap
- A clear ROI hypothesis tied to specific personas
