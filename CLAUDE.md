# YardSync — Project Brief for Claude

> This file is auto-loaded at the start of every Claude Code session.
> Keep it current. Last updated: 2026-06-14 (end of session — dev/prod Firebase split LIVE, OAuth branding published, branch protection enabled).
>
> **Session startup:** When the user says "get up to speed", read `YARDSYNC_KNOWLEDGE_BASE.md`
> in the project root. That single file contains the full project history, architecture,
> every deployment breaker, business logic, and roadmap. One read = fully briefed.
> Do NOT re-explore the codebase — the knowledge base IS the exploration.
> At the end of significant sessions, update the knowledge base with what changed.
>
> **Day-to-day workflow:** See `docs/WORKING_GUIDE.md` for the build loop (feat branch → Preview → PR → merge), shutdown checklist, and operational conventions. Branch protection on `main` now enforces this — direct push to main is blocked.

## What is YardSync?

Bilingual (EN/ES) PWA for lawn care contractors. Built by Jay Johnson / JNew Technologies, LLC.
Contractors manage clients, schedule jobs, send Stripe invoices, track materials, and get SMS reminders — all from their phone.

**Revenue model (Stripe-only, Square fully removed April 2026):**
- $39/mo or $390/yr SaaS subscription
- 5.5% application fee on every invoice (Stripe Connect destination charges)
- $99 one-time Pro Setup add-on (we import the contractor's client list)
- Volume rewards: $1,500+/mo invoices for 2 months → 50% off sub; $3,000+/mo → free sub. The 5.5% per-invoice fee always applies.
- Early Adopter Pricing Lock: accounts created before April 15, 2028 lock in 5.5% for life (see terms page Section 5)

**Target market:** Hispanic lawn care operators — San Antonio first, then Houston, Dallas, Miami, LA.
**First customer:** none yet. Pre-launch. Marco is a TEST account used for dogfooding the contractor experience, NOT a paying customer.

## Tech Stack

- **Framework:** Next.js (App Router), JavaScript only (no TypeScript)
- **UI:** Tailwind CSS, DM Sans / DM Serif Display, dark mode admin dashboard
- **Auth + DB:** Firebase Auth + Firestore (client SDK only — see constraint below)
- **Payments:** Stripe Connect (Express accounts), Stripe Checkout for subscriptions
- **SMS:** Twilio (A2P registered)
- **Email:** SendGrid (@sendgrid/mail) for admin alerts + contractor onboarding emails
- **Hosting:** Vercel (yardsyncapp.com + yardsync.vercel.app, same deployment)
- **Icons:** lucide-react

## Critical Constraints (read before writing any server-side code)

### 1. No Firebase Admin SDK
The fanbasetickets.net Google Cloud org policy blocks service account key creation.
**All server-side Firestore writes use `lib/firestoreRest.js`** — it authenticates via Firebase Auth REST API (admin email + password → ID token → Firestore REST).
Required env vars: `FIREBASE_ADMIN_PASSWORD`, `FIREBASE_API_KEY` (or `NEXT_PUBLIC_FIREBASE_API_KEY`).
Never try to `import admin from 'firebase-admin'`. It will not work.

### 2. No Firebase imports in SSR/prerendered routes
Any page that imports from `@/lib/firebase` or `@/context/AuthContext` will crash the Vercel build if it's statically rendered. Solutions:
- Use `dynamic(() => import(...), { ssr: false })` for Firebase-dependent components
- Or ensure the route is fully client-side (`'use client'` + no server components importing Firebase)
- The landing page (`app/(landing)/page.js`) and signup page must NOT import Firebase

### 3. useSearchParams requires Suspense
If a page uses `useSearchParams()`, wrap it in a Suspense boundary or use `window.location.search` inside useEffect instead. Vercel build will crash otherwise.

### 4. Admin auth pattern
- Admin account: admin@fanbasetickets.net (Firebase Auth email)
- Admin check in client code: `user.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL`
- Admin check in API routes: verify Firebase ID token via REST `accounts:lookup` against `ADMIN_EMAIL` env var
- Firestore security rules also hardcode this email in `isAdmin()` function
- The admin dashboard lives at `/admin/dashboard` — navigated via `yardsync.vercel.app`

## Key Files

| File | Purpose |
|------|---------|
| `lib/firestoreRest.js` | Authenticated Firestore REST helper (shared by webhook + invoice + any server route) |
| `lib/email.js` | SendGrid wrapper — exports `sendAdminEmail({ subject, html, text })` |
| `lib/fee.js` | Fee calculation (5.5% application fee) |
| `app/api/stripe/webhook/route.js` | All Stripe webhook handlers (checkout, invoice, subscription, payment_intent) |
| `app/api/stripe/invoice/route.js` | Creates PaymentIntent + writes invoice doc server-side |
| `app/api/stripe/checkout/route.js` | Creates Stripe Checkout session (subscription + optional $99 setup) |
| `app/api/admin/send-template/route.js` | Emails client import template to contractor (Firebase auth required) |
| `components/layout/AppShell.js` | Subscription + Stripe Connect status gating |
| `app/admin/dashboard/page.js` | Admin dashboard with Pro Setup pending widget |
| `app/(landing)/page.js` | Marketing landing page (no Firebase imports!) |
| `app/pay/[paymentIntentId]/PayContent.js` | Public client-facing payment page |
| `context/AuthContext.js` | Firebase Auth provider |
| `context/LangContext.js` | EN/ES language toggle |

## Env Vars (Vercel)

### Server-side only
`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_ANNUAL`, `STRIPE_PRICE_SETUP`,
`FIREBASE_ADMIN_PASSWORD`, `FIREBASE_API_KEY`,
`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_MESSAGING_SERVICE_SID`, `TWILIO_PHONE_NUMBER` (legacy, unused by app code — Messaging Service SID is what routes A2P-compliant sends),
`SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL`,
`ADMIN_EMAIL`, `ADMIN_PHONE_NUMBER`,
`CRON_SECRET`

### Client-side (NEXT_PUBLIC_)
`NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`,
`NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`, `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`, `NEXT_PUBLIC_FIREBASE_APP_ID`,
`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_STRIPE_PRICE_MONTHLY`, `NEXT_PUBLIC_STRIPE_PRICE_ANNUAL`,
`NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_ADMIN_EMAIL`

## Deployment Notes

- Vercel auto-deploys from `main` branch on push
- Both `yardsyncapp.com` and `yardsync.vercel.app` serve the same deployment
- Use `yardsyncapp.com` for client/contractor-facing URLs (payment links, template downloads, landing page)
- Use `yardsync.vercel.app` for admin-facing URLs (dashboard links in SMS/email alerts)
- Stripe webhook endpoint must point to the live deployment URL

### Dev/Prod Firebase project split (2026-06-14)

Two Firebase projects, scoped through Vercel env vars:
- **`yardsync-41886`** — production. Real contractor data. Vercel Production scope.
- **`yardsync-dev`** — dev/test. Ephemeral test data. Vercel Preview + Development scope, and `.env.local` on local machines.

All 6 `NEXT_PUBLIC_FIREBASE_*` env vars plus `FIREBASE_ADMIN_PASSWORD` are split per environment in Vercel. The `firestoreRest.js` pattern works against both projects unchanged because the same admin email (`admin@fanbasetickets.net`) exists in both projects' Auth, with distinct passwords. See `.firebaserc` for CLI aliases (`firebase use dev` / `firebase use prod`) and `docs/DEVELOPMENT.md` for the full workflow.

## Known Bugs Fixed (don't reintroduce)

1. **`new Date(undefined * 1000).toISOString()` crash** — `subscription.current_period_end` can be null on certain Stripe events. Always null-guard: `value ? new Date(value * 1000).toISOString() : null`
2. **Pro Setup flag written on every checkout** — The `setupFeePaid: true` write must be inside `if (hasSetup)` block, gated by `listLineItems` check against `STRIPE_PRICE_SETUP`
3. **Firebase imports in landing/signup crash Vercel build** — These routes are prerendered; Firebase client SDK can't run at build time
4. **`useSearchParams` without Suspense crashes build** — Use `window.location.search` in useEffect instead

## Don't Do This

- Don't import `firebase-admin` — org policy blocks it
- Don't import Firebase in `app/(landing)/` or `app/signup/` routes
- Don't hardcode Stripe price IDs — always use env vars
- Don't add TypeScript — this is a JS-only project
- Don't create README.md files unless asked
- Don't add unnecessary abstractions — Jay prefers direct, working code
- Don't mock databases in tests — if tests exist, they hit real Firestore
- Don't change Firestore security rules without explicit permission

## Roadmap / Next Session

- [x] ~~Landing page: add Early Adopter deadline + clarify "FREE" → "$0"~~ (done 2026-04-13)
- [x] ~~Fix AppShell Connect gate + clean poisoned stripeAccountStatus~~ (done 2026-04-14)
- [x] ~~Admin dashboard overhaul PR 1 (layout) + PR 2 (Q11 net-out)~~ (done 2026-04-14)
- [x] ~~Backfill user subscription fields + webhook hardening~~ (done 2026-04-21)
- [x] ~~Volume Rewards end-to-end verification (all 5 scenarios)~~ (done 2026-04-21)
- [x] ~~A2P privacy policy language for SMS compliance~~ (done 2026-04-20)
- [x] ~~Volume Rewards UX: onboarding modal + milestone/activation/drop notifications~~ (done 2026-04-21)
- [x] ~~AI-powered SMS message drafting (Claude Sonnet 4.6) + eval suite + client-detail UI~~ (done 2026-05-23)
- [x] ~~Public `/sms-opt-in` consent form (server component, A2P-reviewer accessible)~~ (done 2026-05-23)
- [x] ~~A2P STOP language: EN + ES default templates, AI draft system prompt, landing demo bubbles~~ (done 2026-05-23)
- [x] ~~Twilio A2P 10DLC campaign APPROVED (campaign Verified, SMS now unrestricted to all US numbers)~~ (done 2026-05-24)
- [x] ~~Twilio Messaging Service SID migration — every outbound SMS path (7 files) now routes through `MessagingServiceSid` instead of `From: TWILIO_PHONE_NUMBER` for A2P-compliant routing~~ (done 2026-05-24)
- [x] ~~First end-to-end SMS sent and DELIVERED on the new pipeline (AI drafter EN → real US number via Twilio Messaging Service)~~ (done 2026-05-24)
- [x] ~~Subagent roster created in `.claude/agents/` — 6 SMEs (stripe-payments, sms-a2p, firebase-firestore, bilingual-reviewer, regression-tester, ai-features), 3 personas (marco / established-skeptic / newbie-eager), 1 market-research~~ (done 2026-05-24)
- [x] ~~`ROADMAP.md` skeleton with Phase 1 status + Phase 2 hypothesis backlog (awaiting market-research population) + Phase 3 scale plans~~ (done 2026-05-24)
- [x] ~~Set `TWILIO_MESSAGING_SERVICE_SID=MG21e23c10d5d507045b0a1e263c0eb25b` on Vercel (Production + Preview + Development) + trigger fresh deploy~~ (done 2026-05-24, all SMS paths now live on the A2P-approved Messaging Service)
- [x] ~~Scenario A + A2 (Pro Setup E2E test via Chrome Claude) — redirect regression fix verified, admin SMS root cause identified as AT&T spam filter (Twilio delivered, phone whitelisted by reporting as not-spam)~~ (done 2026-06-03, commits e23c65d + 2a7d877 + 27b075c)
- [x] ~~Twilio status-callback webhook + Firestore `smsStatus` collection — records real delivery status (queued/sent/delivered/undelivered/failed) instead of toast lying based on Twilio API 2xx~~ (done 2026-06-03, commits d86508a + adf97ca + f6646fe + 4d017d2 soft-mode signature)
- [x] ~~Server-side STOP enforcement on every Twilio send site — 12 of 14 active contractors had legacy non-STOP templates; this guarantees A2P compliance regardless of which template generated the message~~ (done 2026-06-03, commit 0195180)
- [x] ~~Comprehensive SMS sweep — Phases A through H via Chrome Claude (create client, schedule, AI EN, AI ES, manual Send, manual Resend, invoice payment link, UX punch list) + Phase G payment verified end-to-end with real test card → webhook → invoice-paid~~ (done 2026-06-03)
- [x] ~~**🔴 LAUNCH BLOCKER:** cron SMS routes use Firebase client SDK without auth context → daily reminders silently fail. Refactor to `firestoreRest.js`~~ done 2026-06-03 (commit `ae1407e`). Also fixed `cron/health` (commit `21d1a20`) + full health-check audit (`529eb3d`).
- [x] ~~**🔴 LAUNCH BLOCKER:** `PhoneInput.js` formatter mangles `+1...` country-code phones with false green validation~~ done 2026-06-03 (commit `ae1407e`)
- [x] ~~**🔴 LAUNCH BLOCKER:** Webhook NOT writing `stripeProcessingFee` + `netToPlatform`~~ done 2026-06-03 (commit `ae1407e`)
- [x] ~~**🔴 LAUNCH BLOCKER:** Rotate `CRON_SECRET`~~ done 2026-06-03 (manual Vercel rotation)
- [x] ~~Signup: confirm-password field + business logo upload (Settings) + Storage rules deployed~~ done 2026-06-03 (commits `bcc87ed` + CLI deploy)
- [x] ~~Firebase CLI now wired (`firebase.json` + `.firebaserc`) — `firebase deploy --only firestore:rules` and `--only storage` work with `NODE_OPTIONS=--use-system-ca`~~ done 2026-06-03 (commit `f1367f5`)
- [x] ~~Post-signup hang regression — cold-lambda race fix (eager AuthContext population)~~ done 2026-06-03 (commit `11cc3d1`)
- [x] ~~Firebase project upgraded Spark → Blaze (needed to enable Storage)~~ done 2026-06-03
- [x] ~~Phase 3 added to `ROADMAP.md` — YardSync Community & Visibility Platform (FB page, verified reviews, contractor discovery, AI visibility engine, monetization tiers)~~ done 2026-06-07 (commit `02d0336`)
- [x] ~~Settings Volume Reward Tracker `getInvoices` ReferenceError fix + `paymentPath === 'stripe'` filter~~ done 2026-06-07 (commit `e32dcda`)
- [x] ~~Privacy Policy + Terms rewrite — 11 + 18 sections, removed Square, added Cookies / Your Rights / TX TDPSA / Children's Privacy / Image Storage / Stripe Connected Account Agreement / IP / User Content / Prohibited Uses / Account Termination / Indemnification / Force Majeure / Dispute Resolution (Bexar Cty AAA arbitration + class action waiver) / General~~ done 2026-06-07 (commit `33d7a5d`)
- [x] ~~Signup cold-start race round 2 — `signingUpRef` in AuthContext suppresses AppShell login-redirect during auth hydration window (defense-in-depth on top of `11cc3d1`)~~ done 2026-06-07 (commit `cea72fb`)
- [x] ~~`/api/stripe/connect/save-account-metadata` — was making unauthenticated Firestore REST call → 403 → 500 on every Connect onboarding. Refactored to `firestoreRest.getDocument` + 5-attempt exponential-backoff retry + 202 'skipped' on missing-but-non-fatal fields~~ done 2026-06-07 (commit `8366b18`)
- [x] ~~Stripe price env var naming standardized — `reactivate-subscription/route.js` was the lone holdout using `STRIPE_ANNUAL_PRICE_ID` / `STRIPE_MONTHLY_PRICE_ID`. All routes now use `STRIPE_PRICE_MONTHLY` / `STRIPE_PRICE_ANNUAL`~~ done 2026-06-07 (commit `73d3727`)
- [x] ~~Live Stripe products + coupons created (manual in Stripe dashboard, Jay 2026-06-07)~~ — Monthly `price_1Tfjx51qcLHs32s2RuiooKwH`, Annual `price_1TfjyH1qcLHs32s2VEIY2KP0`, Pro Setup `price_1TfjzC1qcLHs32s2eSsZqOAu`; coupons `YARDSYNC_FREE` (100% forever) + `YARDSYNC_50OFF` (50% forever)

### Live-keys flip — COMPLETE (2026-06-07 late session)
- [x] ~~Live Stripe webhook endpoint created at `https://yardsyncapp.com/api/stripe/webhook`, live `whsec_…` captured~~ done 2026-06-07 (Jay, manual in Stripe dashboard)
- [x] ~~6 Vercel env vars split Production-only live vs Preview+Dev test~~ done 2026-06-07 (Jay, manual in Vercel)
- [x] ~~Production redeployed~~ done 2026-06-07 (Jay, manual via Vercel ⋯ menu)
- [x] ~~Live-mode verified via temporary `/api/debug-stripe` diagnostic route — returned `keyMode: "live"`. Route deleted after verification~~ done 2026-06-07 (commits `3058acc` → `b9bfad4`)
- [x] ~~Dev/prod environment separation scaffolded — `.env.test` (committed, safe), `.env.example` (committed, no secrets), `docs/DEVELOPMENT.md`, `docs/BRANCH_PROTECTION.md`, `.gitignore` allowlist for `.env.test` + `.env.example`~~ done 2026-06-07 (commit `fd216af`)

### Workflow going forward — DEV/TEST first, sync to PROD seamlessly
Jay's preferred development model from this point on:
1. **All work happens on feature branches** — never push directly to `main`
2. **Feature branch → Vercel Preview deploy** (auto, uses TEST Stripe keys + sandbox values)
3. **Test the change on the Preview URL** with test Stripe cards
4. **When ready → open PR → review → merge to `main`** — Production auto-deploys with LIVE keys
5. **Branch protection on `main` enforces this** — steps in `docs/BRANCH_PROTECTION.md`

### Next session — final pre-launch
- [ ] **Enable GitHub branch protection on `main`** per `docs/BRANCH_PROTECTION.md` (require PR, require status checks pass, no bypassing)
- [ ] **Final comprehensive Chrome Claude E2E test against the live deployment** (signup → Connect onboarding → invoice → SMS → real payment with live card → webhook → invoice-paid)
- [ ] **Begin outreach** — first San Antonio contractor cold-DM batch
- [ ] Adopt the feat/* branch workflow for the very next code change (set the muscle memory before launch traffic hits)

### Backlog (pre-launch, not gating)
- [ ] Wire payment page (`/pay/[paymentIntentId]`) to display contractor's `logoUrl` (trust signal — client sees they're paying the right person) with YardSync as primary brand
- [ ] Tighten Twilio status-callback signature verification from soft-mode to hard-reject (once a successful verification appears in Vercel logs)
- [ ] Verify logo upload UX on Settings live (next signup test)
- [ ] Post-Twilio approval: re-run AI draft 5-sample eval with the new STOP rule (expect 170–200 char outputs)
- [ ] Post-Twilio approval: add `Reply STOP to opt out. – YardSync` presence assertion to AI draft eval suite
- [ ] LangContext → Firestore sync for `preferredLanguage` (ES notifications)
- [ ] Admin dashboard overhaul PR 3: CSV rebuild + email digest queue + mobile handling
- [ ] Smoke test PR 2: paid test invoice → verify `stripeProcessingFee` + `netToPlatform` persist (✅ webhook formula now writes both — needs live verification)
- [ ] Sweep remaining dead Square/quarterly inline walkers from admin dashboard
- [ ] `firestoreRest.js` line 22: remove `admin@fanbasetickets.net` fallback, fail loudly instead
- [ ] Email invoice delivery smoke test (Connect-complete account + email-only client)
- [ ] **Bulk test-user cleanup (deferred)** — Firestore docs matching `@yardsyncdemo.com`, `scenarioa`, `protest`, `testflash`, `yardsynctest`, `@test.com` (except `rub@test.com` + `scals@test.com`). Blocked on either (a) refreshing `FIREBASE_ADMIN_PASSWORD` in `.env.local` from Vercel, OR (b) running `gcloud auth print-access-token` interactively (Owner account has org-level reauth-on-every-call policy that blocks non-interactive token fetch).
- [ ] Delete `jay+scenarioa3@fanbasetickets.net` from Firestore + Firebase Auth (same blocker as bulk cleanup — do via Firebase Console or unblock per above)
- [ ] Lawyer review of ToS Section 6 (Early Adopter Pricing Lock) before any volume marketing
