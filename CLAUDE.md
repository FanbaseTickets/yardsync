# YardSync — Project Brief for Claude

> This file is auto-loaded at the start of every Claude Code session.
> Keep it current. Last updated: 2026-04-13.
>
> **Session startup:** When the user says "get up to speed", read `YARDSYNC_KNOWLEDGE_BASE.md`
> in the project root. That single file contains the full project history, architecture,
> every deployment breaker, business logic, and roadmap. One read = fully briefed.
> Do NOT re-explore the codebase — the knowledge base IS the exploration.
> At the end of significant sessions, update the knowledge base with what changed.

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
**First customer:** Marco (Jay's personal gardener).

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
`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`,
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

- [ ] Admin dashboard cleanup: remove dead Square/quarterly billing UI
- [x] ~~Landing page: add Early Adopter deadline + clarify "FREE" → "$0"~~ (done 2026-04-13)
- [ ] `firestoreRest.js` line 22: remove `admin@fanbasetickets.net` fallback, fail loudly instead
- [ ] End-to-end Pro Setup test (Stripe test mode → SMS + email + dashboard widget)
- [ ] Email invoice delivery smoke test (Connect-complete account + email-only client)
- [ ] Fix AppShell Connect gate: check `stripeAccountId` not just `stripeAccountStatus`
- [ ] Clean up poisoned `stripeAccountStatus` data in Firestore
- [ ] Full QA pass per QA_PHASE5_CHECKLIST.md before live keys flip
