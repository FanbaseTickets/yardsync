# YardSync Knowledge Base

> **Purpose:** Complete institutional memory for the YardSync project.
> Read this file once at the start of a session to be fully briefed.
> Updated: 2026-04-21 (end of session).
>
> **For Claude:** When the user says "get up to speed" or "read the knowledge base",
> read this file. Do NOT re-explore the codebase — this file IS the exploration.
> After any major session, update this file with what changed.

---

## 1. Project Identity

**YardSync** — Bilingual (EN/ES) PWA for lawn care / field service contractors.
**Owner:** Jay Johnson, JNew Technologies, LLC (San Antonio, TX).
**Domain:** yardsyncapp.com (client-facing) + yardsync.vercel.app (admin/dev).
**Repo:** github.com/FanbaseTickets/yardsync (the GitHub org is "FanbaseTickets" — a legacy name from Jay's other project, not a mistake).
**Admin Firebase account:** admin@fanbasetickets.net
**Customer-facing email:** support@yardsyncapp.com

---

## 2. Business Model

| Revenue Stream | Details |
|---|---|
| SaaS subscription | $39/mo or $390/yr, billed via Stripe Checkout |
| Per-invoice fee | 5.5% application fee on every invoice, deducted at payment time via Stripe Connect destination charges |
| Pro Setup | $99 one-time add-on at signup — YardSync imports the contractor's client list manually |
| Volume rewards | $1,500+/mo invoiced for 2 consecutive months → 50% off subscription; $3,000+/mo → free subscription. The 5.5% fee always applies regardless of tier. |
| Early Adopter Lock | Accounts created before April 15, 2028 lock in 5.5% for life. Forfeited if: cancel >60 days, payment lapse >30 days, or downgrade. |

**Target market:** Hispanic lawn care operators. Geographic rollout: San Antonio → Houston → Dallas → Miami → LA.
**First customer:** Marco (Jay's personal gardener).

**Key business rule:** The 5.5% per-invoice fee is non-negotiable and always applies. The subscription fee is what gets discounted/waived via volume rewards. Marketing copy must never imply the platform is "free" without clarifying the per-invoice fee.

---

## 3. Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15.3 (App Router), JavaScript only — no TypeScript |
| UI | Tailwind CSS, DM Sans + DM Serif Display fonts, lucide-react icons |
| Auth | Firebase Auth (client SDK only) |
| Database | Firebase Firestore (client SDK for reads, REST API for server writes) |
| Payments | Stripe Connect (Express), Stripe Checkout, Stripe webhooks |
| SMS | Twilio (A2P registered) |
| Email | SendGrid (@sendgrid/mail v8.1.6) |
| Hosting | Vercel (auto-deploy from main branch) |
| State | React useState/useEffect, no Redux/Zustand |

**Notable package.json artifacts:**
- `firebase-admin` is listed but CANNOT be used (org policy blocks it — see Section 5)
- `square` is listed but all Square functionality was removed April 2026. Routes exist as dead code.

---

## 4. Architecture Overview

### App Structure
```
app/
  (landing)/page.js          — Marketing landing page (NO Firebase imports)
  admin/dashboard/page.js    — Admin dashboard (dark mode, Pro Setup widget)
  calendar/page.js           — Main contractor view: daily jobs, drag-and-drop routing
  clients/page.js             — Client list with A-Z filter
  clients/[id]/page.js       — Client detail + invoice history
  dashboard/page.js           — Contractor dashboard (stats, checklist)
  login/page.js               — Firebase Auth login
  signup/page.js              — Redirects to login?mode=signup (NO Firebase imports)
  subscribe/                  — Subscription checkout page
  onboarding/                 — Stripe Connect onboarding flow
  pay/[paymentIntentId]/      — Public payment page (what clients see)
  services/page.js            — Manage service types + pricing
  settings/page.js            — Account settings, payment method, plan management
  sms/page.js                 — SMS log/history
  terms/page.js               — Terms of Service
  privacy/page.js             — Privacy Policy
  reactivate/page.js          — Reactivation flow for canceled accounts
```

### API Routes (27 total)
```
api/admin/send-template/     — POST: Email import template to contractor (Firebase auth required)
api/cron/billing/             — GET: (disabled, returns early) Legacy billing cron
api/cron/health/              — GET: System health check (CRON_SECRET auth)
api/cron/quarterly/           — GET: (disabled, returns early) Legacy quarterly billing
api/cron/reward-check/        — GET: Volume reward tier evaluation (CRON_SECRET auth)
api/cron/sms/                 — GET: Send scheduled SMS reminders (CRON_SECRET auth)
api/ical/[clientId]/          — GET: iCal feed for a client's schedules
api/invoices/                 — Invoice-related endpoints
api/square/*/                 — Dead code (6 routes). Square removed April 2026.
api/stripe/cancel-subscription/ — POST: Cancel Stripe subscription
api/stripe/charge-fees/       — POST: Charge platform fees
api/stripe/checkout/          — POST: Create Stripe Checkout session (sub + optional setup)
api/stripe/connect/           — 4 routes for Stripe Connect Express onboarding
api/stripe/invoice/           — POST: Create PaymentIntent + write invoice to Firestore (server-side)
api/stripe/pay/details/       — GET: Public payment intent details for pay page
api/stripe/payment-method/    — POST/DELETE: Manage saved payment methods
api/stripe/reactivate-subscription/ — POST: Reactivate canceled subscription
api/stripe/session/           — GET: Retrieve Stripe session
api/stripe/setup-intent/      — POST: Create SetupIntent for saving cards
api/stripe/upgrade/           — POST: Upgrade monthly → annual
api/stripe/webhook/           — POST: All Stripe webhook handlers (signature verified)
api/twilio/send/              — POST: Send SMS via Twilio
```

### Auth Patterns
- **Stripe webhook:** Signature verification via `stripe.webhooks.constructEvent()`
- **Square webhook:** HMAC-SHA256 (dead code, but still wired)
- **Cron routes:** `Bearer ${CRON_SECRET}` header check
- **Admin API routes:** Firebase ID token verification via REST `accounts:lookup` against `ADMIN_EMAIL`
- **Other Stripe routes:** No server-side auth — rely on client-side Firebase auth gating via AppShell
- **Client pages:** `AppShell.js` checks subscription status + Stripe Connect status before rendering

### Key Libraries
| File | Purpose |
|---|---|
| `lib/firestoreRest.js` | Server-side Firestore via REST API. Signs in as admin (email/password → ID token). Exports: `queryCollection`, `getDocument`, `setDocument`, `updateDocument`, `createDocument`, `toFirestoreValue`, `fromFirestoreFields` |
| `lib/email.js` | SendGrid wrapper. Exports: `sendAdminEmail({ subject, html, text })`. Fails silently if env vars missing. |
| `lib/fee.js` | Fee math. `formatCents()` and application fee calculation (5.5%). |
| `lib/firebase.js` | Firebase client SDK init (app, auth, db exports). |
| `lib/phone.js` | Phone number formatting utilities. |
| `lib/date.js` | Date formatting with `fmt()` helper using date-fns. |
| `lib/i18n.js` | Bilingual string maps (EN/ES) for UI text. |
| `lib/square.js` | Square helpers (dead code, still imported by Square routes). |
| `lib/ical.js` | iCal generation for client schedule feeds. |
| `lib/db.js` | Firestore collection reference helpers. |

### Components
| File | Purpose |
|---|---|
| `components/layout/AppShell.js` | Main app wrapper. Gates on: Firebase auth, subscription status, Stripe Connect status. Admin email bypasses subscription check. |
| `components/layout/BottomNav.js` | Mobile bottom navigation bar. |
| `components/layout/PageHeader.js` | Shared page header component. |
| `components/ui/PhoneInput.js` | Phone number input with formatting. |
| `components/ui/index.js` | UI component barrel export. |

### Contexts
| File | Purpose |
|---|---|
| `context/AuthContext.js` | Firebase Auth provider. Exposes `user`, `loading`, `signOut`. |
| `context/LangContext.js` | EN/ES language toggle. Persists to localStorage. |

---

## 5. Critical Constraints

### The Firebase Admin SDK Problem
The Firebase project lives under the `fanbasetickets.net` Google Cloud organization. This org has a policy that blocks service account key creation. Without a service account key, `firebase-admin` cannot initialize. This is NOT fixable without org admin changes.

**Workaround:** `lib/firestoreRest.js` authenticates via Firebase Auth REST API:
1. Signs in with email/password → gets ID token
2. Caches token in memory (refreshes when expired, 60s buffer)
3. Uses token as Bearer auth for Firestore REST API calls
4. Required env vars: `FIREBASE_ADMIN_PASSWORD`, `FIREBASE_API_KEY`

**Impact:** All server-side writes (webhook handlers, invoice creation, admin routes) must use `firestoreRest.js` helpers, never direct Firebase Admin calls.

### SSR/Prerender Restrictions
Firebase client SDK requires browser APIs. Any page that imports Firebase and is statically rendered at build time will crash the Vercel build.

**Affected routes that must NEVER import Firebase:**
- `app/(landing)/page.js` — marketing landing page
- `app/signup/page.js` — signup redirect

**Solutions:**
- `dynamic(() => import(...), { ssr: false })` for Firebase components
- `'use client'` directive + no server component Firebase imports
- `useSearchParams()` requires Suspense boundary or use `window.location.search` in useEffect instead

### Domain Usage Rules
Both domains serve the same Vercel deployment:
- **yardsyncapp.com** — Use for contractor/client-facing URLs (payment links, template downloads, landing page, terms)
- **yardsync.vercel.app** — Use for admin-facing URLs (dashboard links in SMS/email alerts to Jay)

---

## 6. Stripe Integration Details

### Subscription Flow
1. Contractor visits `/subscribe` → picks monthly ($39) or annual ($390) + optional Pro Setup ($99)
2. `POST /api/stripe/checkout` creates a Checkout session with line items
3. Stripe redirects to success URL after payment
4. Webhook `checkout.session.completed` fires → writes to `subscriptions` and `users` collections
5. If Pro Setup was purchased (detected via `listLineItems` against `STRIPE_PRICE_SETUP`):
   - Sets `setupFeePaid: true` on user doc
   - Sends SMS to `ADMIN_PHONE_NUMBER` via Twilio
   - Sends branded HTML email to `ADMIN_EMAIL` via SendGrid
   - Admin sees pending widget on `/admin/dashboard`

### Invoice Flow (Stripe Connect)
1. Contractor marks job complete → taps "Send Invoice"
2. Confirmation modal shows: line items, 5.5% fee breakdown, net amount
3. `POST /api/stripe/invoice` creates PaymentIntent with `application_fee_amount` and `transfer_data.destination`
4. Invoice doc written to Firestore via `firestoreRest.js`
5. Client receives SMS/email with payment link → pays at `/pay/[paymentIntentId]`
6. Webhook `payment_intent.succeeded` marks invoice as paid in Firestore

### Subscription Lifecycle (webhook handlers)
| Event | Action |
|---|---|
| `checkout.session.completed` | Create subscription + user docs, detect Pro Setup |
| `invoice.payment_succeeded` | Renew subscription, mark Connect invoices paid |
| `invoice.payment_failed` | Set status → `past_due` |
| `customer.subscription.updated` | Update plan (monthly/annual) + status |
| `customer.subscription.deleted` | Set status → `canceled` |
| `payment_intent.succeeded` | Mark Connect invoices paid |

### Invoice Double-Charge Prevention
Recurring clients with a prepaid plan must NOT be charged the base service fee again. The invoice modal:
- Detects recurring clients and excludes the base line item
- Shows only extras + materials
- Displays a note: "Base service is already covered by the recurring plan"

---

## 7. Admin Dashboard

Lives at `/admin/dashboard`. Dark mode UI. Only accessible to `admin@fanbasetickets.net`.

### Features
- Gardener (contractor) list with revenue stats
- Subscription status overview
- Invoice history per gardener
- **Pro Setup Pending Widget** (amber alert card at top):
  - Filters: `gardeners.filter(g => g.setupFeePaid && !g.setupContacted)`
  - Shows count, most recent purchase, up to 5 entries
  - "Mark contacted" button opens modal with notes field
  - "Send template to client" button emails import template via `/api/admin/send-template`
  - "Download template" button downloads `/YardSync_Client_Import_Template.xlsx`

### Gardener Filter Chips (added April 13)
- All / Connect-complete / Needs Connect / No invoices yet / Top earners
- Connect-complete gates on `!!g.stripeAccountId` (NOT `stripeAccountStatus` — that field is poisoned)
- Default sort: `activeClients` descending
- Top earners: top 5 by `allTime.total` desc

### Dead UI to Remove (next session)
- Any Square-related UI elements
- Quarterly billing references
- These were from the pre-April 2026 dual-payment-path era

---

## 8. Bilingual System (EN/ES)

- `context/LangContext.js` provides `lang` and `setLang`
- `lib/i18n.js` contains all translated strings
- Toggle available in the app UI
- Landing page has its own inline Spanish toggle
- SMS messages sent via Twilio respect the contractor's language preference
- All filter chips, buttons, modals, and helper text have Spanish translations

---

## 9. Project Evolution Timeline

### Phase 1-3 (Pre-March 2026)
- Initial build: Firebase + Square payment path
- Calendar with job management
- Client list, services, materials tracking
- SMS appointment reminders via Twilio

### Phase 4 (March 2026)
- Added Stripe Connect as parallel payment option alongside Square
- Dual payment path: contractors chose Square OR Stripe during onboarding
- Quarterly billing cron for Square invoices
- Master codebase snapshot V1 and V2 generated

### Phase 5 (April 2026) — Current
- **Square fully removed** — migrated to Stripe-only model
- Square routes preserved as dead code (files not deleted)
- Quarterly billing crons disabled (return early)
- Rewrote Terms of Service for dual-fee model ($39/mo sub + 5.5% per invoice)
- Added Early Adopter Pricing Lock (Section 5 of ToS)
- Marketing landing page at `/` with phone screenshots, volume rewards, pricing cards
- Landing page iterations: hero copy, screenshot versions (v1→v4), mint green background
- Collapsible job cards on calendar with filter chips (All/Pending/Completed/Set Route)
- Drag-and-drop route reordering (pointer events, touch + mouse)
- Invoice confirmation modal with fee breakdown
- Recurring invoice safety: never charges prepaid base service
- Materials included in walk-in invoice totals
- Pro Setup admin notification chain: Stripe webhook → Twilio SMS + SendGrid email → dashboard widget
- Client import template hosting + email API
- Firebase Auth verification on admin API routes
- Contact email unified to support@yardsyncapp.com

### Phase 5 continued (April 13, 2026)
- Null-guarded `subscription.current_period_end` in two webhook handlers (checkout + invoice.payment_succeeded)
- `currentPeriodEnd` + `lastPaymentAt` written to users doc on every payment; displayed on Settings
- Calendar auto-selects today on load (was showing empty state requiring tap)
- Landing page: "FREE" → "$0 Subscription" everywhere, Early Adopter banner added above pricing
- Email invoice notifications: `sendClientEmail()` in `lib/email.js`, server-side bilingual email with pay link
- Walk-in default price set to $65 (was empty placeholder causing $0 invoices)
- Settings "$0/mo" wording (was "FREE")
- **Channel picker on all invoice send paths** — SMS / Email / Both buttons based on client contact info
- `preferredChannel` field on client doc, radio group in Edit Client modal
- Invoice API accepts `channels` param, returns `emailNotified` + `smsRequested`
- Bug A fixed: Edit Client phone clearing (`form.phone || client.phone` → `form.phone.trim()`)
- Bug B fixed: Silent 400 on Send Invoice → specific error codes (`no_connect`, `no_total`) + graceful toast + redirect to Settings
- Bug D fixed: Phone no longer marked required, "Phone or email required" helper, form-level validation
- Bug E fixed: "undefined · active" → "No package · active" on clients without a package
- Sign-out: labeled pill on dashboard hero + full-width button on Settings bottom
- Admin dashboard: gardener filter chips (All / Connect-complete / Needs Connect / No invoices / Top earners) + activeClients sort
- Connect-complete filter gates on `stripeAccountId` (not poisoned `stripeAccountStatus`)

### Phase 5 continued (April 14, 2026)
- i18n hotfix: `common.sign_out` key added (EN + ES) so dashboard pill and Settings button render "Sign out" / "Cerrar sesión" instead of raw key
- Bug C fully closed: all 4 Connect-complete gates (AppShell, dashboard onboarding step, 2× Settings) now check `!!profile.stripeAccountId` instead of poisoned `stripeAccountStatus`
- Deleted `scripts/migrate-stripe-status.js` (the poisoner) and added `scripts/clean-orphaned-stripe-status.js` (one-shot cleanup)
- **Ran cleanup**: 6 orphaned `stripeAccountStatus: 'complete'` docs cleared (test accounts + Marco's account which hadn't finished Connect onboarding)
- Deleted duplicate Victor Scales Firestore doc (`znCfJTyyScZchNOqNESL9CmvqQy1`) that conflicted with the real account having 8 clients
- **Bug D finished on Add-Client modal**: phone optional, email format validation, "Did you mean?" suggestions for common typos (gmial/gmai/yaho/etc)
- New `lib/emailHelpers.js` exports `isValidEmail` + `suggestEmailCorrection`
- **Bug F Part A (admin tally)**: `splitInvoice()` now trusts top-level `inv.applicationFee` + `inv.totalCents` before falling back to legacy line-item walk — destination-charge invoices were showing $0 platform fee in admin tallies
- **Bug F Part B (recent invoices row)**: replaced duplicate inline walker with `splitInvoice()` call so per-gardener Recent Invoices list shows correct "My cut / Gardener kept" breakdown
- **Admin Dashboard Overhaul PR 1** (layout only): top-line collapsed from 8 → 6 cards in 2x3 (My Cut + Collected show realized headline + committed subtitle, Active Contractors, Active Clients, Subscription Mix with MRR, Pro Setup Pending). Removed Quarterly Fee Breakdown, standalone MRR, and top-line Outstanding. Added Attention panel (renders only when populated: Connect disabled / past_due / canceled <30d / going dark). Per-row tier badge (Sub: Monthly/Annual/Inactive/Other). Expanded row gains Outstanding card.
- **Admin Dashboard Overhaul PR 2** (Q11 Stripe net-out): webhook `payment_intent.succeeded` now captures `pi.latest_charge.balance_transaction.fee` and persists `stripeProcessingFee` + `netToPlatform` on the invoice doc. Dashboard `splitInvoice()` prefers `netToPlatform` when present, so new paid invoices report true YardSync net (app fee minus Stripe's ~2.9% + $0.30) instead of gross. Corrects ~50%+ revenue overstatement on dashboard headline as new invoices flow.

### Phase 5 continued (June 3, 2026) — Scenario A + A2 (Pro Setup E2E test)

Pre-launch dogfooding via Chrome Claude. **YardSync has zero real customers; Marco is a test account, not the first customer.**

**Scenario A (June 1, commits 1f47313, 2a7d877):**
- Pro Setup E2E test run via Chrome Claude through full UI flow (signup → /subscribe → Stripe Checkout with Pro Setup add-on → webhook → Firestore writes)
- All UI/data paths green: subscription activated, `setupFeePaid: true` written, admin email arrived, dashboard widget appeared
- Found a /dashboard auto-redirect regression for brand-new no-subscription users (5+ second blank-page wait before manual nav)
- Found admin SMS NOT arriving despite webhook firing (looked like an env-var issue)
- Diagnostic logging added to webhook (`2a7d877`) to surface `ADMIN_PHONE_NUMBER` state in Vercel logs

**Scenario A2 (June 3, commit e23c65d):**
- Redirect fix: `context/AuthContext.js` now writes `subscriptionStatus: 'none'` explicitly on signup (both email and Google OAuth paths). Eliminates the async fallback race in AppShell.
- AppShell 4-second timeout log enhanced with `subStatus` + `user?.uid` for future diagnostics
- Safety audit confirmed: no code in the repo checks `subscriptionStatus === undefined` / `=== null` / `!subscriptionStatus`. The new explicit `'none'` is fully backward-compatible.
- A2 re-test confirmed: signup → /subscribe redirect now fires ≤2 seconds, no blank window
- **Admin SMS root cause solved: AT&T + Android spam blocker silently dropping the admin SMS body into the device spam folder.** Twilio shows all sends as `delivered` (carrier accepted handoff). Phone-side classifier filtered the "Pro Setup purchase – ... Reach out to onboard ... vercel.app URL" body as promotional. Whitelisted by reporting as not-spam.
- Customer-facing SMS (appointment reminder format) is NOT subject to the same filtering — the May 29 test of "Hi Sara! Your yard service is scheduled..." landed in the main inbox on the same phone. The format is carrier-whitelisted.

### Phase 5 continued (May 23-24, 2026) — AI drafter, A2P approval, Messaging Service SID, subagent roster

**May 23 (commits 1f47313, bdfec75, 3c006e4, 9026f66, 7bb4610, e6fa707):**
- **AI-powered SMS message drafting** — new `/api/ai/draft-message` route using Claude Sonnet 4.6 via `@anthropic-ai/sdk`. Core in `lib/aiDraft.js` with `validateInput()` + `draftMessage()`. UI in `components/AiReminderDrafter.js` on client detail page (between Billing and Invoice History). Date + time + service + notes inputs, EN/ES toggle, editable draft, char count with thresholds, Send via SMS reusing `/api/twilio/send`, Copy to clipboard.
- **5-sample eval suite** at `app/api/ai/draft-message/__tests__/draft-message.eval.mjs` — HTTP-based against running dev server. Checks shape, length cap (≤320), charCount accuracy, first name, time form, contractor name, no placeholders, exclamation count ≤1, Spanish-hint for ES. Iterated prompt rules until 5/5 pass.
- **Model bump:** Sonnet 4.5 → 4.6 for portfolio currency.
- **Public `/sms-opt-in` consent form** for A2P review — server component, no auth, GET form with hidden `confirmed=true`. Name/phone inputs omit `name` attribute (values never enter URL — honors "not stored by this form"). Consent checkbox unchecked by default, not required. Success state via `?confirmed=true`. Terms + Privacy links outside checkbox label.
- **STOP language across all default templates** — EN: `Reply STOP to opt out. – YardSync`. ES: `Responda STOP para cancelar. – YardSync`. Applied to: `context/AuthContext.js` (signup defaults, email + OAuth), `app/sms/SmsContent.js` (3 sites), `app/settings/SettingsContent.js`, `app/api/cron/sms/route.js`. User-customized templates untouched.
- **AI draft prompt STOP rule** — mandatory opt-out line at end of every AI-drafted message.
- **Landing page demo SMS bubbles** — EN (line 194) + ES (line 196) updated with STOP language to match real sent messages.

**May 24 (commits 8b8a25d, d2c30b3, 9d9786f):**
- **A2P 10DLC campaign APPROVED** (Twilio campaign status: Verified). SMS now fully unrestricted — sends to any US number.
- **Twilio Messaging Service SID migration** — every outbound SMS path switched from `From: TWILIO_PHONE_NUMBER` to `MessagingServiceSid: TWILIO_MESSAGING_SERVICE_SID`. 7 files: `app/api/twilio/send/route.js`, `lib/sms.js`, `app/api/cron/sms/route.js` (3 fetch sites), `app/api/cron/quarterly/route.js`, `app/api/cron/billing/route.js`, `app/api/stripe/webhook/route.js` (Pro Setup admin alert), `app/api/cron/health/route.js` (env-var presence check). New env var `TWILIO_MESSAGING_SERVICE_SID` (value `MG21e23c10d5d507045b0a1e263c0eb25b`) required on Vercel before next deploy or cron runs will fail. `TWILIO_PHONE_NUMBER` is legacy — kept in env, unused by code.
- **First SMS sent end-to-end on the new pipeline — DELIVERED** to Jay's phone via AI drafter EN. Confirms post-A2P Messaging Service routing works.
- **Subagent roster created in `.claude/agents/`** — 6 SME agents (stripe-payments, sms-a2p, firebase-firestore, bilingual-reviewer, regression-tester, ai-features), 3 persona agents (marco/established-skeptic/newbie-eager for UX dogfooding), 1 market-research agent. Auto-invoke based on description triggers. Future sessions automatically have these specialists.
- **`ROADMAP.md` created** with Phase 1 status, Phase 2 hypothesis backlog (awaiting market-research population), Phase 3 scale plans.
- **Twilio status-callback webhook backlogged** (CLAUDE.md) — current `"SMS sent ✓"` toast fires on Twilio queued, not on handset delivery. Required before heavy SMS volume.
- **Scenario A (Pro Setup E2E) Chrome Claude prompt with pauses** ready in conversation — queued for next session.

### Phase 5 continued (April 20-21, 2026)
- Privacy policy: added mobile opt-in language for A2P compliance (never share SMS data with third parties)
- Webhook hardening: `invoice.payment_succeeded`, `invoice.payment_failed`, `customer.subscription.deleted` now log warnings instead of failing silently when `subscriptions` doc lookup returns null
- One-shot backfill `scripts/backfill-user-subscription-fields.js` — 7 test accounts backfilled with `stripeSubscriptionId`, `currentPeriodEnd`, `lastPaymentAt`; 4 unbackfillable orphans flagged
- Settings "Last charged" + "Next billing date" now render for backfilled accounts
- **Volume Rewards system fully verified end-to-end (Tier 0 item CLOSED):**
  - `reward-check` cron fixed: now looks up `stripeAccountId` via Firestore (was relying on unreliable metadata writes from `save-account-metadata`)
  - Persists `rewardTier`, `rewardStreak`, `lastVolumeCheck`, `lastVolumeAmount` to user doc on every run
  - Stripe flexible-billing compatibility: uses `discounts: [{ coupon }]` instead of legacy `coupon` param; uses `deleteDiscount()` for removal (`update({ discounts: [] })` silently no-ops)
  - Settings Pay Rewards widget rewritten to read authoritative `profile.rewardTier` / `rewardStreak` instead of computing from local invoices
  - "🏆 Free tier active" / "⭐ 50% reward active" badges on subscription card
  - "Upgrade to Annual" card now hidden when any reward tier is active (math was misleading at 50% off, nonsensical at free)
  - "Volume / You Pay" column headers added to Pay Rewards widget
  - Seed script (`scripts/seed-volume-reward-test.js`) uses destination charges to mirror production flow
  - Coupons `YARDSYNC_50OFF` (50% forever) and `YARDSYNC_FREE` (100% forever) created in Stripe test mode
  - All 5 scenarios visually verified on Victor Scales test account (half tier, free tier, streak building at each, base state)
- **Volume Rewards UX Section 1 — Onboarding Modal** (commit fa72de6): first-login bilingual modal explaining tier system; gate shows only when `hasSeenRewardsIntro === false` (explicit); webhook sets flag on new signups; dismissed via client Firestore write; existing/admin accounts never see it
- **Volume Rewards UX Section 2 — Notifications** (commit d99969c): 5-event notification system fires from reward-check cron on tier transitions. `milestone_half`/`milestone_free` (streak 0→1) send email only; `activated_half`/`activated_free` (coupon newly applied) + `dropped` (discount removed) send email + SMS. Bilingual, idempotent via `lastNotifiedEvent` + `lastNotifiedAt` on user doc (same event + same calendar month = skip). New `lib/sms.js` Twilio helper. Each send wrapped in try/catch — notification failure never crashes cron. Next natural fire: May 1, 2026 at 6am UTC.

---

## 10. Deployment Breakers (Historical)

These are real errors that crashed production or blocked deployment. Documented so they never happen again.

### 1. Firebase imports in prerendered routes
**Error:** `ReferenceError: document is not defined` during Vercel build
**Cause:** `app/(landing)/page.js` imported `useAuth` from `@/context/AuthContext`, which imports Firebase client SDK. The landing page is statically rendered at build time — Firebase needs browser APIs.
**Fix:** Remove all Firebase imports from landing page and signup page. (Commits: 61a9152)

### 2. useSearchParams without Suspense
**Error:** Vercel build crash — "useSearchParams() should be wrapped in a suspense boundary"
**Cause:** `app/login/page.js` used `useSearchParams()` at the top level.
**Fix:** Replaced with `new URLSearchParams(window.location.search)` inside useEffect. (Commit: 4f778d6)

### 3. Firestore 403 PERMISSION_DENIED on server-side writes
**Error:** Webhook and invoice routes returned 500 — Firestore rejected writes.
**Cause:** Attempted to use Firebase Admin SDK, which can't initialize due to org policy.
**Fix:** Created `lib/firestoreRest.js` — authenticates via Firebase Auth REST API, uses Firestore REST for all server writes.

### 4. new Date(NaN).toISOString() crash in webhook
**Error:** `RangeError: Invalid time value` — webhook returned 500
**Cause:** `subscription.current_period_end` is null/undefined on certain Stripe events. `new Date(undefined * 1000)` = `new Date(NaN)`.
**Fix:** Null-guard: `value ? new Date(value * 1000).toISOString() : null`. Fixed in two places. (Commits: 9df0eb5, bdc5b8f)

### 5. Pro Setup flag written on every checkout
**Error:** Every subscriber was showing up in the Pro Setup pending widget, not just those who paid $99.
**Cause:** During the firestoreRest migration, the `hasSetup` line item check was accidentally stripped. `setupFeePaid: true` was being written for ALL checkout.session.completed events.
**Fix:** Re-added `listLineItems` check against `STRIPE_PRICE_SETUP`, wrapped all setup writes + alerts in `if (hasSetup)`. (Commit: fe64910)
**Cleanup needed:** Audit `users` collection for stale `setupFeePaid: true` flags from the bug period.

### 6. Card component swallowing data attribute for drag-and-drop
**Error:** Desktop drag-and-drop stopped working — drop target couldn't find `data-schedule-id`.
**Cause:** React component consumed the data attribute instead of passing it to the DOM.
**Fix:** Wrapped card in a div carrying `data-schedule-id`. (Commit: 9ca7bdb)

### 7. Walk-in materials cost not included in invoice total
**Error:** Invoice preview showed wrong total — materials were missing from the calculation.
**Cause:** Walk-in invoice total was calculated from a separate code path that didn't include materials.
**Fix:** Added materials to `walkInInvoiceTotal` calculation. (Commit: baec4e7)

### 8. Edit Client silently preserves phone on blank submit
**Error:** Clearing a client's phone in Edit modal, saving, then reloading — phone reappears unchanged.
**Cause:** `phone: form.phone || client.phone` treats empty string as falsy, falls back to old value.
**Fix:** `phone: form.phone.trim()` — empty string means "clear the field". (Commit: 820cd5a)

### 9. Silent 400 on Send Invoice without Stripe Connect
**Error:** Contractor clicks Send Invoice, nothing happens — no toast, no error, modal stays open.
**Cause:** `/api/stripe/invoice` returned 400 with generic "Missing required fields", client threw but the toast was swallowed.
**Fix:** API returns specific `code: 'no_connect'`, client shows descriptive toast + redirects to Settings. (Commit: 820cd5a)

### 11. Admin "My cut" tally read $0 on destination-charge invoices
**Error:** Admin dashboard's per-gardener fee tally, top-line cards, and Recent Invoices rows all showed $0 for every Stripe Connect destination-charge invoice.
**Cause:** `splitInvoice()` derived fees from `lineItems.filter(l => l.category === 'fee')`, but `/api/stripe/invoice` writes `applicationFee` as a top-level field and never injects a fee line item. Two separate places had this inline walker.
**Fix:** Part A — `splitInvoice()` now prefers `inv.applicationFee` + `inv.totalCents` top-level (commit a3e2949). Part B — duplicate inline walker in Recent Invoices row replaced with `splitInvoice()` call (commit f04c003). Legacy line-item walk kept as fallback for the one Marco Rubio legacy invoice.

### 12. i18n sign_out key missing from common namespace
**Error:** Dashboard hero pill and Settings button rendered literal `sign_out` text instead of translated label.
**Cause:** `translate('common', 'sign_out')` called but key only existed under `subscribe` namespace.
**Fix:** Added `common.sign_out` to both EN ("Sign out") and ES ("Cerrar sesión") blocks (commit 5bd5eb3).

### 13. Connect-complete UI gated on poisoned stripeAccountStatus
**Error:** AppShell let contractors through to protected routes even without Connect onboarding (6 of 16 user docs had `stripeAccountStatus: 'complete'` but no `stripeAccountId`).
**Cause:** A one-shot migration script stamped `stripeAccountStatus: 'complete'` on subscribed users regardless of actual Stripe Connect status.
**Fix:** All 4 Connect-complete gates (AppShell redirect, dashboard onboarding step, 2× Settings sections) now gate on `!!profile.stripeAccountId`. Poisoner script deleted. Cleanup script ran and cleared 6 orphans. (Commits 39a049e)

### 10. Walk-in default price creating $0 invoices
**Error:** Contractors see "65" as a grey placeholder, submit without touching field, `walkInPrice === ''` → `basePrice = 0`.
**Cause:** Placeholder is not a value — `useState('')` initializes empty.
**Fix:** Initialize `walkInPrice` to `'65'` in both `openWalkInForClient` and `openWalkInModal`. (Commit: 79c7472)

---

## 11. Env Vars (Complete Reference)

### Server-side only (Vercel Environment Variables)
| Var | Purpose |
|---|---|
| `STRIPE_SECRET_KEY` | Stripe API key (test or live) |
| `STRIPE_WEBHOOK_SECRET` | Webhook signature verification |
| `STRIPE_PRICE_MONTHLY` | Price ID for $39/mo plan |
| `STRIPE_PRICE_ANNUAL` | Price ID for $390/yr plan |
| `STRIPE_PRICE_SETUP` | Price ID for $99 Pro Setup add-on |
| `FIREBASE_ADMIN_PASSWORD` | Password for admin Firebase Auth account |
| `FIREBASE_API_KEY` | Firebase Web API key (fallback: NEXT_PUBLIC_FIREBASE_API_KEY) |
| `FIREBASE_ADMIN_EMAIL` | Admin email for firestoreRest.js auth (defaults to admin@fanbasetickets.net — should be explicit) |
| `TWILIO_ACCOUNT_SID` | Twilio account SID |
| `TWILIO_AUTH_TOKEN` | Twilio auth token |
| `TWILIO_MESSAGING_SERVICE_SID` | A2P-registered Messaging Service SID (e.g. `MG…`). All app SMS sends route through this; required for 10DLC compliance. |
| `TWILIO_PHONE_NUMBER` | Legacy direct sender number — no longer read by app code; kept in env for reference only. |
| `SENDGRID_API_KEY` | SendGrid API key (Mail Send permission) |
| `SENDGRID_FROM_EMAIL` | Verified SendGrid sender address |
| `ADMIN_EMAIL` | Where admin alerts go (email) |
| `ADMIN_PHONE_NUMBER` | Where admin alerts go (SMS) |
| `CRON_SECRET` | Shared secret for cron route auth |

### Client-side (NEXT_PUBLIC_)
| Var | Purpose |
|---|---|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase Web API key |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Firebase Auth domain |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Firebase project ID |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Firebase storage bucket |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Firebase messaging sender ID |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Firebase app ID |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key |
| `NEXT_PUBLIC_STRIPE_PRICE_MONTHLY` | Monthly price ID (client-side display) |
| `NEXT_PUBLIC_STRIPE_PRICE_ANNUAL` | Annual price ID (client-side display) |
| `NEXT_PUBLIC_APP_URL` | App base URL (https://yardsync.vercel.app) |
| `NEXT_PUBLIC_ADMIN_EMAIL` | Admin email for client-side admin check |

---

## 12. Testing Reference

- **Admin login:** admin@fanbasetickets.net
- **Test contractor account:** Jay uses a "victor" account for Stripe flow testing (must log out of admin first)
- **Stripe test connected account:** acct_1TIdSq1wen7Bjvpl (rub@test.com)
- **Webhook testing:** Resend events from Stripe Dashboard → Developers → Webhooks → select event → Resend
- **Vercel logs:** Check function logs for webhook debug output (console.log lines throughout webhook handler)
- **QA checklist:** `QA_PHASE5_CHECKLIST.md` — comprehensive test plan for all features

---

## 13. Known Technical Debt

1. **`firebase-admin` in package.json** — listed but can't be used. Should remove to avoid confusion.
2. **`square` in package.json** — listed but all Square functionality removed. Square routes exist as dead code.
3. **`firestoreRest.js:22` fallback email** — `admin@fanbasetickets.net` hardcoded as fallback. Should fail loudly if `FIREBASE_ADMIN_EMAIL` not set.
4. **`firestore.rules:5`** — `isAdmin()` hardcodes `admin@fanbasetickets.net`. Works but fragile.
5. **19 Stripe API routes have no server-side auth** — rely entirely on client-side AppShell gating. Low risk for now (all require Stripe customer IDs that aren't guessable) but worth hardening before scale.
6. **Admin dashboard still has some Square-era UI** — scheduled for cleanup.
7. ~~**Landing page "FREE Subscription" wording**~~ — RESOLVED: all "FREE" → "$0 Subscription" with "5.5% per invoice always applies" (commit 15cdb4d).
8. ~~**No Early Adopter deadline on landing page**~~ — RESOLVED: banner added above pricing (commit 15cdb4d).
9. **Duplicate invoice prevention is client-side only** — racy under concurrent requests. Consider Firestore transaction guard.
10. ~~**`stripeAccountStatus` poisoned in Firestore**~~ — RESOLVED 2026-04-14: All 6 orphans cleared via `scripts/clean-orphaned-stripe-status.js`. Poisoner script deleted.
11. ~~**AppShell Connect gate is weak**~~ — RESOLVED 2026-04-14: All 4 Connect gates now check `!!profile.stripeAccountId` (commit 39a049e).
12. **Historical invoices lack `stripeProcessingFee`** — Q11 captures this going forward via webhook, but pre-April 14 paid invoices have no processing-fee data. Dashboard shows gross for those, net for new ones. Acceptable — gap closes naturally as new invoices flow. Optional backfill script if accounting wants exact historical numbers.
13. **Three dead inline line-item walkers remain** in `app/admin/dashboard/page.js` (lines ~138, ~156, ~214) — obsolete quarterly-billing code. Low priority cleanup.
14. **Twilio status-callback webhook not wired** — current `/api/twilio/send` returns success on Twilio 2xx (queued), not on handset delivery. Toast says "SMS sent ✓" before Twilio attempts the carrier handoff. Required before heavy SMS volume so users don't believe undelivered messages went through. Implementation: add `StatusCallback` param when creating the message, route handler at `/api/twilio/status-callback` that receives queued/sent/delivered/failed/undelivered events and updates message status in Firestore.

---

## 14. Roadmap

### Immediate (next session)
- [ ] End-to-end Pro Setup test in Stripe test mode
- [x] ~~Admin dashboard PR 1 (layout overhaul)~~ (done 2026-04-14)
- [x] ~~Admin dashboard PR 2 (Q11 Stripe net-out)~~ (done 2026-04-14)
- [ ] Admin Dashboard Overhaul PR 3: CSV rebuild (2-tier) + email digest queue scaffold + mobile handling decision
- [ ] Smoke test PR 2: pay a test invoice on Connect-complete account, confirm `stripeProcessingFee` + `netToPlatform` land on invoice doc, verify dashboard headline uses net
- [x] ~~Landing page: add Early Adopter deadline, clarify "FREE" wording~~ (done 2026-04-13)
- [x] ~~Fix AppShell Connect gate~~ (done 2026-04-14, commit 39a049e)
- [x] ~~Clean up poisoned `stripeAccountStatus` data~~ (done 2026-04-14, 6 orphans cleared)
- [x] ~~Backfill user subscription fields (lastPaymentAt/currentPeriodEnd/stripeSubscriptionId)~~ (done 2026-04-21, 7 accounts)
- [x] ~~Volume Rewards end-to-end test (Tier 0)~~ (done 2026-04-21, all 5 scenarios verified)
- [x] ~~Webhook hardening: log warnings on silent subscriptions doc lookups~~ (done 2026-04-21)
- [x] ~~A2P privacy policy language~~ (done 2026-04-20)
- [x] ~~Volume Rewards UX — onboarding modal + notifications~~ (done 2026-04-21)
- [x] ~~AI-powered SMS message drafting (Claude Sonnet 4.6) + 5-sample eval suite + client-detail UI~~ (done 2026-05-23)
- [x] ~~Public `/sms-opt-in` consent form (server component, A2P-reviewer accessible)~~ (done 2026-05-23)
- [x] ~~A2P STOP language: EN + ES templates, AI draft prompt, landing demos~~ (done 2026-05-23)
- [x] ~~Twilio Messaging Service SID migration (all 6 send sites)~~ (done 2026-05-24)
- [x] ~~Subagent roster (6 SMEs + 3 personas + market-research) + ROADMAP.md~~ (done 2026-05-24)
- [ ] **Post-Twilio approval:** re-run AI draft 5-sample eval with the new STOP rule (expect 170–200 char outputs)
- [ ] **Post-Twilio approval:** add `Reply STOP to opt out. – YardSync` presence assertion to AI eval
- [ ] **Before heavy SMS volume:** wire Twilio status-callback webhook for accurate delivery indicator
- [ ] **Run Scenario A** (Pro Setup E2E test, Chrome Claude prompt with pauses ready)
- [ ] **2 more SMS consistency tests** via Chrome Claude (Spanish AI draft + manual /sms)
- [ ] LangContext → Firestore sync for `preferredLanguage` field (so cron notifications pick up ES preference)
- [ ] `firestoreRest.js`: remove fallback email, require explicit env var
- [ ] Email invoice delivery smoke test (Connect-complete account + email-only client)
- [ ] Sweep remaining dead Square/quarterly UI from admin dashboard (lines 138/156/214 inline walkers)
- [ ] Investigate 4 unbackfillable orphan accounts (jarius.johnson@my.utsa.edu, testuser@yardsyncdemo.com, johnsonjarius19@gmail.com, johnsoncandace009@gmail.com) — either delete stale docs or clear fabricated `subscriptionStatus: 'active'`

### Before live launch
- [ ] Audit `users` collection for stale `setupFeePaid: true` flags
- [ ] Swap all Stripe keys to live in Vercel
- [ ] Create live Stripe webhook + update signing secret
- [x] ~~Verify Twilio A2P registration approved~~ (done 2026-05-24, campaign Verified)
- [x] ~~Set `TWILIO_MESSAGING_SERVICE_SID=MG21e23c10d5d507045b0a1e263c0eb25b` on Vercel (Production + Preview + Development) + trigger fresh deploy~~ (done 2026-05-24)
- [ ] Full QA pass per QA_PHASE5_CHECKLIST.md
- [ ] Lawyer review of ToS Section 5 (Early Adopter Pricing Lock)

### Post-launch
- [ ] `/invoices` index page (currently "coming soon" toast)
- [ ] Server-side duplicate invoice enforcement
- [ ] Reactivation path full testing (cancel → reactivate cycle)
- [ ] Remove dead Square routes + `square` package
- [ ] Remove `firebase-admin` from package.json
- [ ] Consider server-side auth on Stripe API routes

---

## 15. Session Update Protocol

**At the end of every significant session, update this file:**
1. Add any new deployment breakers to Section 10
2. Update the timeline in Section 9 with what was built
3. Move completed roadmap items out of Section 14
4. Update Section 13 (tech debt) if anything was added or resolved
5. Update the "Last updated" date at the top

**This file replaces the need to:**
- Re-explore the codebase
- Re-read git history
- Ask "what does this project do?"
- Re-discover constraints the hard way
