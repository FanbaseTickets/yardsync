# YardSync Knowledge Base

> **Purpose:** Complete institutional memory for the YardSync project.
> Read this file once at the start of a session to be fully briefed.
> Updated: 2026-06-18 (end of session — LIVE E2E test + 5-PR cleanup sweep + Stripe Connect account.updated webhook live).
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

> **Dev/Prod Firebase project split (2026-06-14):** Production (`main` → yardsyncapp.com) runs on `yardsync-41886`. Preview deploys and local dev run on `yardsync-dev`. Same code, switched by the `NEXT_PUBLIC_FIREBASE_*` env vars in Vercel scopes. The `firestoreRest` admin pattern works against both — same admin email, distinct passwords.

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

### Phase 5 continued (June 7, 2026 — late session, post pre-live-keys shutdown) — LIVE KEYS FLIPPED + dev/prod environment separation scaffolded

The flip happened. Production is on `sk_live_*` end to end. This session also planted the workflow change Jay wants going forward: feature branches → Vercel Preview deploys (test Stripe) → PR → merge to main → Production (live Stripe). Branch protection step on GitHub is the only piece still on Jay's plate.

**Live-keys flip (mostly manual in Stripe + Vercel; minimal code):**
- Live Stripe webhook endpoint created at `https://yardsyncapp.com/api/stripe/webhook` with the full event list mirrored from the test endpoint; live `whsec_…` captured and pasted into Vercel.
- 6 env vars split Production-only live vs Preview+Dev test in Vercel: `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_MONTHLY/ANNUAL/SETUP`. The public price-id variants got the live IDs in Production too.
- Production redeployed to load the new env scope.
- Verified via a temporary unauthenticated diagnostic route at `/api/debug-stripe` that returned `keyPresent: true`, `keyMode: "live"`, `keyPrefix: "sk_live_51X…"`. The route was created (commit `3058acc`), the deploy stalled briefly so an empty-commit retrigger was pushed (`3829b64`), live mode was confirmed, then the route was deleted (`b9bfad4`). Total exposure window for the diagnostic endpoint: a few minutes. No secrets logged — the prefix exposes 4 chars of actual key body (the rest is fixed `sk_live_`), which is operationally low risk but should never become a permanent endpoint.

**Dev/prod environment separation scaffolded (commit `fd216af`):**
- `.env.test` — non-secret, committed. Holds `NODE_ENV`, `NEXT_PUBLIC_APP_URL=http://localhost:3000`, public test placeholders, the non-secret Firebase project ID, and the A2P-approved Messaging Service SID. Per spec Level 2 separation (separate Firebase project for dev) is explicitly listed as a post-launch improvement, not in scope yet.
- `.env.example` — full template grouped by service (Firebase, Stripe, Twilio, Anthropic, Admin, SendGrid). All keys actually referenced by code, not just the literal spec — added `NEXT_PUBLIC_ADMIN_EMAIL`, `NEXT_PUBLIC_TWILIO_ENABLED`, `SENDGRID_FROM_EMAIL`, plus a comment about `FIREBASE_API_KEY` falling back to the `NEXT_PUBLIC_` variant. Square + FEE_* env vars intentionally omitted — Square is removed code slated for deletion; we don't want new devs thinking they need Square credentials.
- `.gitignore` allowlist — `.env*` still ignores everything, plus explicit `!.env.test` and `!.env.example` exceptions so the safe ones can be committed. Verified with `git check-ignore -v`.
- `docs/DEVELOPMENT.md` — env setup, branch strategy table, dev workflow (6 steps), test Stripe card table, cron trigger PowerShell snippets (health + sms), Firebase CLI deploy commands with `NODE_OPTIONS=--use-system-ca`, common-issues section. Added a Schannel/`git -c http.sslBackend=schannel push` entry because it's the most common Windows trip-wire this project has hit all month and wasn't documented anywhere else.
- `docs/BRANCH_PROTECTION.md` — step-by-step ruleset config on GitHub. Jay still needs to enable this manually; the doc only tells him how.

**Workflow direction Jay declared at session close:**
> "Work directly with DEV/TEST but we can do the sync of changes into PROD for a seamless experience."

Concretely:
- Feature branches → Vercel auto-creates Preview deploy with TEST Stripe keys (because of the env scope split done this session)
- Test changes on Preview URL with test cards
- PR review → merge to `main` → Production auto-deploys with LIVE keys
- Branch protection on `main` enforces this once Jay enables it on GitHub
- This is now the formally documented workflow; ad-hoc `git push origin main` should stop after the next session

**Discovered + documented this session — Google Owner-account reauth policy:**
The cleanup task that was supposed to delete a batch of test-user Firestore docs was blocked by two consecutive auth issues:
1. Local `FIREBASE_ADMIN_PASSWORD` in `.env.local` is stale (returns `INVALID_LOGIN_CREDENTIALS` against Firebase Auth REST). Not refreshed yet.
2. `gcloud auth print-access-token` (which would have bypassed Firestore rules entirely via IAM) fails in non-interactive shells with "Reauthentication failed. cannot prompt during non-interactive execution." The `admin@fanbasetickets.net` account has an org-level policy that forces a fresh interactive auth challenge on every token fetch, presumably because it has IAM Owner on a billing-enabled project. The `gcloud auth login` Jay ran earlier worked, but the next non-interactive call still hit the reauth wall.
- **Documented unblock options for next session:** either refresh `FIREBASE_ADMIN_PASSWORD` in `.env.local` from Vercel (10 sec, but the password keeps going stale), OR have Jay run `gcloud auth print-access-token` himself interactively and paste the resulting 1hr-valid token (better — IAM bypass means the password staleness stops mattering for admin scripts).
- `scripts/cleanup-test-users.mjs` was written and tested locally end-to-end except for the auth step; deleted before commit to keep the working tree clean. Logic is preserved in conversation history; recreate in 1 prompt next session when auth works.

**Commits shipped today, post-`c8d13c0` shutdown:**
- `3058acc` debug: temp stripe key diagnostic route
- `3829b64` chore: retrigger deploy — debug-stripe stuck initializing
- `b9bfad4` chore: remove temp stripe debug route — live keys verified
- `fd216af` chore: dev/prod environment separation — `.env.example`, `.gitignore` update, `DEVELOPMENT.md`, branch protection docs

### Phase 5 continued (June 7, 2026 — earlier session) — Pre-live-keys flip: legal docs, signup race round 2, save-account-metadata auth fix, Stripe env-var standardization, live products + coupons created in Stripe

Last session before the live-keys flip. Focus shifted from launch-blocker firefighting to legal/compliance polish + closing the last race conditions + setting up the Stripe live configuration. Jay completed the Stripe-side manual work (live products + coupons + price IDs captured) so the next session is mechanical: webhook + Vercel env split + redeploy + verify.

**Code shipped (7 commits):**
- **Phase 3 added to `ROADMAP.md`** — YardSync Community & Visibility Platform (parallel to Phase 2 post-launch growth): YardSync-branded Facebook page with contractor spotlights, invoice-backed verified review system (clients opt-in at payment), location-based contractor discovery at `/contractor/[slug]`, AI visibility engine (volume-threshold promotion), monetization tiers (Base/Boosted/Featured). Strategic anchor: invoice-backed reviews are stronger trust than any self-reported platform; flywheel = clients → invoices → reviews → visibility → clients. Old Phase 3 (Scale & Partnerships) renumbered to Phase 4. (commit `02d0336`)
- **Settings Volume Reward Tracker fix** — `loadMonthlyVolume()` called `getInvoices(user.uid)` but the symbol was missing from the `lib/db` import on line 13. Every Settings mount was throwing `ReferenceError: getInvoices is not defined` inside the tracker, silently falling back to `monthlyVolume = 0` — every Stripe-connected contractor's tier progress bar was wrong. Added `getInvoices` to the import and added `paymentPath === 'stripe'` filter to the volume sum (defense vs legacy pre-April Square invoices that don't carry the 5.5% application fee). (commit `e32dcda`)
- **Privacy Policy + Terms of Service comprehensive rewrite** (commit `33d7a5d`):
  - Privacy → 11 sections. New: Cookies and Tracking (§4), Your Rights w/ Texas TDPSA 45-day response window (§7), Children's Privacy under 13 (§8), Image and File Storage (§9). Updated: Section 2 adds logo files + usage data (IP/browser/device/pages) + platform communications; Section 3 removes Square + adds Anthropic Claude API + logo display on payment pages; Section 6 (Data Sharing) vendor list now Firebase / Stripe / Twilio / Anthropic + adds retention + permanent-deletion language; Contact (§11) adds Texas governing law.
  - Terms → 18 sections. New: Stripe Payment Processing w/ Connected Account Agreement reference + destination-charges + JNew as merchant of record (§5), Intellectual Property and Your Data (§7), User Content (§8), Prohibited Uses (§9), Account Termination (§11), Indemnification (§13), Force Majeure listing Stripe/Twilio/Firebase/Anthropic (§14), Dispute Resolution w/ TX governing law + Bexar County AAA arbitration + class action waiver (§15), General w/ severability + waiver + entire agreement (§17). Section 2 drops Square, adds AI-assisted SMS drafting + logo storage. Spec implied 10/15 sections (would have dropped Data Security + User Responsibilities + Limitation of Liability + Changes to Terms) but those were preserved per "preserve all existing content" rule — final counts 11/18 with Contact at the end of each.
- **Signup cold-start race round 2** — the `11cc3d1` eager `setUser/setProfile/setLoading` fix from June 3 wasn't enough. On a particularly cold Vercel lambda, AppShell still mounted on `/dashboard` with `user=null` before the new context state propagated to the new component tree, fired its redirect-to-login guard, login bounced back when Firebase finally hydrated, ping-pong. Fix: `signingUpRef = useRef(false)` in AuthContext, set true at the top of `signUp()` + `signInWithGoogle()` before the Firebase call, cleared via `setTimeout(..., 5000)` after the navigation + auth-hydration window. Exposed through context as `signingUp: signingUpRef` (ref, not state — no re-render churn). AppShell login-redirect guard and 4s subscription timeout both bail when `signingUp.current === true`. Email-password `signIn()` is NOT covered per spec; if cold-start race shows up on email login, same three-line pattern applies. (commit `cea72fb`)
- **`/api/stripe/connect/save-account-metadata` 500 → auth fix + retry + 202** — Scenario A4 hit a Vercel 500 with 310ms response time and no detail. Root cause was the route was making an *unauthenticated* Firestore REST GET against `users/{uid}` — Firestore rules' `isAdmin()` check fails without an ID token, so Firestore returns 403 PERMISSION_DENIED, `res.ok` is false, route bails with generic 500. The retry-loop spec assumed a webhook race (which was a secondary risk) — actual proximate cause was auth, and the spec's `userDoc.fields.X.stringValue` shape would have been a separate bug since `firestoreRest.getDocument` returns `{ id, name, data }` already-unwrapped. Fix: use `firestoreRest.getDocument` + 5-attempt exponential backoff (500ms → 1s → 2s → 4s → 8s, ~10s worst case) reading `userDoc.data.stripeSubscriptionId`. 202 'skipped' returned when either field is still missing after retries — metadata write is informational (used by reward cron for volume attribution), not gating onboarding. Detailed `[save-account-metadata]`-prefixed logs at every step. ConnectStripeContent ordering verified correct — no change needed there. (commit `8366b18`)
- **Stripe price env var standardization** — `app/api/stripe/reactivate-subscription/route.js` was the lone holdout using `STRIPE_ANNUAL_PRICE_ID` / `STRIPE_MONTHLY_PRICE_ID` (with `_ID` suffix). Every other route — checkout, webhook, upgrade, cron/health — uses `STRIPE_PRICE_ANNUAL` / `STRIPE_PRICE_MONTHLY` (no suffix). Would have silently broken cancel→reactivate flow during the live-keys flip when Jay set the non-suffix names per the rest of the codebase: `priceId` would have been `undefined`, Stripe API would have errored on "No such price". Fixed in 2 lines. Grep confirmed zero remaining occurrences of the old names in `app/`. (commit `73d3727`)

**Stripe live setup completed manually by Jay (no code change):**
- Live products created: Monthly ($39/mo), Annual ($390/yr), Pro Setup ($99 one-time)
- Live price IDs captured: `STRIPE_PRICE_MONTHLY = price_1Tfjx51qcLHs32s2RuiooKwH`, `STRIPE_PRICE_ANNUAL = price_1TfjyH1qcLHs32s2VEIY2KP0`, `STRIPE_PRICE_SETUP = price_1TfjzC1qcLHs32s2eSsZqOAu`
- Live coupons created: `YARDSYNC_FREE` (100% off forever, for $3000+/mo Volume Reward Tier 3) + `YARDSYNC_50OFF` (50% off forever, for $1500-2999/mo Volume Reward Tier 2)

**Stripe live webhook NOT yet created** — first task next session. Live endpoint at `https://yardsyncapp.com/api/stripe/webhook` with same event list as the test endpoint emits its own `whsec_…` signing secret.

**Vercel env-var Production-vs-Preview split plan documented in this session** but not executed. 6 variables need to split:
1. `STRIPE_SECRET_KEY` — test in Preview/Dev, sk_live in Production
2. `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` — test in Preview/Dev, pk_live in Production
3. `STRIPE_WEBHOOK_SECRET` — test whsec in Preview/Dev, live whsec (from step above) in Production
4. `STRIPE_PRICE_MONTHLY` — test price in Preview/Dev, `price_1Tfjx51qcLHs32s2RuiooKwH` in Production
5. `STRIPE_PRICE_ANNUAL` — test price in Preview/Dev, `price_1TfjyH1qcLHs32s2VEIY2KP0` in Production
6. `STRIPE_PRICE_SETUP` — test price in Preview/Dev, `price_1TfjzC1qcLHs32s2eSsZqOAu` in Production
Plus the public price-id variants (`NEXT_PUBLIC_STRIPE_PRICE_MONTHLY/ANNUAL`) need the live IDs in Production too.

**Non-Stripe vars stay common across all environments:** Firebase config (single Firestore project), Twilio (single A2P-approved Messaging Service), SendGrid, Anthropic, CRON_SECRET, ADMIN_EMAIL, ADMIN_PHONE_NUMBER.

**Recurring environmental blockers (still unresolved on Jay's local machine):**
- `FIREBASE_ADMIN_PASSWORD` in `.env.local` is stale — every attempt at a one-off Firestore admin operation (Victor lookup, jay+scenarioa3 delete) fails with `INVALID_LOGIN_CREDENTIALS`. Workaround: do these via Firebase Console.
- `CRON_SECRET` is only in Vercel (rotated June 3 manually), not in `.env.local` — can't trigger `/api/cron/health` or `/api/cron/sms` from the dev machine without pasting the secret in by hand each time.
- One-time setup fix: paste fresh values for both into `.env.local` (stays gitignored). Then future cron triggers + Firestore admin queries run straight through.

### Phase 5 continued (June 3, 2026 — late late session) — All 4 SMS-sweep launch blockers closed + signup polish + Firebase CLI now wired

Following the SMS sweep that found 4 launch blockers, this session knocked them all out plus stacked on additional polish.

**Launch blockers — all 4 resolved:**
1. ✅ Cron SMS Firestore auth — refactored `cron/sms/route.js` to use `lib/firestoreRest.js` (commit `ae1407e`). Added a new `listCollection(collectionId, options)` helper to firestoreRest.js supporting compound `where` filters (AND-combined via compositeFilter). All 3 send sites within cron/sms (per-schedule reminder, morning summary, fee reminder) migrated. Also fixed a latent ReferenceError: `now.getDate()` was called without `now` being declared at the top of the try block.
2. ✅ `cron/health/route.js` (separate from cron/sms — same bug class) — migrated to firestoreRest in commit `21d1a20`, then expanded in `529eb3d` with full audit: added Anthropic key check, `ADMIN_PHONE_NUMBER` env presence check, live Twilio API reachability (free account-info fetch), structured response shape `{ status, checks, timestamp }`, admin SMS notification on `degraded`/`down` status, removed Square checks (Square fully removed Apr 2026).
3. ✅ PhoneInput formatter — fixed `+1`/country-code mangling in `ae1407e`. Strips leading `1` when input is 11+ digits before slicing to 10 — handles `+19107230609`, `19107230609`, `9107230609`, `+1 (910) 723-0609`, `1-910-723-0609`. False-green validation eliminated for under-10-digit inputs.
4. ✅ Webhook Q11 fields — fixed in `ae1407e`. Two cascading bugs: (a) the retrieve+expand approach for `latest_charge.balance_transaction.fee` returned null on destination charges (BT lives on the connected account, not the platform), so the field-write block was always skipped, and (b) `invDoc.applicationFee` was always undefined because `queryCollection` returns `{ id, name, data }` — the read was missing `.data.`. Replaced with formula: `stripeProcessingFee = round(amount × 0.029) + 30`; `netToPlatform = applicationFee - stripeProcessingFee`. Always writes both fields when invoice is marked paid.

**Signup polish:**
- Confirm-password field added to signup form (commit `bcc87ed`) — EN/ES, match validation, independent show/hide eye toggle. Validation error messages now language-aware (previously hardcoded English).
- LogoUpload component (`components/ui/LogoUpload.js`) added — PNG/JPG/WebP, 2MB cap, uploads to `users/{uid}/logo.{ext}` in Firebase Storage. Self-contained: file picker, validation, upload, download URL, preview, remove.
- `lib/firebase.js` now exports `storage` via `getStorage(app)`.
- Settings Profile section integrated LogoUpload between Business name and Phone.
- `storage.rules` file in repo root with admin-only write + public read (so payment page can render contractor logos for clients without auth).
- Payment page logo display **deferred** to next session.

**Post-signup hang fix (commit `11cc3d1`):**
- Initial fix `e23c65d` (write explicit `subscriptionStatus: 'none'`) was verified still in place but a SECOND race surfaced on cold Vercel lambdas: AppShell mounts on `/dashboard` with `user=null` because `onAuthStateChanged` hasn't propagated yet — fires its redirect-to-login guard, bounces to `/login`, login page bounces back to `/dashboard`. Two cold-starts + two AppShell mounts ≈ 11s user-visible hang.
- Subagent (`firebase-firestore`) diagnosed via Option D: eagerly populate `setUser(cred.user)` + `setProfile(profileData)` + `setLoading(false)` inside `signUp()` and `signInWithGoogle()` so AuthContext is already populated by the time `router.replace('/dashboard')` fires. `onAuthStateChanged` re-sets the same values after (idempotent, no flicker).
- Instrumentation log added to AppShell's redirect-to-login guard so if this ever fires from a post-signup mount despite the fix, Vercel logs will surface it.
- AppShell 4s timeout log wording tweaked (`9faf920`) to match diagnostic spec.

**Firebase CLI now wired (commits `f1367f5` + deploy):**
- `firebase.json` scaffolded — points firestore rules → `firestore.rules`, storage rules → `storage.rules`. No hosting/functions config.
- `.firebaserc` pins default project to `yardsync-41886`.
- Both `firebase deploy --only firestore:rules` and `firebase deploy --only storage` now succeed on this machine when prefixed with `NODE_OPTIONS="--use-system-ca"` (Windows Schannel doesn't ship Node's bundled CA trust for Google API endpoints — same root cause as the `npm run build` issue earlier in the project).
- Storage rules + Firestore rules deployed via CLI this session. No more Console paste-and-publish dance for future rule updates.
- Firebase project was upgraded to Blaze plan during this session to enable Storage (was on Spark, which doesn't include Storage).

**Side cleanup:**
- Test contractor `jay+scenarioa2@fanbasetickets.net` (UID `3kqD9Z0zMWSxEX3tROJXOQE2Qfk1`) deleted from Firestore. No Stripe customer existed. Firebase Auth deletion pending (admin can't via REST — Jay manual via Console).

**Discovered during session — bash quirk worth knowing:**
- `UID` is a readonly built-in in bash (holds the current OS user's numeric ID). Assigning `UID=...` in a script silently fails — use a different name like `TARGET_UID`. Caught when a Firestore delete went to `users/197609` (Jay's Windows user ID) instead of the actual target doc.

### Phase 5 continued (June 3, 2026 — late session) — Comprehensive SMS sweep + status-callback infra + STOP enforcement + 4 launch blockers found

The single most thorough pre-launch testing session to date. Ran all 8 outbound SMS paths systematically, built delivery-status infrastructure, fixed compliance gaps, and surfaced 4 launch blockers that would have shipped silently.

**Infrastructure shipped:**
- `app/api/twilio/status-callback/route.js` (commit d86508a) — receives Twilio's per-message status events (queued/sent/delivered/undelivered/failed), verifies X-Twilio-Signature, writes snapshots to `smsStatus/{MessageSid}` Firestore collection. Every outbound SMS site now passes `StatusCallback` URL with context (ctx + scheduleId/clientId/gardenerUid) so the callback can link the delivery state to a business event.
- Firestore `smsStatus` collection rule (admin-only read+write, commits adf97ca → f6646fe). Reads scoped tight because docs contain client phone numbers; broadening for contractor UI requires `gardenerUid` scoping.
- Soft-mode signature verification on the callback (commit 4d017d2) — URL reconstruction in the Vercel proxy environment doesn't match Twilio's signing URL yet, so signatures fail. Logs the diagnostic but writes to Firestore anyway. **TODO post-launch:** capture a successful verification, then tighten back to hard-reject (logged in tech debt).
- **Server-side STOP enforcement** on every outbound send path (commit 0195180): `/api/twilio/send`, `/api/cron/sms` × 3 sites, plus webhook admin SMS. Detection regex covers both EN (`Reply STOP to opt out`) and ES (`Responda STOP para cancelar`); appends the language-appropriate STOP line if neither pattern is present. Defense-in-depth — 12 of 14 active contractors have legacy custom templates without STOP language.

**SMS sweep — 8 paths exercised:**
1. AI drafter EN → ✅ delivered + verbatim received
2. AI drafter ES → ✅ delivered + natural Latin American Spanish
3. Manual `/sms` page Send → ✅ template + calendar link + server-appended STOP
4. Manual `/sms` page Resend → ✅ new MessageSid, schedule doc updated to latest
5. Invoice payment link SMS → ✅ delivered single-segment, payment link works on Android
6. Pro Setup admin SMS (webhook) → ✅ (was filtered to spam earlier; whitelisted)
7. Daily cron reminder → ❌ **BROKEN** (PERMISSION_DENIED — cron uses Firebase client SDK with no auth context, Firestore rules reject all queries)
8. Cron morning summary + fee reminder → ❌ same root cause as #7

**Revenue flow verified end-to-end (Phase G):**
- Invoice created → Stripe PaymentIntent with `application_fee_amount: 495` (5.5% of $90), `transfer_data.destination` to Scales Cuts' Connect account
- SMS with payment link delivered to client phone
- Client tapped link → Stripe-hosted payment page loaded
- Test card 4242 4242 4242 4242 → Stripe charged → webhook fired → invoice flipped to `status: paid`, `paidAt` populated, `contractorReceives: 8505` ($85.05)
- All math exact, destination-charge model correct down to the cent

**4 launch blockers surfaced** (see Section 14 roadmap):
1. 🔴 Cron SMS routes (sms/billing/quarterly/reward-check) use Firebase client SDK without auth context — Firestore rules deny all queries. Daily reminders silently fail in production. Needs refactor to `lib/firestoreRest.js` pattern (same as Stripe webhook).
2. 🔴 `PhoneInput` formatter mangles `+1...` numbers to `(191) XXX-XXXX` with false green-check validation. Real contractors pasting numbers with country codes silently save broken phones.
3. 🔴 Webhook NOT writing `stripeProcessingFee` + `netToPlatform` on paid invoice (CLAUDE.md backlog "Smoke test PR 2" item — now confirmed via Phase G payment).
4. 🔴 `CRON_SECRET` value is `yardsync-cron-2026` — easily guessable. Anyone hitting the cron endpoint could trigger SMS sends at YardSync's expense.

**Polish items (15+, all post-launch):** AI drafter doesn't pre-fill from next scheduled visit; calendar day-cell numbers lack legend; fixed mobile-only shell on desktop; date format inconsistencies; AI drafter Spanish prompt outputs English STOP; segment cost optimization for emoji/UCS-2; `/api/ical` UA detection for Android vs iOS; `/sms` page Resend lacks duplicate-send guard; stat counters double-count on resend; invoice modal "Text" button label terse; `Hi SMS!` first-token name parsing reads odd on business names; Add Job modal default is 8 recurring visits; Add Job helper text stale after picking "Just this once"; `Remove client` destructive action lacks visual differentiation; AI drafter button loading state subtle; `/sms` full-screen loading flash inconsistent with rest of app.

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

### 2026-06-18 — Live E2E test + 5-PR cleanup sweep
- **Live production E2E test (Jay)** — full signup → subscription ($39 monthly) → Stripe Connect onboarding → add client → schedule 6 recurring visits → AI Draft SMS → STOP enforcement → manual SMS → $1 invoice → real card payment → webhook → cancellation. All critical paths working. Verified the launch-blocker `stripeProcessingFee` + `netToPlatform` webhook persistence on a live paid invoice (was the last unverified item from the June 3 launch-blocker batch).
- **11-item punch list** surfaced during the E2E test, broken into 5 small PRs:
- **PR #6 (merged) — Copy + label + receipt branding (`fix/copy-label-receipt-branding`):** RewardsIntroModal `$19/mo` → `$19.50/mo`; service-address placeholder format hint EN+ES; "Stripe fee (5.5%)" → "YardSync fee (5.5%)" EN+ES; **Stripe PaymentIntent `on_behalf_of: stripeAccountId`** so receipts say "Receipt from {contractor business name}" instead of the platform account name (JNew Technologies — shared with FanBase Tickets, can't be globally renamed). Generalized `'YardSync lawn service invoice'` → `'YardSync invoice'`. Also added `lib/baseUrl.js` so `/api/stripe/checkout` success_url and `/api/stripe/invoice` paymentUrl read the request's actual host instead of `NEXT_PUBLIC_APP_URL` — fixes Preview signups bouncing to production after Stripe Checkout.
- **PR #7 (merged) — SMS UX (`fix/sms-ux-and-schedule`):** /sms template edit now persists via `saveGardenerProfile({ smsTemplate, smsTemplateEs })` on Done + exposes ES textarea (previously the textarea was cosmetic — Done toggled it away without saving). Added `users/{uid}.smsSentTotal` field incremented by `/api/twilio/send` on every successful send; dashboard + /sms page now read from it (previously both counters undercounted because the AI-drafter send path doesn't update a schedule doc). Added `Schedule visits` CTA on client detail page that navigates to `/calendar?client={id}` and auto-opens the Add Job modal pre-filled.
- **PR #8 (merged) — Subscription cancellation persistence (`fix/subscription-cancellation-ux`):** Webhook `customer.subscription.updated` now writes `subscriptionCancelAtPeriodEnd` + `subscriptionCancelAt` to the user doc (canonical state). Settings shows a "Cancellation pending · ends {date}" banner with a Reactivate button when set. Cancel link auto-hides while pending. `customer.subscription.deleted` clears both fields. Verified: cancel → Stripe shows `cancels Jul 18` + Firestore reflects → reactivate → both clear. Closes a real chargeback risk (cancel, forget, get billed once more, dispute).
- **PR #9 (merged) — Stripe API drift + invoiceType (`fix/stripe-period-end-and-invoice-type`):** Root-cause for CLAUDE.md Known Bug #1 found: Stripe API 2025-06-30 (Acacia) moved `current_period_end` from the Subscription object onto its items, so `subscription.current_period_end` returned undefined on newer versions → null-guard wrote null. New `lib/stripeHelpers.js` `getSubscriptionPeriodEndISO()` checks both locations; applied to 4 webhook sites + cancel-subscription return. Also added `computeInvoiceType(lineItems)` so `/api/stripe/invoice` derives type from lineItem categories (`base only → recurring`, `addons/materials only → addon`, `base+extras → combined`) instead of callers hardcoding `'recurring'`. Removed hardcoded values from all 3 callers.
- **PR #10 (merged) — Stripe Connect requirements remediation (`feat/connect-requirements-remediation`):** End-to-end remediation for blocked-payout KYC requirements. New webhook handler for `account.updated` persists `stripeRequirementsCurrentlyDue` + `eventuallyDue` + `pastDue` + `disabledReason` + `chargesEnabled` + `payoutsEnabled` to user doc. New `lib/stripeRequirementLabels.js` translates technical Stripe paths (`individual.ssn_last_4`, `individual.dob.day`, etc.) to EN/ES human-readable labels with dedup. New API routes: `/api/stripe/connect/remediation-link` (contractor self-service, returns AccountLink URL) and `/api/admin/send-stripe-remediation` (admin sends link + SMS + email to contractor). Settings page banner with "Complete on Stripe" button for contractors. Admin dashboard widget "N contractors needs Stripe info" with per-row Send/Resend buttons. **Follow-up commit** added multi-secret webhook signature verification — modern Stripe Workbench issues a separate signing secret per destination, so connected-account events need a second `STRIPE_WEBHOOK_SECRET_CONNECT` env var (Production scope live, Preview/Dev deferred — see Section 13).
- **🔴 Critical infrastructure bug surfaced + fixed during E2E test:** Orphan `FIREBASE_API_KEY` env var in Vercel (set "All Environments" with the **production** API key value) was overriding the per-environment `NEXT_PUBLIC_FIREBASE_API_KEY` in `lib/firestoreRest.js`'s fallback chain. Result: every server-side firestoreRest write from Preview deployments had been silently failing with `INVALID_LOGIN_CREDENTIALS` since the dev/prod Firebase project split (2026-06-14). Symptoms hidden by try/catch around every write. Discovered when PR 7's SMS counter wouldn't increment in Preview. Fixed by deleting the orphan; firestoreRest now falls back to the correctly-scoped `NEXT_PUBLIC_FIREBASE_API_KEY`. After fix: all firestoreRest writes verified working in Preview.
- **Manual Stripe Dashboard config (Jay):** Created live-mode `yardsync-production-connect` webhook destination — scope "Connected accounts", listening to `account.updated`, points to `https://yardsyncapp.com/api/stripe/webhook`. Stripe issued a new signing secret (different from the platform destination's), added to Vercel as `STRIPE_WEBHOOK_SECRET_CONNECT` (Production scope). Webhook code's multi-secret verification now accepts events signed by either secret. Test-mode connect destination deferred to the architecture-separation workstream.

### 2026-06-19 — Smart Business Card rev 3 card-first build (PR queued for review/merge tomorrow)
- **Feature complete on `chore/preview-env`, awaiting merge.** 24 commits, 15 CC test scenarios all PASS. Branch is 24 commits ahead of `main`.
- **`/join/[slug]` redesigned as a digital business card** (was the intake form). Hero (headshot/logo/initials avatar), business name, tagline, "Now booking" badge, bio (300-char), service area, services line, primary "Request service" CTA, secondary [Save] [Call] [Text] icon row, server-rendered QR SVG, "Powered by YardSync" mark. Mobile-first single column, bilingual EN/ES (auto-detect + toggle), accent-color themed per contractor.
- **`/join/[slug]/request` — new route** hosting the intake form. Compact identity header + "View full card" back-link + Save/Call/Text row + form. Where the on-card QR + printed/social QR codes land. No-JS native `<form>` fallback intact.
- **vCard download at `/api/join/[slug]/vcard`** — `lib/vcard.js` builds vCard 3.0 with TEL in E.164 (`+1XXXXXXXXXX`). TEL/EMAIL gated by `showContactPhone` / `showContactEmail` flags. Plain anchor on the card, works without client JS.
- **Settings → YardSync Card section** — live `CardPreview` tile (no save needed to see changes), bio (300-char counter), `showContactPhone` (default ON), `showContactEmail` (default OFF — opt-in), `cardStatusBadge` ('booking'/'none'), accent color picker, **Direct intake link** (`/request`) alongside the card URL for warm-lead workflows, contextual "Save card changes" button so contractors don't have to scroll to the bottom.
- **New `users/{uid}` fields:** `bio`, `showContactPhone`, `showContactEmail`, `cardStatusBadge`, `email`, `publicSlug`, `headshotURL` (Phase B), `tagline`, `serviceArea`, `accentColor`, `upfrontDeadlineHours`, `previousSlugs`.
- **New collections:** `slugs/{slug}` (resolver, forward-compat with future Crew tier — `ownerType` + `ownerUid`) and `rateLimits/{slug}` (10-submissions/hour spam throttle). Firestore rules added (admin-only, all access via `firestoreRest`).
- **Slug system:** validation regex `^[a-z0-9-]{3,50}$`, reserved blocklist (admin, api, app, dashboard, login, signup, settings, pay, sms-opt-in, privacy, terms, clients, calendar, services, sms, onboarding, join, **request**), collision suffix `-2`/`-3`/..., 30-day old-slug redirect window with `previousSlugs` trail.
- **New Leads UI in `/clients`** — "New leads (N)" section above the regular client list with brand-50 cards. Each lead shows name, age, language/SMS-consent pills, clickable phone/email, address, service interest, note, possible-duplicate hint. Two actions: **Accept** (→ `leadStatus:'accepted'`, `billingMode:'upfront'`, `completedJobsCount:0`, `status:'active'`) or **Dismiss** (→ `leadStatus:'dismissed'`, soft-delete for audit + duplicate detection). Regular client list excludes `leadStatus IN ('new','dismissed')`.
- **Trust-state billing mechanic (spec §6) — webhook + UI complete.** `invoice.payment_succeeded` idempotently increments `clients/{clientId}.completedJobsCount` (per-invoice `countedTowardTrust` guard). Client detail shows amber "first-time-upfront" banner when count===0, then a one-time brand-50 "switch to post-visit?" prompt when count>=1. Either prompt button sets `billingModePrompted=true` so it never re-shows.
- **Per-client `upfrontDeadlineHours` override** in the client edit modal (visible only for upfront billing; range 1-168; blank inherits the contractor's Settings default). Global default already plumbed in Settings → Payment reminders.
- **`lib/invoiceSms.js`** — single source of truth for invoice payment-link SMS bodies. Picks first-time-upfront template (includes `{paymentDeadline}` substitution) vs. standard short template. Resolution order: `client.upfrontDeadlineHours` → `contractor.upfrontDeadlineHours` → 24. EN + ES, both single-segment (90-118 chars). Wired into 3 SMS-send sites: client detail invoice, calendar scheduled invoice, calendar walk-in invoice. Walk-ins always get standard (no client doc).
- **Bug class fixed mid-build: Settings form-init useEffect** was re-firing whenever AuthContext yielded a new profile reference (focus events, token refresh, background re-renders), which silently overwrote user edits within ~1 render of a checkbox click. Symptom: CardPreview toggles "snapped back" to defaults. Fixed via `useRef`-guarded one-shot initialization — form initializes from profile exactly once on first load; subsequent profile reference changes don't stomp form state. Color/text edits "worked" before only because keystrokes fired faster than the snap-back.
- **Bug class fixed mid-build: `/join/[slug]/request` client-side crash** — `ReferenceError: slug is not defined`. Contact-row code referenced `slug` inside the `Page` subcomponent which only took `{ owner, lang, setLang, t, children, backLinkHref }` as props. Added `slug` to Page's destructured props + both invocation sites.
- **Bug class fixed mid-build: dismissed leads leaking into the regular client list as "inactive"** — initial filter only excluded `leadStatus === 'new'`. Dismissed docs (`leadStatus === 'dismissed'`, no `status` field set) fell through to inactiveCount. Filter now excludes both `'new'` and `'dismissed'`.
- **Bug class fixed mid-build: vCard TEL emitted 10-digit format** — not E.164. Now normalizes: `9107230609` → `+19107230609`.
- **Vercel deployment-protection (Hobby tier)** — was blocking real-phone QR scans on Preview because the *.vercel.app domain required Vercel-team login. Jay toggled "Require Log In" OFF entirely (Hobby tier doesn't expose "Only Production Deployments" — that's a Pro feature). App-level Firebase Auth still gates everything sensitive; the Vercel layer was redundant for an app that has its own auth.
- **Workflow lesson logged in CLAUDE.md: Vercel Preview URL aliases** — the immutable hash URL (`yardsync-{hash}-...vercel.app`) is frozen on one commit; the rolling git-branch alias (`yardsync-git-{branch}-...vercel.app`) auto-tracks the latest commit. Always test the alias. CC initially hit the immutable URL during Direct-intake-link verification and reported the feature "missing" because the URL was stale.
- **Methodology lesson surfaced by CC:** test-harness tools that set `checked` directly without dispatching React's synthetic `onChange` event will cause controlled checkboxes to look "unchecked in DOM but state unchanged" — exactly the false-negative pattern that initially blamed the live-toggle gating. Real mouse clicks are the right verification path for controlled inputs. Worth pinning for future regression work.
- **Phase B (asset generation) + i18n consolidation deferred** to follow-up PRs after this one merges. `lib/cardTemplate.js` will codify a framework-neutral composition spec that both the digital card and the print/social generator read, so the hero is pixel-consistent across all formats.

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

### 14. Orphan `FIREBASE_API_KEY` env var silently breaking all firestoreRest writes from Preview
**Error:** Every server-side firestoreRest write from Preview deployments was returning `INVALID_LOGIN_CREDENTIALS` then `403 PERMISSION_DENIED`, but the symptom was hidden by try/catch around every call site. Surfaced when the new SMS counter in PR 7 wouldn't increment in Preview.
**Cause:** Vercel env had a non-NEXT_PUBLIC `FIREBASE_API_KEY` set to "All Environments" with the **production** (`yardsync-41886`) API key value. `lib/firestoreRest.js:10` reads `FIREBASE_API_KEY || NEXT_PUBLIC_FIREBASE_API_KEY` — preferring the (mis-scoped) unprefixed one. So Preview deployments authenticated against yardsync-41886 instead of yardsync-dev, using yardsync-dev's password → mismatch.
**Fix (manual, 2026-06-18):** Deleted the orphan `FIREBASE_API_KEY` row in Vercel. The fallback to `NEXT_PUBLIC_FIREBASE_API_KEY` (which IS correctly per-environment) now takes effect. Diagnosed by adding step-by-step console logs to `/api/twilio/send`'s counter increment.

### 15. Modern Stripe Workbench separates platform vs connected destinations with different signing secrets
**Error:** Subscribing to `account.updated` events from connected accounts required a second Stripe webhook destination ("Connected accounts" scope). The new destination gets its own signing secret — `stripe.webhooks.constructEvent` against the platform destination's secret would 400-reject every connect event.
**Cause:** Stripe Workbench architectural change — destinations no longer share a signing secret across event scopes.
**Fix (2026-06-18, commit `02bbb5b`):** New `verifyWebhookSignature()` in `/api/stripe/webhook` tries each configured secret in turn (`STRIPE_WEBHOOK_SECRET`, `STRIPE_WEBHOOK_SECRET_CONNECT`), returns the first event that verifies, throws if none do. Connect secret is optional — if env var unset, the fallback simply isn't tried (no environment regresses).

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
14. ~~**Twilio status-callback webhook not wired**~~ — RESOLVED 2026-06-03 (commit d86508a). Status events now write to `smsStatus/{MessageSid}` Firestore collection. Soft-mode signature verification (item 17) still TODO.
15. **Cron SMS routes use Firebase client SDK with no auth context** — Firestore rules deny all queries. Daily SMS reminders / morning summaries / fee reminders silently fail in production. Cron infra was migrated away from firebase-admin but the cron files still use the unauthenticated client SDK. Refactor to `lib/firestoreRest.js` pattern (~1-2 hours). Discovered via SMS sweep cron-trigger probe 2026-06-03.
16. **`PhoneInput.js` formatter mangles country-code phones** — entering `+1 (910) 723-0609` becomes `(191) 072-3060` with false-green validation. Real contractors pasting from email signatures / CRMs will silently save broken numbers. Discovered Phase A of SMS sweep.
17. **Status-callback signature verification in soft-mode** — Vercel proxy URL reconstruction doesn't match Twilio's signing URL. Currently logs mismatch but writes anyway. Tighten back to hard-reject once a successful verification is captured in production logs.
18. **`CRON_SECRET` is guessable** (`yardsync-cron-2026`) — rotate to a random 32+ char string (`openssl rand -hex 32`) before launch.
19. ~~**Webhook NOT writing `stripeProcessingFee` + `netToPlatform`**~~ on paid invoice — RESOLVED 2026-06-03 in commit `ae1407e`; verified live 2026-06-18 via E2E test $1 paid invoice (`stripeProcessingFee: 33`, `netToPlatform: -27` — math correct; -27 is the expected loss for sub-$5.45 invoices where Stripe's flat $0.30 exceeds the 5.5% app fee).
20. ~~**`currentPeriodEnd: null` on user docs**~~ — RESOLVED 2026-06-18 in PR #9. Stripe API 2025-06-30 (Acacia) moved the field onto subscription items; `lib/stripeHelpers.js` `getSubscriptionPeriodEndISO()` checks both locations.
21. ~~**Receipt branding shows JNew Technologies instead of contractor name**~~ — first fixed 2026-06-18 (PR #6) via `on_behalf_of` while on DESTINATION charges. NOTE (2026-06-30 audit): the 2026-06-24 DIRECT-charge migration (PR #37) removed `on_behalf_of` — it's a destination-charge concept, NOT needed for direct charges where the connected account is inherently the merchant of record, so the receipt + statement descriptor brand to the contractor by default. Current code (invoice/deposit/auto-charge PIs) intentionally omits it. Do NOT re-add it. ⚠️ Confirm with one LIVE receipt: send a real charge and check the "Receipt from" name + card-statement descriptor read the contractor, not JNew Technologies.
22. ~~**Subscription cancellation has no persistent UI feedback**~~ — RESOLVED 2026-06-18 in PR #8. Webhook persists `subscriptionCancelAtPeriodEnd` + `subscriptionCancelAt`; Settings banner with Reactivate button.
23. ~~**SMS counters undercounting (AI-drafter sends not tracked)**~~ — RESOLVED 2026-06-18 in PR #7 via `users/{uid}.smsSentTotal` server-side increment.
24. ~~**/sms template edit doesn't persist**~~ — RESOLVED 2026-06-18 in PR #7.
25. **`dynamic-bliss` Stripe Test-mode webhook destination disabled.** The old auto-named test-mode destination got disabled by Stripe (delivery failures — was pointing at `yardsyncapp.com` but production runs LIVE secrets so signature verification failed). This means TEST-mode webhooks currently don't fire to anywhere YardSync-related. Webhook side-effects on Preview test transactions silently don't happen (e.g., invoice doc isn't created in yardsync-dev Firestore after a Preview test payment). Architecture-separation workstream fixes this with a stable Preview URL.
26. **`STRIPE_WEBHOOK_SECRET_CONNECT` only set for Production scope.** Preview/Dev scope still missing — blocks Preview testing of the new PR #10 account.updated webhook handler. Test-mode connect destination + Preview secret added in the architecture-separation workstream.
27. **`getBaseUrl` helper only applied to `/api/stripe/checkout` and `/api/stripe/invoice`.** Other paths still use `NEXT_PUBLIC_APP_URL` directly (Twilio status-callbacks in `lib/sms.js`, `/api/twilio/send`, 3× cron sites, webhook Pro Setup admin SMS). Means SMS callback URLs embedded in Preview-sent messages still point at production. Architecture-separation workstream generalizes the helper.
28. **No `/api/admin/health-check` route.** Would catch silent firestoreRest misconfiguration (like #14 above) on cold-boot instead of relying on user noticing a feature doesn't work. ~1hr to implement.
29. **AI drafter Spanish prompt emits English STOP line.** Cosmetically inconsistent (A2P compliant either way). Low priority — fix during a future bilingual-reviewer pass.

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
- [x] ~~**🔴 LAUNCH BLOCKER — Refactor cron SMS routes** to `lib/firestoreRest.js` pattern~~ done 2026-06-03, commits `ae1407e` (cron/sms) + `21d1a20` (cron/health) + `529eb3d` (cron/health audit). billing + quarterly cron files have early-return dead-code paths — left alone per scope. reward-check already used firestoreRest.
- [x] ~~**🔴 LAUNCH BLOCKER — Fix `PhoneInput.js` formatter**~~ done 2026-06-03, commit `ae1407e`. Strips leading `1` when input is 11+ digits before slicing to 10 — eliminates the `+19107230609 → (191) 072-3060` false-green mangling.
- [x] ~~**🔴 LAUNCH BLOCKER — Fix Q11 webhook**~~ done 2026-06-03, commit `ae1407e`. Switched to formula `stripeProcessingFee = round(amount × 0.029) + 30` since destination-charge balance_transaction lives on the connected account, not the platform. Also fixed `invDoc.applicationFee` was always undefined (`queryCollection` returns `{ id, name, data }` — read was missing `.data.`).
- [x] ~~**🔴 LAUNCH BLOCKER — Rotate `CRON_SECRET`**~~ done 2026-06-03 (Jay rotated manually in Vercel from `yardsync-cron-2026` to random 32+ chars).
- [x] ~~Signup polish — confirm-password field + Settings business-logo upload (LogoUpload component, Firebase Storage rules)~~ done 2026-06-03, commit `bcc87ed`
- [x] ~~Firebase CLI wired (firebase.json + .firebaserc) — deploys work with NODE_OPTIONS=--use-system-ca on Windows~~ done 2026-06-03, commit `f1367f5`
- [x] ~~Storage rules + Firestore rules deployed via CLI~~ done 2026-06-03
- [x] ~~Firebase project upgraded Spark → Blaze~~ done 2026-06-03 (required for Storage)
- [x] ~~Post-signup 11-second hang regression — root cause = cold-lambda race between router.replace and onAuthStateChanged. Fixed by eagerly populating AuthContext state inside signUp/signInWithGoogle~~ done 2026-06-03, commit `11cc3d1`
- [x] ~~Phase 3 added to `ROADMAP.md` (YardSync Community & Visibility Platform)~~ done 2026-06-07, commit `02d0336`
- [x] ~~Settings Volume Reward Tracker `getInvoices` ReferenceError fix + `paymentPath === 'stripe'` filter~~ done 2026-06-07, commit `e32dcda`
- [x] ~~Privacy + Terms comprehensive rewrite (11 + 18 sections; Cookies, Your Rights w/ TX TDPSA, Children's Privacy, Image Storage, Stripe Connected Account Agreement, IP, User Content, Prohibited Uses, Account Termination, Indemnification, Force Majeure, Bexar Cty AAA arbitration + class action waiver, General; remove Square refs)~~ done 2026-06-07, commit `33d7a5d`
- [x] ~~Signup cold-start race round 2 (signingUpRef in AuthContext + guard in AppShell login-redirect + 4s subscription timeout)~~ done 2026-06-07, commit `cea72fb`
- [x] ~~`/api/stripe/connect/save-account-metadata` 500 root-cause fix (unauthenticated Firestore REST → firestoreRest.getDocument + retry + 202 on missing fields)~~ done 2026-06-07, commit `8366b18`
- [x] ~~Stripe price env var name standardized — `STRIPE_PRICE_MONTHLY` / `STRIPE_PRICE_ANNUAL` across all routes (reactivate-subscription was the lone holdout)~~ done 2026-06-07, commit `73d3727`
- [x] ~~Live Stripe products + price IDs + Volume Reward coupons created in Stripe (manual, no code change)~~ done 2026-06-07 (Jay) — Monthly `price_1Tfjx51qcLHs32s2RuiooKwH`, Annual `price_1TfjyH1qcLHs32s2VEIY2KP0`, Pro Setup `price_1TfjzC1qcLHs32s2eSsZqOAu`, coupons `YARDSYNC_FREE` (100% off) + `YARDSYNC_50OFF`

### Live-keys flip — DONE (2026-06-07 late session)
- [x] ~~Live Stripe webhook endpoint created at `https://yardsyncapp.com/api/stripe/webhook`, live `whsec_…` captured~~ done 2026-06-07 (Jay, manual)
- [x] ~~6 Vercel env vars split Production-only live vs Preview+Dev test~~ done 2026-06-07 (Jay, manual)
- [x] ~~Production redeployed~~ done 2026-06-07 (Jay, manual)
- [x] ~~Live mode confirmed via temporary `/api/debug-stripe` diagnostic route — `keyMode: "live"`~~ done 2026-06-07, commits `3058acc` → `b9bfad4`
- [x] ~~Dev/prod env separation scaffolded (`.env.test`, `.env.example`, `docs/DEVELOPMENT.md`, `docs/BRANCH_PROTECTION.md`, gitignore allowlist)~~ done 2026-06-07, commit `fd216af`

### Live E2E test + 5-PR cleanup — DONE (2026-06-18)
- [x] ~~Branch protection on `main` enforced~~ (confirmed active during this session — required PRs to merge)
- [x] ~~feat/* branch workflow muscle memory set~~ — 5 PRs (#6, #7, #8, #9, #10) shipped via the branch/PR cycle in one session
- [x] ~~Final live E2E test against yardsyncapp.com~~ — signup → Connect (Restricted → Enabled after first transaction) → AI Draft SMS + STOP enforcement → $1 invoice → real card payment → webhook → cancel → reactivate via Stripe dashboard. All paths working.
- [x] ~~PR #6 (copy + label + receipt branding `on_behalf_of` + Preview URL helper)~~ merged 2026-06-18
- [x] ~~PR #7 (SMS UX — template save + accurate counters + Schedule CTA)~~ merged 2026-06-18
- [x] ~~PR #8 (subscription cancellation persistence + Reactivate UI)~~ merged 2026-06-18
- [x] ~~PR #9 (Stripe API drift `currentPeriodEnd` fallback + invoiceType compute)~~ merged 2026-06-18
- [x] ~~PR #10 (Stripe Connect requirements remediation — account.updated webhook + admin widget + contractor banner + remediation link generator + multi-secret verification)~~ merged 2026-06-18
- [x] ~~Diagnose + fix orphan `FIREBASE_API_KEY` env var that was silently breaking all firestoreRest writes from Preview since 2026-06-14 dev/prod split~~ — Jay deleted the orphan in Vercel
- [x] ~~Create live-mode Stripe `yardsync-production-connect` webhook destination + add `STRIPE_WEBHOOK_SECRET_CONNECT` to Vercel Production scope~~ — Jay manual config
- [ ] **Begin outreach** — first San Antonio contractor cold-DM batch

### Architecture-separation workstream (next major piece of work)
The dev/prod Firebase split shipped 2026-06-14 but the surrounding infrastructure isn't fully separated yet. Multiple silent-failure paths surfaced during the 2026-06-18 E2E test. Tackle as a cohesive workstream:
- [ ] **Stable Preview URL alias** (e.g. `dev.yardsyncapp.com`) so Stripe test-mode webhooks have something deterministic to point at. Vercel domain alias on the latest Preview branch.
- [ ] **Re-create test-mode Stripe webhook destinations** pointing at the stable Preview URL — both `yardsync-test` (Your account scope) replacing the disabled `dynamic-bliss`, AND `yardsync-test-connect` (Connected accounts scope for `account.updated`).
- [ ] **Add `STRIPE_WEBHOOK_SECRET_CONNECT` to Vercel Preview/Dev scope** with the test-mode connect destination's signing secret.
- [ ] **Generalize `lib/baseUrl.js` `getBaseUrl()`** to all ~10 sites still using `NEXT_PUBLIC_APP_URL` directly: `lib/sms.js:38`, `app/api/twilio/send/route.js:36+68`, `app/api/cron/sms/route.js:108+206+283`, `app/api/cron/health/route.js:182`, `app/api/stripe/webhook/route.js:119`.
- [ ] **`/api/admin/health-check` route** — on each call, attempts a no-op `firestoreRest.getDocument('users', ADMIN_EMAIL)` and reports auth failure with diagnostic detail. Fail-loud on Vercel cron schedule (e.g. every 5 min) so silent misconfigurations like the 2026-06-18 `FIREBASE_API_KEY` orphan get caught within minutes instead of days.
- [ ] **Document the dev/prod environment matrix** in `docs/DEVELOPMENT.md` — which env vars are split per environment, which webhook destinations exist for which mode, the stable Preview URL pattern, the firestoreRest auth precondition.

### Post-launch
- [ ] `/invoices` index page (currently "coming soon" toast)
- [ ] Server-side duplicate invoice enforcement
- [ ] Reactivation path full testing (cancel → reactivate cycle) — partial verified 2026-06-18 (cancel + reactivate UI works; the "subscription fully ended → create new" branch of `/api/stripe/reactivate-subscription` not yet exercised)
- [x] ~~Remove dead Square routes + `square` package~~ done 2026-06-16 (PRs #4, #5)
- [ ] Remove `firebase-admin` from package.json (still listed though unused per org policy)
- [ ] Consider server-side auth on Stripe API routes
- [ ] **Test account teardown** — delete Jarius Johnson + JTest1 + JTest2 + other test accounts from Firestore (both yardsync-41886 + yardsync-dev) + Firebase Auth + Stripe customers. Refund the $39 subscription + $1 test invoice charges on Jay's real card. Blocks: should be done before serious outreach so real signups don't land in a Firebase project full of test data.

### Backlog (pre-launch, not gating)
- [ ] Wire payment page (`/pay/[paymentIntentId]`) to display contractor's `logoUrl` (trust signal showing client they're paying the right person) with YardSync as primary brand
- [ ] Verify on next signup: confirm `11cc3d1` + `cea72fb` actually close all cold-start races + logo upload works end-to-end on Settings
- [ ] Audit `users` collection for stale `setupFeePaid: true` flags
- [ ] Refresh `FIREBASE_ADMIN_PASSWORD` + add `CRON_SECRET` to local `.env.local` so future cron triggers + admin Firestore queries don't require Console pivots
- [ ] Delete `jay+scenarioa3@fanbasetickets.net` from Firestore + Firebase Auth (blocked on stale local admin password — via Firebase Console)
- [x] ~~Verify Twilio A2P registration approved~~ (done 2026-05-24, campaign Verified)
- [x] ~~Set `TWILIO_MESSAGING_SERVICE_SID=MG21e23c10d5d507045b0a1e263c0eb25b` on Vercel~~ (done 2026-05-24)
- [x] ~~SMS sweep — comprehensive end-to-end of every outbound SMS path~~ (done 2026-06-03, 6 of 8 paths green, 2 cron paths surfaced as broken — see launch blockers)
- [x] ~~Twilio status-callback webhook + smsStatus Firestore collection~~ (done 2026-06-03)
- [x] ~~Server-side STOP enforcement on every Twilio send site~~ (done 2026-06-03)
- [x] ~~Revenue flow E2E verified (invoice → SMS → payment → webhook → invoice-paid)~~ (done 2026-06-03 via Phase G real test-card payment)
- [ ] Full QA pass per QA_PHASE5_CHECKLIST.md
- [ ] Lawyer review of ToS Section 6 (Early Adopter Pricing Lock) before any volume marketing — note section number is now §6, not §5 (renumbered in 33d7a5d)
- [ ] Tighten status-callback signature verification from soft-mode to hard-reject (once production verifications confirm URL reconstruction is correct)
- [ ] Fix AI drafter Spanish prompt to use Spanish STOP line (currently emits English STOP on Spanish messages — A2P compliant but cosmetically inconsistent)

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
