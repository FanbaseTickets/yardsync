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
