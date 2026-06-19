# YardSync Development Guide

## Environment Setup

1. Copy `.env.example` to `.env.local`
2. Fill in test/sandbox values from:
   - Stripe Dashboard (test mode)
   - Firebase Console — **yardsync-dev project** (not yardsync-41886, which is production-only)
   - Twilio Console
   - Anthropic Console
3. Never put live/production keys in `.env.local`. The `yardsync-41886` Firebase values live in Vercel under the Production scope only.
4. Production secrets live in Vercel only

## Branch Strategy

| Branch     | Environment | URL                              | Stripe Mode | Firebase Project   |
|------------|-------------|----------------------------------|-------------|--------------------|
| main       | Production  | yardsyncapp.com                  | LIVE        | yardsync-41886     |
| any other  | Preview     | yardsync-git-[branch].vercel.app | TEST        | yardsync-dev       |
| local      | Development | localhost:3000                   | TEST        | yardsync-dev       |

The Firebase project is selected by the `NEXT_PUBLIC_FIREBASE_*` env vars in Vercel:
- **Production scope** → `yardsync-41886` (real contractor data, live keys)
- **Preview + Development scope** → `yardsync-dev` (test data only, ephemeral)

This isolation means a Preview deploy can never read or write production data.

### Firebase CLI — switching project targets

`.firebaserc` defines three aliases:
- `default` → `yardsync-41886`
- `prod` → `yardsync-41886`
- `dev` → `yardsync-dev`

Before deploying rules to a specific project, switch the alias:
```bash
firebase use dev    # target yardsync-dev
firebase use prod   # target yardsync-41886
```

Then `firebase deploy --only firestore:rules` or `--only storage` runs against the active alias.

## Development Workflow

1. Never commit directly to main.
2. Create a feature branch:
   ```bash
   git checkout -b feat/your-feature-name
   ```
3. Push branch → Vercel auto-creates Preview URL.
4. Test on Preview URL with test Stripe cards.
5. When ready → open PR → review → merge to main.
6. Production auto-deploys from main.

## Test Stripe Cards

| Card                 | Result               |
|----------------------|----------------------|
| 4242 4242 4242 4242  | Success              |
| 4000 0000 0000 0002  | Declined             |
| 4000 0025 0000 3155  | 3D Secure required   |

Use any future expiry date and any 3-digit CVC.

## Cron Jobs

To trigger cron jobs manually (PowerShell):

**Health check:**
```powershell
$cron = "your-cron-secret"
Invoke-RestMethod -Method GET `
  -Uri "https://yardsyncapp.com/api/cron/health" `
  -Headers @{ Authorization = "Bearer $cron" }
```

**SMS cron** (only triggers sends if jobs are scheduled today):
```powershell
Invoke-RestMethod -Method GET `
  -Uri "https://yardsyncapp.com/api/cron/sms" `
  -Headers @{ Authorization = "Bearer $cron" }
```

## Firebase CLI

Deploy rules after changes (Windows needs system CA flag):
```bash
NODE_OPTIONS=--use-system-ca firebase deploy --only storage
NODE_OPTIONS=--use-system-ca firebase deploy --only firestore:rules
```

## Dev/Prod Environment Matrix

This is the source of truth for which value goes where. Every env var that
participates in the dev/prod split is listed here. Anything set to "All
Environments" scope in Vercel overrides the per-environment values via
JS fallback chains — that's how the 2026-06-18 silent-firestoreRest-failure
bug happened (see "Known Traps" below).

### Per-environment env vars (split between Production and Preview+Development scopes)

| Variable | Production | Preview + Development |
|---|---|---|
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | `yardsync-41886` | `yardsync-dev` |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | yardsync-41886 web app key | yardsync-dev web app key |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | `yardsync-41886.firebaseapp.com` | `yardsync-dev.firebaseapp.com` |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | yardsync-41886 bucket | yardsync-dev bucket |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | prod-specific | dev-specific |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | prod-specific | dev-specific |
| `FIREBASE_ADMIN_PASSWORD` | password for admin@fanbasetickets.net in yardsync-41886 Auth | password for admin@fanbasetickets.net in yardsync-dev Auth |
| `STRIPE_SECRET_KEY` | `sk_live_...` | `sk_test_...` |
| `STRIPE_WEBHOOK_SECRET` | live `whsec_...` (platform events) | test `whsec_...` |
| `STRIPE_WEBHOOK_SECRET_CONNECT` | live `whsec_...` (connect events) | **not set yet** — see "Deferred work" |
| `STRIPE_PRICE_MONTHLY` | `price_1Tfjx51qcLHs32s2RuiooKwH` | test mode price ID |
| `STRIPE_PRICE_ANNUAL` | `price_1TfjyH1qcLHs32s2VEIY2KP0` | test mode price ID |
| `STRIPE_PRICE_SETUP` | `price_1TfjzC1qcLHs32s2eSsZqOAu` | test mode price ID |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `pk_live_...` | `pk_test_...` |
| `NEXT_PUBLIC_STRIPE_PRICE_MONTHLY` / `_ANNUAL` | live price IDs | test mode price IDs |

### Shared across all environments (single value)

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_APP_URL` | `https://yardsyncapp.com` (cron jobs + Twilio callbacks always go here) |
| `ADMIN_EMAIL`, `NEXT_PUBLIC_ADMIN_EMAIL` | `admin@fanbasetickets.net` |
| `ADMIN_PHONE_NUMBER` | Jay's mobile |
| `CRON_SECRET` | shared random 32+ char string |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_MESSAGING_SERVICE_SID` | single Twilio account (no test sub-account split) |
| `SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL` | single SendGrid account |
| `ANTHROPIC_API_KEY` | single Anthropic key |

### Known Traps

1. **Never set `FIREBASE_API_KEY` (no NEXT_PUBLIC_ prefix) at "All Environments" scope.** `lib/firestoreRest.js` reads
   `process.env.FIREBASE_API_KEY || process.env.NEXT_PUBLIC_FIREBASE_API_KEY` — so an All-Environments `FIREBASE_API_KEY`
   overrides the per-environment one. Result: Preview deploys auth against the prod Firebase project with dev's password
   → `INVALID_LOGIN_CREDENTIALS` → every server-side Firestore write silently fails inside try/catch. Cron health check
   catches this now via the `listCollection('users', { limit: 1 })` probe. If `FIREBASE_API_KEY` exists as an env var,
   it must be scoped per-environment to match `NEXT_PUBLIC_FIREBASE_API_KEY`.
2. **Stripe webhook destinations have separate signing secrets.** The platform destination (your-account events) and
   the connect destination (account.updated for connected accounts) get different `whsec_...` from Stripe. The webhook
   handler at `/api/stripe/webhook` calls `verifyWebhookSignature()` which tries each configured secret in turn — so
   set BOTH `STRIPE_WEBHOOK_SECRET` and `STRIPE_WEBHOOK_SECRET_CONNECT` in any environment that has both destinations
   configured.
3. **`NEXT_PUBLIC_APP_URL` is shared across environments.** Server-initiated calls (cron jobs, webhook admin SMS) embed
   this URL into messages. Production-scoped value is correct since those calls always fire from production. Avoid
   making this per-environment — would break cron-embedded URLs.

### Deferred work

These setup items are deferred until Preview-side testing becomes a higher priority. The current Production setup
works end-to-end; only Preview test-mode webhook side-effects are affected.

- **Stable Preview URL alias** (e.g. `dev.yardsyncapp.com` via Vercel domain config). Stripe webhook destinations need
  a deterministic URL to point at — they can't follow the per-deploy `yardsync-{hash}.vercel.app` pattern.
- **Test-mode Stripe webhook destinations** (`yardsync-test` for your-account events, `yardsync-test-connect` for
  account.updated). The old `dynamic-bliss` destination was auto-disabled by Stripe after delivery failures (pointed
  at the prod URL, so test-mode signatures got 400'd by the live signing secret).
- **`STRIPE_WEBHOOK_SECRET_CONNECT` in Preview/Development scope.** Set once the test-mode connect destination above
  is created.
- **`getBaseUrl` generalization across remaining sites.** Currently used by `/api/stripe/checkout` and
  `/api/stripe/invoice` (Preview-aware redirects/payment URLs). The other ~5 sites (`lib/sms.js`,
  `/api/twilio/send`, cron routes) still use `NEXT_PUBLIC_APP_URL` directly because those are server-initiated and
  should embed the production URL. Only worth changing once Preview-side SMS testing is wired up.

## Common Issues

### Stripe "No such price" error
- Always copy price IDs by clicking, never from screenshots.
- `S` and `5` look identical in Stripe's font.
- `i` and `I` look identical in Stripe's font.

### Windows TLS errors with Node CLI
Add `NODE_OPTIONS=--use-system-ca` prefix to any Node command. Same with the Firebase CLI on Windows.

### Git push fails with "unable to get local issuer certificate"
Use the Schannel TLS backend explicitly:
```bash
git -c http.sslBackend=schannel push origin main
```
