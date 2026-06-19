# YardSync — Smart Business Card + QR Client Intake — Implementation Spec

**Owner:** Jay Johnson / JNew Technologies, LLC
**Audience:** VS-Claude (implementation), with full access to the YardSync codebase
**Status:** Approved for build
**Scope:** Phase A (MVP intake) + Phase B (shareability polish) + Trust-State billing mechanic + Post-acceptance UX + Upfront Deadline customization
**Last updated:** 2026-06-19

---

## 0. How to read this spec

This is the converged product/UX spec from the design session with Desktop Claude (rev 2), plus three additions decided during the implementation handoff (Sections 11–13). It is written so you can start building immediately. Recommended defaults are stated inline; the handful of genuine product decisions are collected in **Section 9 — Open Questions**.

### Non-negotiable architectural constraints

1. **No Firebase Admin SDK anywhere.** The `fanbasetickets.net` GCP org blocks service-account key creation. All server-side Firestore access goes through `lib/firestoreRest.js` (authenticated via the Firebase Auth admin email/password REST flow).
2. **No Firebase imports in the prerendered `/join/[slug]` route's component tree.** No `import ... from '@/lib/firebase'`, no `useAuth`, no Firebase Client SDK in the page or any component it renders. The page is a **server component**; all Firestore reads happen server-side via `firestoreRest`. The interactive form is a client component that imports **no Firebase** — it only `fetch()`es an API route.
3. **JavaScript only.** No TypeScript anywhere.
4. **Bilingual EN/ES throughout.** Every label, button, placeholder, error, and SMS body has both. Auto-detect from `Accept-Language`; allow a manual toggle. Use the existing `translate()` helper in `lib/i18n.js`.
5. **A2P 10DLC compliance.** Any SMS to a *client* ends with `Reply STOP to opt out. – {business}` and routes through `TWILIO_MESSAGING_SERVICE_SID` (use `lib/sms.js` / the `app/api/twilio/send/route.js` pattern). The contractor-notification SMS goes to the contractor's own already-opted-in phone and does **not** carry STOP language.
6. **Forward-compat with future Crew tier.** The slug belongs to "whoever owns the public profile," not "a user." Resolve owner *by slug lookup*, never via a foreign key baked into client docs. Client docs stay keyed on `gardenerUid` (becomes `ownerUid` of a business later — no client-data migration required). See Section 1.4.
7. **Ship to `chore/preview-env` first.** Build and end-to-end test on the long-lived preview branch (test-mode Stripe + `yardsync-dev` Firebase via Vercel Preview env vars). Only merge to `main` after verification.

---

## 1. Data Model

All new/changed fields below. Existing fields referenced for context are marked *(existing)*.

### 1.1 `users/{uid}` — the contractor (owner of the public profile)

| Field | Type | Phase | Notes |
|---|---|---|---|
| `businessName` *(existing)* | string | — | Source for slug auto-generation and page header |
| `logoURL` *(existing)* | string | — | Business logo; already shown on payment pages |
| `phone` *(existing)* | string (E.164) | — | Destination for the new-lead notification SMS |
| `language` *(existing)* | `'en'`\|`'es'` | — | Contractor's own UI language |
| `stripeAccountStatus` *(existing)* | `'pending'`\|`'complete'` | — | **Not** a gate for `/join`; only gates sending invoices |
| `publicSlug` | string | A | Lowercase, `^[a-z0-9-]{3,50}$`. Display/edit source of truth. Null until the contractor generates their card |
| `headshotURL` | string | B | Personal headshot, **separate** from `logoURL`. Named `headshotURL` (not `photoURL`, which collides with Firebase Auth) |
| `serviceArea` | string | B | Free-text, e.g. "San Antonio & NE suburbs". Used on card + optionally `/join` |
| `tagline` | string | B | Short one-line selling line for the card/page (e.g. "Reliable weekly mowing & cleanups"). Contractor writes it in their own language; not auto-translated |
| `accentColor` | string (hex) | B | Contractor's brand accent for the card. Defaults to the YardSync primary if unset |
| `bio` | string | A | Free-text description shown on `/join` page header. Contractor writes in their own language; not auto-translated. See §13 |
| `upfrontDeadlineHours` | number | A | Global default payment deadline (hours before scheduled visit) for `upfront` billing. Default 24; min 1; max 168 (7 days). See §12 |
| `previousSlugs` | array of `{ slug, expiresAt(ISO) }` | A (optional) | For the 30-day redirect after a slug change. Deferrable — see 1.4 |

> The service-package list for the "Service interest" dropdown comes from the contractor's existing services data. Read it server-side via `firestoreRest` when rendering `/join`. If a contractor has no packages defined, the dropdown is omitted (the field is optional anyway).

### 1.2 `clients/{id}` — keyed on `gardenerUid` (the owner's uid)

| Field | Type | Phase | Notes |
|---|---|---|---|
| `gardenerUid` *(existing)* | string | — | Owner key. **Becomes `ownerUid` of a business in Crew tier — no migration.** Do not rename now |
| `name` / `phone` / `email` / `address` *(existing shape)* | — | A | Mirror the Add Client modal's field shapes & validation exactly |
| `source` | `'intake'`\|`'manual'` | A | `'intake'` for QR/web leads; `'manual'` for the existing Add Client modal. Backfill: treat missing as `'manual'` |
| `leadStatus` | `'new'`\|`'accepted'`\|`'dismissed'` | A | Only set for `source: 'intake'`. Manual adds have no `leadStatus` (treated as already-active) |
| `leadSubmittedAt` | string (ISO) | A | Set on intake write |
| `intakeSmsConsent` | boolean | A | The "Text me updates" checkbox value at submit time |
| `intakeSmsConsentAt` | string (ISO) | A | Timestamp of the consent decision (audit) |
| `intakeMeta` | `{ uaHash, ipHash, submittedAt(ISO) }` | A | `uaHash` = SHA-256 of User-Agent; `ipHash` = SHA-256 of IP from `x-forwarded-for`. Hashed for privacy; for fraud review |
| `language` | `'en'`\|`'es'` | A | Set from the form toggle (default = `Accept-Language` detection). Drives client-facing SMS language — reuses existing per-client language routing |
| `billingMode` | `'upfront'`\|`'postvisit'` | A | Trust state (Section 6). New intake clients default `'upfront'` on accept |
| `completedJobsCount` | number | A | Increments on each paid invoice (idempotent — Section 6.3). **Missing = legacy/trusted** (no upfront banner) |
| `billingModePrompted` | boolean | A | Ensures the "switch to post-visit?" prompt shows only once |
| `upfrontDeadlineHours` | number | A | Per-client override of the contractor's global `users/{uid}.upfrontDeadlineHours`. Optional. See §12 |

**Lead → reminder/scheduling/rewards isolation (critical):** any client with `leadStatus === 'new'` is **excluded** from:
- the daily SMS reminder cron (`app/api/cron/sms`),
- scheduling/job creation,
- volume-reward math (`reward-check` cron).

Filter on `leadStatus !== 'new'` (note: missing `leadStatus` passes the filter — manual clients are unaffected).

### 1.3 `rateLimits/{slug}` — spam throttle

| Field | Type | Notes |
|---|---|---|
| `count` | number | Submissions in the current window |
| `windowStart` | string (ISO) | Start of the rolling 1-hour window; reset when expired |

Best-effort read-modify-write via `firestoreRest`. Under concurrency this may slightly undercount — acceptable for spam control. Window = 1 hour; cap = **10 submissions/slug/hour** → over-cap returns HTTP 429.

### 1.4 Slug resolution & forward-compat (Crew tier)

**Recommended: a `slugs/{slug}` resolver collection**:

```
slugs/{slug} = {
  ownerType: 'user',        // becomes 'business' in Crew tier
  ownerUid:  '<uid>',       // becomes the business owner's uid; no client migration
  createdAt: ISO,
  active:    true,
  expiresAt: ISO | null     // set when slug is retired (redirect window)
}
```

- `/join/[slug]` does: `get slugs/{slug}` → resolve `ownerUid` → fetch that user's public profile via `firestoreRest`. This is a **lookup by slug**, never a foreign key on the client doc.
- Uniqueness is enforced by the existence of `slugs/{slug}`.
- `publicSlug` on the user doc remains for display/editing; the resolver is the lookup index. Keep them in sync on write.
- **Crew migration path (future, no action now):** point `slugs/{slug}.ownerType` to `'business'` and `ownerUid` to the business owner. Client docs are untouched.

**Reserved slug blocklist** (reject on save): `admin, api, app, dashboard, login, signup, settings, pay, sms-opt-in, privacy, terms, clients, calendar, services, sms, onboarding, join`.

**Slug rules:** `^[a-z0-9-]{3,50}$`; default = `slugify(businessName)`; on collision append `-2`, `-3`, …; editable in Settings with a debounced availability check before save.

**Slug change → 30-day redirect (optional / deferrable):** on change, write the old slug into `previousSlugs` with `expiresAt = now + 30d` and keep its `slugs/{old}` doc with `active:false, expiresAt`. `/join/[old]` 301s to `/join/[new]` until expiry.

---

## 2. Routes

### 2.1 `GET /join/[slug]` — public profile + intake (Phase A)

- **Type:** Server component. **No Firebase client SDK.** No auth.
- **Behavior:**
  1. Resolve `slugs/{slug}` via `firestoreRest`. If missing/inactive (and not a redirectable previous slug) → render a branded 404, not a raw Next.js 404.
  2. If it's a retired slug with a live `expiresAt` → 301 to the current slug.
  3. Fetch owner's public profile (`businessName`, `logoURL`, `headshotURL`, `serviceArea`, `bio`, `tagline`, service packages) via `firestoreRest`.
  4. Detect language from `Accept-Language` (default `en`); render with a visible EN/ES toggle.
  5. Render header (logo + headshot + business name + tagline + bio + services + contact options) and the `<IntakeForm>` client component.
- **No payment/Connect gating** — page is live the moment a `publicSlug` exists.

### 2.2 `POST /api/join/submit` — intake submission (Phase A)

- **Type:** API route, server-side. Uses `firestoreRest` + `lib/sms.js`. **No Firebase client SDK.**
- **Request body:** `{ slug, name, phone, email?, address?, serviceInterest?, language, note?, smsConsent, website_url (honeypot) }`
- **Behavior (in order):**
  1. **Honeypot:** if `website_url` is non-empty → return HTTP 200 success **but perform no write and no SMS** (silent drop).
  2. **Resolve slug** → `ownerUid`. If unresolvable → 404.
  3. **Rate limit:** read `rateLimits/{slug}`; if within window and `count >= 10` → 429 with friendly retry message. Else increment/reset window.
  4. **Validate** server-side: `name` required, `phone` required + E.164-normalized. Address/email/serviceInterest/note optional. Reject with field-level errors on failure.
  5. **Duplicate check (non-blocking):** query the owner's clients for a matching phone. If found, still write the lead but set a UI hint.
  6. **Write** `clients/{id}` with `source:'intake'`, `leadStatus:'new'`, `leadSubmittedAt`, `language`, `intakeSmsConsent`, `intakeSmsConsentAt`, `intakeMeta{uaHash,ipHash,submittedAt}`. Do **not** set `billingMode`/`completedJobsCount` yet (set on accept).
  7. **Notify contractor** via `sendSms` to `users/{ownerUid}.phone` (Section 4 body; no STOP line).
  8. **If `smsConsent === true`** → send the thank-you SMS to the client in their chosen `language`, with STOP + business name.
  9. Return `{ ok: true }` → client shows the confirmation screen.

### 2.3 Settings additions (Phase A + B)

`/settings` (`app/settings/SettingsContent.js`) gains:

- **"Generate your YardSync card" CTA** (Phase A): one click → auto-generates slug from `businessName`, creates `slugs/{slug}` + sets `publicSlug`, enables `/join`.
- **Slug editor** (Phase A): shows current `/join/[slug]` URL with copy button; editable with debounced availability check + reserved-word/format validation.
- **Bio field** (Phase A): free text, contractor's choice of language.
- **Upfront deadline hours** (Phase A): number input, default 24, range 1–168. See §12.
- **Headshot upload** (Phase B): Firebase Storage, separate from logo. Reuses `LogoUpload` pattern.
- **Service area** (Phase B): free text.
- **Tagline** (Phase B): one-line selling line.
- **Accent color** (Phase B): color picker.
- **QR code** (Phase B): downloadable PNG.
- **Card download buttons** (Phase B): print PDF (front + back), social square PNG, social story PNG.

### 2.4 `GET /api/card/[slug]` — card/asset generation (Phase B)

Generates the contractor's downloadable assets. Accepts `?format=print|square|story`.

- **No Admin SDK** — read profile via `firestoreRest`.
- QR via JS QR lib; PDF via server-rendered HTML/SVG; PNG via `@vercel/og` or similar.
- Bilingual strings on the card reuse `lib/i18n.js`.

### 2.5 Webhook change — `app/api/stripe/webhook/route.js` (Phase A, trust state)

On `invoice.payment_succeeded`, in addition to existing fee writes: increment `clients/{clientId}.completedJobsCount` **idempotently** (§6.3) and trigger the one-time billing-mode prompt eligibility.

---

## 3. UX Flow (wireframe-level)

### 3.1 `/join/[slug]` page

```
┌───────────────────────────────────────┐
│  [EN | ES]  ← language toggle (top-right)│
│                                         │
│      ( headshot )   [ business logo ]   │
│                                         │
│        BUSINESS NAME (large)            │
│        Tagline (small)                  │
│        Bio paragraph                    │
│        Service area (if set)            │
│                                         │
│   Services we offer:                    │
│   • Package A   • Package B  • …         │
│                                         │
│   ─────────  Request service  ───────── │
│   Full name*            [__________]    │
│   Phone*                [__________]    │
│   Service address       [__________]    │  ← soft-required
│   Email (optional)      [__________]    │
│   Service interest ▾  (if pkgs exist)   │
│   Notes (optional)      [__________]    │
│   ☐ Text me updates about my request    │
│      Reply STOP to opt out. Msg & data  │
│      rates may apply.                   │
│   (hidden honeypot: website_url)        │
│            [  Send request  ]           │
│                                         │
│   Prefer to call? (tel: contractor #)   │  ← also the no-JS fallback CTA
└───────────────────────────────────────┘
```

### 3.2 Intake form validation rules

| Field | Requirement | Behavior |
|---|---|---|
| Full name | **Hard-required** | Blocks submit; inline error |
| Phone | **Hard-required** | Blocks submit; E.164 normalize + validate at exactly 10 local digits |
| Service address | **Soft-required** | If empty on submit → confirm dialog. Allows submit if user proceeds |
| Email | Optional | Format-validate only if provided |
| Service interest | Optional | Dropdown from contractor's packages; hidden if none |
| Preferred language | Optional (defaulted) | Toggle; defaults to detection |
| Notes | Optional | Free text |
| SMS consent | Optional, default **unchecked** | Gates the client thank-you SMS only |

### 3.3 Confirmation screen (post-submit)

Full-screen replace of the form: *"Thanks! {businessName} will be in touch."* + (if `smsConsent`) *"We've texted a confirmation to your phone."* Offer a "Call now" `tel:` link.

### 3.4 New Leads in `/clients`

- A **"New leads (N)"** section/banner above the existing client list.
- Each lead card shows: name, phone, address, service interest, note, submitted-at, language, SMS-consent badge, optional duplicate hint.
- Actions: **Accept**, **Accept + Send invoice** (quick action — see §11), **Dismiss**.

### 3.5 Settings (Phase A first run)

If `publicSlug` is null, show a prominent card: **"Generate your YardSync card"** → one click generates slug + enables `/join`.

---

## 4. Copy (EN + ES)

> All strings go through `lib/i18n.js`.

### 4.1 Page / form labels

| Key | EN | ES |
|---|---|---|
| `join.requestService` | Request service | Solicitar servicio |
| `join.servicesOffered` | Services we offer | Servicios que ofrecemos |
| `join.serviceArea` | Service area | Área de servicio |
| `field.fullName` | Full name | Nombre completo |
| `field.phone` | Phone | Teléfono |
| `field.address` | Service address | Dirección de servicio |
| `field.email` | Email (optional) | Correo electrónico (opcional) |
| `field.serviceInterest` | Service interest | Servicio de interés |
| `field.language` | Preferred language | Idioma preferido |
| `field.notes` | Notes (optional) | Notas (opcional) |
| `join.smsConsent` | Text me updates about my request | Envíenme mensajes sobre mi solicitud |
| `join.smsFinePrint` | Reply STOP to opt out. Msg & data rates may apply. | Responda STOP para cancelar. Pueden aplicarse tarifas de mensajes y datos. |
| `join.submit` | Send request | Enviar solicitud |
| `join.callInstead` | Prefer to call? | ¿Prefiere llamar? |

### 4.2 Errors / dialogs

| Key | EN | ES |
|---|---|---|
| `err.nameRequired` | Please enter your name. | Por favor ingrese su nombre. |
| `err.phoneRequired` | Please enter a valid phone number. | Por favor ingrese un número de teléfono válido. |
| `err.phoneInvalid` | That phone number doesn't look right. | Ese número de teléfono no parece correcto. |
| `err.emailInvalid` | That email doesn't look right. | Ese correo no parece correcto. |
| `confirm.skipAddress` | Without an address we can't visit or quote you. Skip anyway? | Sin una dirección no podemos visitarlo ni cotizarle. ¿Omitir de todos modos? |
| `err.rateLimited` | Please try again in a few minutes. | Por favor intente de nuevo en unos minutos. |
| `err.generic` | Something went wrong. Please try again or call us. | Algo salió mal. Intente de nuevo o llámenos. |

### 4.3 Confirmation

| Key | EN | ES |
|---|---|---|
| `confirm.thanks` | Thanks! {businessName} will be in touch. | ¡Gracias! {businessName} se pondrá en contacto. |
| `confirm.smsSent` | We've texted a confirmation to your phone. | Le enviamos una confirmación por mensaje de texto. |

### 4.4 SMS templates

**Contractor notification** (to contractor's own phone — **no STOP line**, ≤160 chars):
```
New YardSync lead: {clientName} ({phone}). Open YardSync to follow up: yardsyncapp.com/clients
```

**Client thank-you — EN** (only if `smsConsent === true`):
```
Hi {clientName}! Thanks for your request to {businessName}. We'll be in touch soon. Reply STOP to opt out. – {businessName}
```

**Client thank-you — ES:**
```
¡Hola {clientName}! Gracias por su solicitud a {businessName}. Pronto nos comunicaremos. Responda STOP para cancelar. – {businessName}
```

**First-time invoice — EN** (NEW, see §12):
```
Hi {clientName}! {businessName} sent your invoice for {amount}. Please pay by {paymentDeadline} or your {date} service may be rescheduled. Pay: {paymentLink}
Reply STOP to opt out. – {businessName}
```

**First-time invoice — ES:**
```
¡Hola {clientName}! {businessName} le envió su factura por {amount}. Por favor pague antes de {paymentDeadline} o su servicio del {date} podría ser reprogramado. Pague aquí: {paymentLink}
Responda STOP para cancelar. – {businessName}
```

### 4.5 Settings / trust-state copy

| Key | EN | ES |
|---|---|---|
| `settings.generateCard` | Generate your YardSync card | Genere su tarjeta YardSync |
| `settings.downloadCard` | Download business card (PDF) | Descargar tarjeta de presentación (PDF) |
| `settings.downloadSquare` | Download social post | Descargar publicación |
| `settings.downloadStory` | Download story | Descargar historia |
| `settings.headshot` | Personal photo | Foto personal |
| `settings.tagline` | Tagline | Eslogan |
| `settings.accentColor` | Brand color | Color de marca |
| `settings.bio` | Bio / description | Biografía / descripción |
| `settings.upfrontDeadlineHours` | Upfront billing deadline (hours before service) | Plazo de facturación anticipada (horas antes del servicio) |
| `card.nowBooking` | Now booking | Reservando ahora |
| `card.scanQuote` | Scan for a free quote | Escanee para una cotización gratis |
| `card.scanRequest` | Scan to request service | Escanee para solicitar servicio |
| `card.poweredBy` | Powered by YardSync | Con tecnología de YardSync |
| `lead.accept` | Accept | Aceptar |
| `lead.acceptAndInvoice` | Accept + Send invoice | Aceptar + Enviar factura |
| `lead.dismiss` | Dismiss | Descartar |
| `lead.possibleDuplicate` | Possible duplicate of {name} | Posible duplicado de {name} |
| `trust.firstTimeBanner` | First-time client — invoice will require payment before service. Let them know to pay ahead, or service can't be rendered. | Cliente nuevo — la factura requiere pago antes del servicio. Avísele que pague por adelantado, o no se puede prestar el servicio. |
| `trust.switchPrompt` | {clientName} paid their first invoice. Switch to post-visit billing for this client? | {clientName} pagó su primera factura. ¿Cambiar a facturación después de la visita para este cliente? |

---

## 5. Edge Cases

| # | Scenario | Behavior |
|---|---|---|
| 1 | Contractor not Connect-complete | `/join` is fully live; leads capture normally. Connect is only forced when the contractor accepts a lead and tries to send the first invoice. |
| 2 | Contractor has no logo | Show headshot only. |
| 3 | Contractor has neither logo nor headshot | Generated initials avatar from `businessName`. Never a broken image. |
| 4 | Contractor has no service packages | Omit the "Service interest" dropdown. |
| 5 | Client phone already exists as a client | Do **not** block. Write the lead; flag "Possible duplicate of {name}" in New Leads UI. |
| 6 | Invalid / blank address | Soft-required confirm dialog; submit allowed if user proceeds. |
| 7 | QR scanned, **JS disabled** | Page is server-rendered. Native `<form action="/api/join/submit" method="POST">` fallback. |
| 8 | Honeypot filled (bot) | Return 200 success; perform no write, no SMS. |
| 9 | >10 submissions/slug/hour | 429 + friendly retry message. |
| 10 | Slug doesn't exist / not yet generated | Branded "card not active" page. |
| 11 | Slug changed, old card scanned | 301 redirect for 30 days (if shipped); else branded 404. |
| 12 | SMS consent unchecked | No client SMS sent; contractor still notified. |
| 13 | Twilio send fails | Don't fail the submission — the lead is already written. Log the failure. |
| 14 | Duplicate webhook for same invoice | `completedJobsCount` increment is idempotent (per-invoice guard). |
| 15 | Existing (pre-feature) client | Missing `completedJobsCount` ⇒ treated as legacy/trusted; **no** first-time upfront banner. |
| 16 | Lead never accepted | Stays `leadStatus:'new'`; excluded from reminders/scheduling/rewards indefinitely. |
| 17 | Reserved word as slug | Rejected at save with reserved-word error. |
| 18 | Concurrent intake writes near rate-limit cap | Best-effort counter may slightly undercount; acceptable. |
| 19 | First-time invoice with no scheduled visit | Show warning: "No visit scheduled. Can't auto-set deadline." Contractor schedules first OR sends without `{paymentDeadline}` (template handles missing variable). |

---

## 6. Trust-State Billing Mechanic (per-client)

Maps to how cash-economy lawn-care contractors actually run their book. **Per-client, not per-contractor.**

### 6.1 State transitions

```
New lead                → leadStatus:'new'   (no billingMode yet)
Lead accepted           → billingMode:'upfront', completedJobsCount:0, billingModePrompted:false
Each paid invoice       → completedJobsCount += 1 (idempotent)
completedJobsCount == 0 → Send-Invoice flow shows the "first-time, pay upfront" banner
completedJobsCount >= 1 AND billingMode=='upfront' AND !billingModePrompted
                        → one-time prompt: "Switch to post-visit billing for this client?"
                          Yes → billingMode:'postvisit'; either choice sets billingModePrompted:true
```

### 6.2 Send-Invoice UI

- Banner shows when `billingMode === 'upfront' && completedJobsCount === 0`. Informational; does not block sending.
- One-time switch prompt fires when eligibility is met.

### 6.3 Idempotent increment (webhook)

In `app/api/stripe/webhook/route.js` on `invoice.payment_succeeded`:
1. Resolve the `clientId` from the invoice.
2. Read the invoice doc; if it already has `countedTowardTrust === true`, **skip**.
3. Else increment `clients/{clientId}.completedJobsCount` and set `countedTowardTrust:true` on the invoice doc.

### 6.4 Legacy clients

Missing `completedJobsCount` ⇒ treated as trusted (no banner). Only clients accepted/created after launch get the `upfront` default.

---

## 7. Phase B — Shareability

1. **Headshot upload** in Settings → `headshotURL`.
2. **Service area** text field → `serviceArea`.
3. **QR code** per contractor: encodes `https://yardsyncapp.com/join/[slug]`. Downloadable as PNG, embedded in the PDF.
4. **Card + social assets**: see §7.1.
5. **Headshot on `/join`** alongside logo.

### 7.1 Card generation — print + social (Phase B)

One template, three export sizes:

| Output | Size | Format | Use |
|---|---|---|---|
| Print card — front + back | 3.5" × 2" + 1/8" bleed | PDF, 300 DPI, CMYK-safe | Hand-out card, print shop |
| Social square | 1080 × 1080 px | PNG | Feed posts |
| Social story | 1080 × 1920 px | PNG | IG / FB stories |

**Per-contractor inputs:** `headshotURL`, `logoURL`, `businessName`, `tagline`, services line, `phone`, `serviceArea`, `accentColor`, QR.

**Branding rules:**
- Contractor brand leads.
- YardSync rides as a fixed **"Powered by YardSync"** mark, **non-removable on the free/standard tier**.
- VS-Claude substitutes the YardSync brand palette + fonts (from `tailwind.config.js` and CLAUDE.md: DM Sans + DM Serif Display) for any placeholder colors in the design drafts.

**Generation:** server-side via `firestoreRest`; QR via JS QR lib; PNG/PDF via server-rendered HTML/SVG pipeline.

---

## 8. Implementation Notes (existing patterns to reuse)

- **Server Firestore:** `lib/firestoreRest.js`. Extend if needed (still REST, still admin-email/password auth).
- **SMS:** `lib/sms.js` `sendSms()` → `TWILIO_MESSAGING_SERVICE_SID`. Mirror `app/api/twilio/send/route.js`.
- **Phone normalization:** reuse `PhoneInput` logic from `app/clients/ClientsContent.js`.
- **i18n:** `lib/i18n.js` `translate()`; add the keys in §4.
- **Base URL:** `lib/baseUrl.js`.
- **Storage upload:** reuse `LogoUpload` pattern (commit `bcc87ed`).
- **Hashing:** Node `crypto` SHA-256.

### 8.1 Suggested file map

| File | Purpose |
|---|---|
| `app/join/[slug]/page.js` | Server component: resolve slug, fetch profile, render |
| `app/join/[slug]/IntakeForm.js` | Client component: form, validation, toggle, honeypot, fetch POST |
| `app/api/join/submit/route.js` | Honeypot → rate limit → validate → write lead → notify |
| `app/api/card/[slug]/route.js` | Phase B: generate card assets |
| `lib/cardTemplate.js` | Phase B: shared card layout/branding template |
| `lib/slug.js` | `slugify`, validation, reserved blocklist, availability check |
| `app/settings/SettingsContent.js` | Generate-card CTA, slug editor, photo/tagline/color/bio/deadline |
| `app/clients/ClientsContent.js` | New Leads section, duplicate hint, trust-state banner in Send-Invoice |
| `app/clients/[id]/page.js` | Per-client deadline override + Send Invoice trust banner |
| `app/api/stripe/webhook/route.js` | Idempotent `completedJobsCount` increment |
| `app/api/stripe/invoice/route.js` | `{paymentDeadline}` variable resolution for first-time SMS |
| `lib/firestoreRest.js` | Extend with slug-resolver get + clients runQuery if needed |

---

## 9. Open Questions (decided)

| # | Question | Decision |
|---|---|---|
| 1 | Trust-state legacy default | Missing `completedJobsCount` = trusted. No backfill. |
| 2 | `leadStatus` filter location | Cron/scheduling/reward queries filter on `leadStatus !== 'new'` (missing passes). |
| 3 | Duplicate-phone handling | Write + flag, never block. Match on phone only for v1. No auto-merge. |
| 4 | Card spec | Resolved in §7.1. Three exports: print PDF (front+back), social square, social story. |
| 5 | Slug-change 30-day redirect | Ship in v1 (printed cards are durable). |
| 6 | Bio source | New `users/{uid}.bio` free-text field, single-language (contractor writes in their own). See §13. |
| 7 | Contractor notification language | Send in contractor's own `users/{uid}.language`. Provide both EN/ES templates. |
| 8 | `serviceArea` on `/join` | Show on both `/join` and the card. |

---

## 10. Build / Verification Checklist (for the PR to `chore/preview-env`)

- [ ] `/join/[slug]` renders with **zero** Firebase client SDK imports in its tree (grep the build).
- [ ] Slug resolver lookup works; reserved words rejected; collisions suffix correctly.
- [ ] Intake writes `clients/{id}` with all §1.2 fields; lead excluded from reminder cron.
- [ ] Honeypot drops silently; rate limit returns 429 at >10/hr.
- [ ] Contractor notification SMS delivered (≤1 segment, no STOP); thank-you SMS sent only when consent checked.
- [ ] EN/ES verified on every label/error/SMS.
- [ ] No-JS form fallback posts and validates server-side.
- [ ] New Leads Accept/Dismiss/Accept+Send Invoice flow.
- [ ] Trust banner on first-time invoice; idempotent `completedJobsCount`.
- [ ] First-time invoice SMS embeds `{paymentDeadline}` resolved from `effectiveDeadlineHours`.
- [ ] Phase B: headshot/tagline/accent-color/bio save; QR correct; all three card exports generate.
- [ ] Full E2E on preview URL with test Stripe keys before any merge to `main`.

---

## 11. Post-acceptance UX (addendum to §§3 and 6)

### 11.1 Accept button behavior

- **Accept** on a lead card transitions `leadStatus → 'accepted'` and navigates to `/clients/{newClientId}` so Marco can immediately schedule or invoice without an extra click.

### 11.2 Quick-action variant

- New Leads card has a secondary action: **"Accept + Send invoice"**.
- One click: accepts the lead AND opens the Send Invoice modal pre-filled.
- Useful for same-day work / urgent leads.
- Card layout:
  ```
  ┌──────────────────────────────────────────┐
  │ Sara Martins · (210) 555-1234            │
  │ 8123 Living Street, San Antonio          │
  │ Interest: Weekly mow · Lang: EN          │
  │ Submitted 2m ago                         │
  │                                          │
  │ [Accept]   [Accept + Send invoice]   ✕  │
  └──────────────────────────────────────────┘
  ```

### 11.3 No auto-sending

The contractor always reviews the invoice details (amount, line items, channels) before it fires. Manual review at each step is intentional — auto-sending an invoice to a stranger from a form submission would be a chargeback magnet.

---

## 12. Upfront Billing Deadline (per-client + global)

### 12.1 New field on `users/{uid}`

- `upfrontDeadlineHours` (number, default **24**, min 1, max 168 = 7 days)
- Set in Settings under a new "Payment Reminders" subsection
- Applies to new accepted leads (default value at acceptance time)

### 12.2 New field on `clients/{id}`

- `upfrontDeadlineHours` (number, optional)
- Per-client override of the contractor's global default
- Set in the client detail page when `billingMode === 'upfront'`

### 12.3 Resolution rule

```javascript
effectiveDeadlineHours =
  clients/{id}.upfrontDeadlineHours
  ?? users/{uid}.upfrontDeadlineHours
  ?? 24
```

### 12.4 New SMS template variable

- `{paymentDeadline}`: human-readable deadline string, formatted from the scheduled visit's datetime minus `effectiveDeadlineHours`
- Format: "Tue 5pm" if within 7 days, else "by {date} at {time}"
- Bilingual formatting (EN/ES) follows the existing date/time pattern

### 12.5 First-time invoice SMS template

- Default EN/ES versions in §4.4
- Editable by contractor in `/sms` template editor
- Supports `{name}`, `{amount}`, `{paymentDeadline}`, `{date}`, `{paymentLink}`, `{business}`, STOP language

### 12.6 Edge case — invoice sent before visit is scheduled

- If Marco sends a first-time invoice with no scheduled visit yet, the deadline computation can't run
- Show inline warning: "No visit scheduled. We can't auto-set a payment deadline. Schedule the visit first or send without a deadline mentioned."
- Marco can either schedule then resend, or override and send without `{paymentDeadline}` (template gracefully handles missing variable)

---

## 13. Bio decision (addendum to §1.1 and §9 Q6)

### 13.1 Decision

`users/{uid}.bio` is a **single-language free-text field**. The contractor writes it in their own language. No bilingual EN/ES separation; no auto-translation.

### 13.2 Rationale

- Bilingual auto-translation is unreliable for marketing copy and could introduce errors that hurt conversion.
- Contractors writing their OWN bio in both languages doubles their setup friction without guaranteeing quality.
- A single-language bio aligns with the contractor's authentic voice and matches how Hispanic operators typically present themselves on social media (one language, code-switched casually if at all).
- Forward-compat: if a future tier wants bilingual support, add a `bioEs` field then. v1 keeps the data model simple.

### 13.3 UX

- One free-text textarea in Settings labeled "Bio / description" (`settings.bio` key)
- 3-line max recommended (~200 chars)
- Rendered as plain text on `/join` and the card
- Optional — contractor can leave it blank; the page falls back to just business name + tagline

### 13.4 Social media reuse

The bio is the most-shareable piece of contractor copy. Same string used on:
- `/join/[slug]` page header
- (Future) social media share previews via Open Graph meta tags

---

*End of spec.*
