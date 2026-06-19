# YardSync Product Backlog

**How this document works:**
This is a living product backlog. All items are candidates for development, not commitments. Before each sprint or build session, items are rated on two dimensions:

- **Profitability score (1-5):** How directly does this feature drive revenue or reduce churn?
- **Sales score (1-5):** How compelling is this as a reason for a new contractor to sign up?

Items with the highest combined scores get built first. The backlog is updated after every customer conversation, support request, or new market insight.

**Current status:** MVP live on yardsyncapp.com
**Next review:** After first 10 paying contractors

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

### Prioritized Build Queue

| Priority | Feature | Profitability | Sales | Total |
|---|---|---|---|---|
| 1 | Automated daily SMS reminders | 5 | 5 | 10 |
| 2 | Smart Business Card + QR Intake | 4 | 5 | 9 |
| 3 | Bulk SMS broadcast | 4 | 4 | 8 |
| 4 | Admin dashboard Stripe visibility | 3 | 1 | 4 |
| 5 | Stripe Terminal / card reader | 3 | 4 | 7 |
| 6 | Device pay — Apple/Google Pay | 3 | 4 | 7 |
| 7 | Expired card on reactivation | 2 | 1 | 3 |
| 8 | QuickBooks integration | 3 | 4 | 7 |
| 9 | Square footage / Maps quoting | 3 | 5 | 8 |
| 10 | Volume reward manual override | 2 | 1 | 3 |

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

### YardSync Smart Business Card + QR Client Intake

**Overview**
Each contractor gets a shareable public intake page at `yardsyncapp.com/join/[slug]` that doubles as a digital business card. Prospective clients land on the page via QR code (printed card, yard sign, social post), fill out a quick intake form, and get added directly to the contractor's Firestore `clients` collection — no "text me your info" friction. Combined with a printable PDF business card, this gives every contractor a polished, low-friction acquisition channel from day one.

**Technical Components**
- Public `/join/[slug]` route — no auth, server-rendered
- QR code generation per contractor (URL points to their `/join/[slug]`)
- Printable business card PDF (logo, name, photo, QR code, contact)
- Client intake form (name / phone / address / service interest / preferred language)
- On submit: writes new client doc to Firestore + SMS-notifies the contractor of the new lead
- Personal headshot/photo upload (separate from business logo — stored in Firebase Storage at `users/{uid}/photo.jpg`)
- Photo displayed on `/join/[slug]` intake page alongside business logo for a personal, trustworthy first impression
- Photo also appears on business card PDF
- Same upload pattern as logo — Settings page, 2MB max, PNG/JPG/WebP

### Social & Future Connections
- The `/join/[slug]` page doubles as a shareable profile link for social media posts
- Contractor can share `yardsyncapp.com/join/[slug]` directly in Facebook groups, Nextdoor, neighborhood apps — link shows their photo, logo, services, and intake form
- Future: verified reviews from paid invoices display on this same page (Phase 3 — Community & Visibility Platform)
- Future: Google Business Profile link
- Future: "Book a cleanup" direct CTA tied to contractor's calendar availability

### Why Personal Photo Matters
- Lawn care is a trust business — clients want to know who is coming to their home
- A face + logo + business name on the intake page converts significantly better than a generic form
- Same photo on the business card PDF makes the card feel premium and personal
- Bilingual caption option: "Hi, I'm [name] from [business]" / "Hola, soy [name] de [business]"

### Crew Tier — Team Photo Hierarchy

> **STATUS — DEFERRED (wait for demand signal).** The Crew Tier subscription does
> not exist today. YardSync's current pricing is a single $39/mo or $390/yr
> tier per contractor; there is no team management, no member invitations, no
> per-seat pricing. Build this feature only when 1-2 paying contractors
> explicitly request team management for their crew. Until then, the Smart
> Business Card MVP (Phases A + B above) targets solo operators exclusively.

For contractors on a future Crew plan, the profile and business card system would expand to a full team structure:

**Visual hierarchy:**
- Business logo (top level — the brand)
- Owner headshot (second level — the face)
- Crew member photos (nested — the team)

**How it would work:**
- Owner uploads business logo + personal photo
- Owner invites crew members via email or phone
- Each crew member uploads their own headshot
- The `/join/[slug]` intake page shows the full team: logo, owner photo, crew grid
- Business card PDF shows owner photo + "and my team of X" with crew thumbnails
- Each crew member gets their own sub-profile visible on the team page

**Why this matters for sales (when it lands):**
- A solo operator looks professional
- A crew operator looks like a business
- Clients booking recurring service want to know exactly who will be at their home
- Team visibility builds trust and reduces cancellations ("I know these people")
- Differentiates YardSync from every other lawn care app — none show the team

**Backlog scores (when demand signal arrives):**
- Profitability: 5 (unlocks Crew tier upgrades)
- Sales: 5 (strongest visual differentiator)
- Total: 10

**Dependencies (none of which exist today — all greenfield when Crew ships):**
- Crew tier Stripe product + price IDs (NEW — does not exist yet)
- Crew member invitation system (NEW)
- Sub-profile pages per crew member (NEW)
- Personal photo upload on user doc (delivered as part of Smart Business Card Phase B, solo-scope)
- Nested photo storage in Firebase Storage:
  - `users/{uid}/photo.jpg` (owner) — delivered with Phase B
  - `businesses/{businessId}/crew/{memberId}/photo.jpg` (team) — NEW

**Data architecture forward-compat (already designed into Phase A+B):**

So that Crew Tier doesn't require a destructive migration later, Phase A+B's data model follows these principles:
- `publicSlug` is a query key, not a foreign key. The `/join/[slug]` route does `query users where publicSlug == :slug → resolve owner uid → render their profile`. When Crew ships, a `businesses/{id}` doc is added with its own `slug`; `/join/[slug]` queries businesses first, falls back to users. No client-data migration needed.
- Clients/invoices/schedules continue to be keyed on `gardenerUid` (the owner's uid). When Crew ships, `gardenerUid` becomes the business owner's uid; new field `businessId` can be added with the same value as `gardenerUid` for legacy docs.
- The user→business relationship is many-to-many in the future model: a user can own one business AND be a member of another. Their existing client data stays keyed to their own uid; they get access to additional businesses' data via membership.

**Three future-scenario coverage (validates the design above):**

| Scenario | How it works |
|---|---|
| Solo grows into crew | Owner's uid stays; they create a business doc, invite members. Existing clients/invoices unchanged (still keyed to owner's uid, which becomes the business's `ownerUid`). |
| Contractor with existing business joins another crew | They keep their own user doc + existing clients (their own business). They also become a member of the joining business. User is a member of N businesses, but each business's data is keyed to that business's owner uid. |
| Crew dissolves | Each member is still a valid user. Owner's data stays with owner. Members keep their own data (if they had any). |

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

2. **Verified Review System + Reward Visibility**

   **How reviews are collected:**

   After a paid invoice is marked complete, the system automatically sends a follow-up SMS to the client after a set delay (default 24 hours — configurable by contractor):

   - EN: "Hi [name]! How did [business] do? Tap here to leave a quick review: `yardsyncapp.com/review/[invoiceId]`"
   - ES: "¡Hola [name]! ¿Cómo le fue con [business]? Deje una reseña rápida aquí: `yardsyncapp.com/review/[invoiceId]`"

   **The review page (`/review/[invoiceId]`):**
   - Public, no login required
   - Shows contractor name, photo, business logo
   - Star rating (1-5) — tap to select
   - Optional written review (3-5 sentences max)
   - Single submit — no account creation required
   - Bilingual (EN/ES auto-detected from client's SMS language preference)
   - Confirms: "Thank you! Your review helps [business] grow."

   **Review storage:**
   - Written to `reviews/{reviewId}` in Firestore
   - Linked to: `contractorUid`, `clientId`, `invoiceId`
   - Verified flag: `true` (tied to real paid invoice)
   - Displayed on contractor's `/join/[slug]` page
   - Aggregated into star rating average

   **Review threshold reward system** (mirrors volume reward model):

   | Reviews | Reward |
   |---|---|
   | 10+ verified reviews | "Top Rated" badge on profile |
   | 25+ verified reviews | Featured in YardSync SA Newsletter |
   | 50+ verified reviews | Monthly spotlight on YardSync Facebook page |
   | 100+ verified reviews | Permanent "YardSync Elite" status + featured quarterly |

   **Facebook visibility reward:**
   - YardSync manages the Facebook page
   - Contractors who hit the 50-review threshold earn a spotlight post featuring:
     - Their photo + business logo
     - Star rating and review count
     - Service area and specialty
     - Link to their `/join/[slug]` page
     - Direct call to action for new clients
   - Post is geo-targeted to their city/neighborhood
   - Contractor is notified via SMS when their spotlight goes live
   - This is earned visibility — not paid ads (differentiates from Yelp/Google model)

   **Why this works:**
   - Reviews tied to real invoices = unbeatable trust signal
   - Automated follow-up = zero effort for the contractor
   - Threshold reward = gamification that drives contractor loyalty and retention
   - Facebook spotlight = YardSync becomes a growth engine, not just a tool
   - Each spotlight post markets YardSync to new contractors who see it

   **Backlog scores:**
   - Profitability: 5 (retention + upsell driver)
   - Sales: 5 (strongest growth mechanic)
   - Total: 10

   **Technical components:**
   - Cron job: daily check for paid invoices where `reviewSent: false` and 24hrs elapsed
   - SMS send via Twilio to client phone
   - Public `/review/[invoiceId]` page (no auth)
   - Firestore `reviews` collection
   - Review count aggregation per contractor
   - Badge display on `/join/[slug]` profile page
   - Admin dashboard: Facebook spotlight queue showing contractors who hit 50 reviews
   - Notification to contractor when spotlight is scheduled

   **Dependencies:**
   - Invoice paid webhook (exists)
   - Twilio SMS (exists)
   - `/join/[slug]` profile page (Phase 2)
   - YardSync Facebook page (manual — Jay manages)
   - Admin dashboard (Phase 2 cleanup item)

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
