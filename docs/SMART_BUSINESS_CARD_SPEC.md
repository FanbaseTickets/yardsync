# YardSync — Smart Business Card + QR Client Intake — Implementation Spec

**Owner:** Jay Johnson / JNew Technologies, LLC
**Audience:** VS-Claude (implementation), with full access to the YardSync codebase
**Status:** Approved for build, pending resolution of Section 9 (Open Questions)
**Scope:** Phase A (MVP intake) + Phase B (shareability polish) + Trust-State billing mechanic
**Last updated:** 2026-06-19 (**rev. 3 — card-first redesign**: `/join/{slug}` is now a true digital business card; the intake form moves to a dedicated `/join/{slug}/request` route; added Settings live card preview, contact-gating fields, `bio`, `vCard` download, and on-card QR. Supersedes rev 2 §§3 and 7. §§11–13 by VS-Claude are unaffected and remain authoritative for their topics.)

---

## 0. How to read this spec

This is the converged product/UX spec from the design session. It is written so you can start building immediately. Recommended defaults are stated inline; the handful of genuine product decisions are collected in **Section 9 — Open Questions**. Do not block the whole build on Section 9 — build everything that is decided, stub the open items behind the recommended default, and flag them in your PR description.

### What changed in rev 3 (read this first)

The rev 2 `/join/{slug}` page made the **intake form the body** and the contractor's identity the header — the form dominated. Founder feedback: *"I was expecting a business card with a QR code that would then lead me to the intake form."* Rev 3 inverts this:

- **`/join/{slug}` is now the digital business card** — the shareable asset. Identity leads; the form is gone from this page.
- **The intake form moves to `/join/{slug}/request`** — a dedicated destination reached by the card's primary "Request service" button, by the on-card QR, and by printed/social QR codes.
- **The card is what you share** (SMS, social, website link). **The QR is what you scan** (in person, or off a printed card) — and the QR jumps straight to the form, because in a scan context the human or the physical card already conveys identity.
- **Settings gains a live card preview** so the contractor sees exactly what prospects will see while editing.

The data model, slug system, intake API, trust-state mechanic, SMS, and bilingual rules from rev 2 are **unchanged** except for the additive fields in §1.1. Sections **3** and **7** are rewritten; everything else carries forward.

### Non-negotiable architectural constraints (from the YardSync handoff — do not break)

1. **No Firebase Admin SDK anywhere.** The `fanbasetickets.net` GCP org blocks service-account key creation. All server-side Firestore access goes through `lib/firestoreRest.js` (authenticated via the Firebase Auth admin email/password REST flow).
2. **No Firebase imports in the prerendered `/join/[slug]` and `/join/[slug]/request` route trees.** No `import ... from '@/lib/firebase'`, no `useAuth`, no Firebase Client SDK in either page or any component it renders. Both pages are **server components**; all Firestore reads happen server-side via `firestoreRest`. The interactive pieces (card actions, intake form) are client components that import **no Firebase** — they only `fetch()` API routes or run pure client logic (vCard, QR, language toggle).
3. **JavaScript only.** No TypeScript anywhere.
4. **Tailwind CSS only.** No styled-components, no CSS-in-JS. Use the contractor's `accentColor` via inline `style` for the dynamic accent (Tailwind can't generate arbitrary runtime colors); everything else is Tailwind utilities.
5. **Fonts:** DM Serif Display for headings (business name, section headers); DM Sans for body (tagline, bio, labels, buttons).
6. **Bilingual EN/ES throughout.** Every label, button, placeholder, error, and SMS body has both. Auto-detect from `Accept-Language`; allow a manual toggle. Use the existing `translate()` helper in `lib/i18n.js`.
7. **A2P 10DLC compliance.** Any SMS to a *client* ends with `Reply STOP to opt out. – {business}` and routes through `TWILIO_MESSAGING_SERVICE_SID` (use `lib/sms.js` / the `app/api/twilio/send/route.js` pattern). The contractor-notification SMS goes to the contractor's own already-opted-in phone and does **not** carry STOP language.
8. **Forward-compat with future Crew tier.** The slug belongs to "whoever owns the public profile," not "a user." Resolve owner *by slug lookup*, never via a foreign key baked into client docs. Client docs stay keyed on `gardenerUid` (becomes `ownerUid` of a business later — no client-data migration required). See Section 1.4.
9. **Ship to `chore/preview-env` first.** Build and end-to-end test on the long-lived preview branch (test-mode Stripe + `yardsync-dev` Firebase via Vercel Preview env vars). Only merge to `main` after verification.

---

## 1. Data Model

All new/changed fields below. Existing fields referenced for context are marked *(existing)*.

### 1.1 `users/{uid}` — the contractor (owner of the public profile)

| Field | Type | Phase | Notes |
|---|---|---|---|
| `businessName` *(existing)* | string | — | Source for slug auto-generation and card name |
| `logoURL` *(existing)* | string | — | Business logo; shown on the card alongside/under the headshot |
| `phone` *(existing)* | string (E.164) | — | New-lead notification SMS destination **and** the card's "Call"/"Text" actions + contact line (when `showContactPhone`) |
| `email` *(existing, if present)* | string | — | Card contact line (when `showContactEmail`). If no email field exists yet, add a plain `email` string to Settings |
| `language` *(existing)* | `'en'`\|`'es'` | — | Contractor's own UI language; also drives notification SMS language |
| `stripeAccountStatus` *(existing)* | `'pending'`\|`'complete'` | — | **Not** a gate for `/join`; only gates sending invoices |
| `publicSlug` | string | A | Lowercase, `^[a-z0-9-]{3,50}$`. Display/edit source of truth. Null until the contractor generates their card |
| `headshotURL` | string | B | Personal headshot, **separate** from `logoURL`. Named `headshotURL` (not `photoURL`, which collides with Firebase Auth) |
| `serviceArea` | string | B | Free-text, e.g. "San Antonio & NE suburbs". Card + form-header + printed assets |
| `tagline` | string | B | Short one-line selling line (e.g. "Reliable weekly mowing & cleanups"). Contractor writes it in their own language; not auto-translated |
| `bio` | string (≤300 chars) | B | **NEW (rev 3).** Free-text "about" paragraph on the card. Contractor writes it in their own language; not auto-translated. Hard cap 300 chars enforced in Settings and on render (truncate with ellipsis as a safety net) |
| `accentColor` | string (hex) | B | Contractor's brand accent for the card. Defaults to `#0F6E56` (YardSync primary) if unset. Drives primary button, focus rings, status badge, and QR foreground |
| `showContactPhone` | boolean | B | **NEW (rev 3).** Gates the phone on the card's contact line **and** the Call/Text secondary actions. **Default `true`** (contractors want calls; the printed card already shows phone) |
| `showContactEmail` | boolean | B | **NEW (rev 3).** Gates the email on the card's contact line. **Default `false`** (most operators don't want a public inbox; opt-in) |
| `cardStatusBadge` | `'booking'`\|`'none'` | B | **NEW (rev 3, optional).** Toggles the "Now booking" badge on the card. Default `'booking'`. If you'd rather not add a field, hardcode the badge ON and defer — see Open Q 9.10 |
| `previousSlugs` | array of `{ slug, expiresAt(ISO) }` | A (optional) | For the 30-day redirect after a slug change. Deferrable — see 1.4 |

> The service-package list for the card's services line and the form's "Service interest" dropdown comes from the contractor's existing services data (the `/services` feature). Read it server-side via `firestoreRest`. If a contractor has no packages defined, the services line is omitted on the card and the dropdown is omitted on the form.

### 1.2 `clients/{id}` — keyed on `gardenerUid` (the owner's uid)

*Unchanged from rev 2.* Reproduced for convenience.

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
| `language` | `'en'`\|`'es'` | A | Set from the form toggle (default = `Accept-Language` detection). Drives client-facing SMS language |
| `billingMode` | `'upfront'`\|`'postvisit'` | A | Trust state (Section 6). New intake clients default `'upfront'` on accept |
| `completedJobsCount` | number | A | Increments on each paid invoice (idempotent — Section 6.3). **Missing = legacy/trusted** (no upfront banner) |
| `billingModePrompted` | boolean | A | Ensures the "switch to post-visit?" prompt shows only once |

**Lead → reminder/scheduling/rewards isolation (critical):** any client with `leadStatus === 'new'` is **excluded** from the daily SMS reminder cron, scheduling/job creation, and volume-reward math. Filter on `leadStatus !== 'new'` (missing `leadStatus` passes the filter — manual clients unaffected).

### 1.3 `rateLimits/{slug}` — spam throttle

*Unchanged from rev 2.* Best-effort read-modify-write via `firestoreRest`. Window = 1 hour; cap = **10 submissions/slug/hour** → over-cap returns HTTP 429. The limit is keyed on the slug and is unaffected by the route split (the form still POSTs to `/api/join/submit` with the slug in the body).

### 1.4 Slug resolution & forward-compat (Crew tier)

*Unchanged from rev 2.* The `slugs/{slug}` resolver collection remains the lookup index:

```
slugs/{slug} = {
  ownerType: 'user',        // becomes 'business' in Crew tier
  ownerUid:  '<uid>',       // becomes the business owner's uid; no client migration
  createdAt: ISO,
  active:    true,
  expiresAt: ISO | null     // set when slug is retired (redirect window)
}
```

Both `/join/[slug]` (card) and `/join/[slug]/request` (form) resolve the owner the same way: `get slugs/{slug}` → `ownerUid` → fetch public profile via `firestoreRest`. **Reserved slug blocklist** (reject on save), now including `request` because of the new child route: `admin, api, app, dashboard, login, signup, settings, pay, sms-opt-in, privacy, terms, clients, calendar, services, sms, onboarding, join, request`. Slug rules and the 30-day redirect behavior are unchanged from rev 2; note the redirect must now also cover `/join/[old]/request → /join/[new]/request`.

---

## 2. Routes (rev 3)

### 2.1 `GET /join/[slug]` — the digital business card (Phase A card shell, Phase B full)

- **Type:** Server component. **No Firebase client SDK.** No auth.
- **Behavior:**
  1. Resolve `slugs/{slug}` via `firestoreRest`. Missing/inactive (and not a redirectable previous slug) → branded 404 ("This card isn't active yet").
  2. Retired slug with a live `expiresAt` → 301 to the current slug.
  3. Fetch owner's public profile (`businessName`, `logoURL`, `headshotURL`, `tagline`, `bio`, `serviceArea`, service packages, `phone`, `email`, `accentColor`, `showContactPhone`, `showContactEmail`, `cardStatusBadge`) via `firestoreRest`.
  4. Detect language from `Accept-Language` (default `en`); render with a visible EN/ES toggle (top-right).
  5. Render the **card** (§3.1): hero (headshot/logo/initials + name + tagline), bio, service area, services line, contact line (gated), **primary "Request service"** button → `/join/{slug}/request`, secondary icon row (Save/Call/Text), an on-card **QR encoding `/join/{slug}/request`**, and the "Powered by YardSync" mark.
  6. **No intake form on this page.**
- **QR rendering:** server-rendered inline SVG (run a QR lib in the route, emit `<svg>`), so the QR shows even with client JS disabled. Foreground = `accentColor`, background = white, with a quiet zone.
- **No payment/Connect gating** — the card is live the moment a `publicSlug` exists.
- **Client interactivity** is isolated in a small `CardActions` client component (language toggle state, "Save contact" vCard download, copy-link). It imports **no Firebase**.

### 2.2 `GET /join/[slug]/request` — the intake form (Phase A)

- **Type:** Server component. **No Firebase client SDK.** No auth.
- **Behavior:**
  1. Resolve slug exactly as 2.1; same 404 / redirect rules. A retired slug 301s to `/join/[new]/request`.
  2. Fetch the **minimal** profile needed for the form's identity header (`businessName`, `headshotURL`/`logoURL` fallback, `tagline`) + service packages for the dropdown + `accentColor` + `phone` (for the "call instead" fallback).
  3. Render a **compact identity header** (business name + small headshot/logo + tagline) for trust continuity, a "← View full card" back link to `/join/{slug}`, and the `<IntakeForm>` client component.
- **Why a dedicated route (decision + justification):** see §3.4. In short: it keeps the card a single clean shareable URL, makes the QR a true "scan → form" destination matching the founder's mental model, and gives the form a distraction-free page (better completion). The no-JS native `<form>` fallback (Edge case 7) lives here.
- **Direct-load is fine.** Someone scanning a printed QR lands here without seeing the card first — intended. The identity header + back-link preserve trust and a path to the full card.

### 2.3 `POST /api/join/submit` — intake submission (Phase A)

*Unchanged from rev 2.* The form on `/join/{slug}/request` POSTs here with `{ slug, name, phone, email?, address?, serviceInterest?, language, note?, smsConsent, website_url (honeypot) }`. Honeypot → rate limit → validate → write `clients/{id}` (`source:'intake'`, `leadStatus:'new'`, …) → notify contractor → optional client thank-you SMS → `{ ok:true }`. Confirmation is shown in place on the request route (full-screen replace of the form).

### 2.4 `GET /api/join/[slug]/vcard` — Save-contact download (Phase B) — **NEW (rev 3)**

- **Type:** API route, server-side, `firestoreRest` read. **No Admin SDK, no client SDK.**
- **Behavior:** resolve slug → owner profile → return a `.vcf` (vCard 3.0) with `Content-Type: text/vcard` and `Content-Disposition: attachment; filename="{slug}.vcf"`. Include: `FN` = `businessName`, `ORG` = `businessName`, `TEL` = `phone` (only if `showContactPhone`), `EMAIL` = `email` (only if `showContactEmail`), `URL` = `https://yardsyncapp.com/join/{slug}`, and `PHOTO` = `headshotURL`/`logoURL` if available (as a URI ref). The card's "Save contact" button is a plain `<a href>` to this route — works without client JS.
- **Alternative:** generate the vCard string client-side in `CardActions` from data already in the DOM and trigger a `Blob` download. Either is acceptable; the route is more robust and supports no-JS. **Recommendation: the route.**

### 2.5 Settings additions (Phase A + B)

- **`/settings` (`app/settings/SettingsContent.js`)** gains a **"YardSync Card"** section containing:
  - **"Generate your YardSync card" CTA** (Phase A): one click → auto-generate slug from `businessName`, create `slugs/{slug}`, set `publicSlug`, enable `/join`.
  - **Live card preview tile** (Phase B, §3.5): ~280×400, mirrors the public card, updates from local form state with **no save** required.
  - **Slug editor** (Phase A): shows the `/join/[slug]` URL with copy button; debounced availability + reserved-word/format validation.
  - **Field editors** (Phase B): headshot upload (reuse `LogoUpload`), `tagline`, `bio` (≤300 char counter), `serviceArea`, `accentColor` (color picker), and **two toggles**: "Show phone on card" (`showContactPhone`, default on) and "Show email on card" (`showContactEmail`, default off).
  - **QR + asset downloads** (Phase B): on-screen QR for `/join/{slug}/request` (download PNG) and the "Download business card / social post / story" buttons (§7).

### 2.6 `GET /api/card/[slug]` — print/social asset generation (Phase B)

*Unchanged from rev 2 except the QR target.* Generates `print` (PDF) / `square` (PNG) / `story` (PNG) from the shared template (§7). **All generated QR codes encode `https://yardsyncapp.com/join/{slug}/request`** (the form), consistent with the on-card QR.

### 2.7 Webhook change — `app/api/stripe/webhook/route.js` (Phase A, trust state)

*Unchanged from rev 2.* On `invoice.payment_succeeded`, idempotently increment `clients/{clientId}.completedJobsCount` and trigger the one-time billing-mode prompt eligibility (Section 6).

---

## 3. UX Flow (rev 3 — card-first)

### 3.0 The model in one line

**Card = identity = the thing you share. Form = action = the thing you scan into.** Sharing a URL lands on the card (build trust, choose an action); scanning a QR lands on the form (identity already established by the in-person/printed context).

### 3.1 `/join/[slug]` — the digital business card

```
┌─────────────────────────────────────────┐
│                              [ EN | ES ]  │  ← language toggle (top-right)
│                                           │
│                ╭───────────╮              │
│                │  headshot  │             │  ← round ~96px; logo / initials fallback
│                ╰───────────╯              │
│               [ business logo ]           │  ← small, beneath headshot (if both exist)
│                                           │
│             GREEN ACRES LAWN              │  ← business name — DM Serif Display
│          Reliable weekly mowing           │  ← tagline — DM Sans
│                                           │
│              ‹ Now booking ›              │  ← status badge (accentColor) — optional
│                                           │
│   We keep San Antonio yards sharp with    │  ← bio (≤300 chars) — DM Sans
│   weekly mowing, edging, and cleanups.    │
│                                           │
│   📍 San Antonio & NE suburbs             │  ← serviceArea (if set)
│   🍃 Mowing · Edging · Cleanups            │  ← services line (if packages exist)
│                                           │
│   ┌─────────────────────────────────────┐ │
│   │        Request service       →      │ │  ← PRIMARY · accentColor · large
│   └─────────────────────────────────────┘ │     → /join/{slug}/request
│                                           │
│     [ 💾 Save ]   [ 📞 Call ]   [ ✉ Text ] │  ← secondary icon row (gated by flags)
│                                           │
│              ╭───────────────╮            │
│              │ ▓▓▓  ▓  ▓▓▓▓▓ │            │  ← QR → /join/{slug}/request
│              │ ▓  ▓▓▓▓  ▓  ▓ │            │     accentColor foreground, SSR'd SVG
│              │ ▓▓▓▓  ▓  ▓▓▓  │            │
│              ╰───────────────╯            │
│            Scan to request service        │
│                                           │
│   ─────────────────────────────────────   │
│            🍃 Powered by YardSync          │  ← non-removable footer mark + link
└─────────────────────────────────────────┘
        (mobile-first single column, 360px min width)
```

**Hero fallback chain** (never a broken image):
- headshot + logo → both shown (headshot leads, logo small beneath).
- headshot only → headshot.
- logo only → logo.
- neither → generated initials avatar from `businessName` (e.g. "GA"), filled with `accentColor`.

**Contact line / secondary actions gating:**
- "Call" + "Text" + any visible phone → shown only if `showContactPhone === true`.
- visible email → shown only if `showContactEmail === true`.
- "Save contact" (vCard) is **always** shown (it's how a prospect keeps the contractor), but the vCard only includes the channels the contractor opted to expose.

**Accent usage:** primary button fill, status badge, focus rings, QR foreground — all `accentColor` (default `#0F6E56`). Everything else is the YardSync neutral palette.

**Language:** initial from `Accept-Language`; the toggle re-renders all YardSync chrome strings. `tagline`/`bio` are contractor-authored and **not** translated — they render as written.

### 3.2 `/join/[slug]/request` — the intake form

```
┌─────────────────────────────────────────┐
│  ‹ View full card                [EN|ES]  │  ← back link + language toggle
│                                           │
│   ╭────╮                                  │
│   │ 📷 │  GREEN ACRES LAWN                 │  ← compact identity header (trust)
│   ╰────╯  Reliable weekly mowing           │
│   ─────────────────────────────────────   │
│                                           │
│   Request service                         │  ← H1 — DM Serif Display
│   Tell us what you need and we'll be       │  ← subhead — DM Sans
│   in touch.                               │
│                                           │
│   Full name*            [______________]  │  ← hard-required
│   Phone*                [______________]  │  ← hard-required, E.164 normalize
│   Service address       [______________]  │  ← soft-required (confirm if blank)
│   Email (optional)      [______________]  │
│   Service interest ▾  (if packages exist) │
│   Notes (optional)      [______________]  │
│                                           │
│   ☐ Text me updates about my request      │
│      Reply STOP to opt out. Msg & data     │
│      rates may apply.                     │
│   (hidden honeypot: website_url)          │
│                                           │
│   ┌─────────────────────────────────────┐ │
│   │            Send request             │ │  ← accentColor
│   └─────────────────────────────────────┘ │
│                                           │
│   Prefer to call? (tel: contractor #)     │  ← also the no-JS fallback CTA
│            🍃 Powered by YardSync           │
└─────────────────────────────────────────┘
```

- **Validation rules** (full name hard-required; phone hard-required + E.164 at exactly 10 local digits; address soft-required with a confirm dialog; email/interest/notes optional; SMS consent default unchecked) are **unchanged from rev 2 §3.2**.
- **No-JS fallback:** the form is a native `<form action="/api/join/submit" method="POST">` with the slug in a hidden input; honeypot + server validation still apply. The "Prefer to call?" `tel:` link is the always-visible escape hatch.
- **Confirmation** replaces the form in place: *"Thanks! {businessName} will be in touch."* + (if consent) *"We've texted a confirmation to your phone."* + a "Call now" `tel:` CTA. Unchanged from rev 2 §3.3.

### 3.3 Navigation map

```
        share URL (SMS / social / website)
                       │
                       ▼
         /join/{slug}  ── the CARD ──────────────┐
            │  primary button "Request service"   │
            │                                      │  "View full card" back-link
            ▼                                      ▲
   /join/{slug}/request ── the FORM ──────────────┘
            ▲
            │   scan
   QR codes (on-card display, printed card, social square/story)
   all encode /join/{slug}/request
```

### 3.4 Decision: intake form URL structure — **separate route `/join/{slug}/request`** (recommended)

Two options were on the table:

**(a) Same-page reveal** — "Request service" expands/scrolls to a form below the card; one URL.
**(b) Separate route** `/join/{slug}/request` — a dedicated form page. **← chosen.**

**Why (b):**

| Criterion | (a) Same-page reveal | (b) Separate route ✅ |
|---|---|---|
| One clean shareable URL | Yes (the only URL) | **Yes** — the card URL `/join/{slug}` is the canonical share link; the form URL is a child, not a competitor |
| Matches founder's mental model ("QR leads to the form as a separate destination") | Partial — the form is the same page | **Strong** — the form is a real, separate destination the QR lands on |
| Card-first visual emphasis | Good, but the form lives in the same DOM and can pull focus / lengthen the page | **Best** — the card page has zero form, stays purely the "card" |
| Form completion rate | Fine; but a long scrolling page mixes "browse" and "convert" intents | **Better** — a distraction-free form page is a cleaner conversion surface |
| No-JS fallback (Edge case 7) | Workable but awkward (form hidden in DOM + anchor) | **Clean** — the route *is* a server-rendered page with a native `<form>` |
| QR semantics | QR must deep-link (`#request`/`?request=1`) and rely on JS to open the form | **Unambiguous** — QR encodes a real URL that renders the form server-side |
| Cost of the extra route | n/a | Low — same slug resolver, same API, ~1 new `page.js` |

**The decisive point:** rev 3 wants the **card to be the share asset and the QR to be a scan-into-form**. A separate route lets those two things be two clean URLs with no overloading: you *share the card*, you *scan into the form*. The only real cost of (b) — "two URLs to keep straight" — is actually the feature here, and the on-card primary button + the form's "View full card" back-link keep them tied together. **Build (b).**

> Conversion note for later A/B testing: if data ever shows the extra hop suppresses cold-share conversions, we can add an optional `?form=1` param to `/join/{slug}` that auto-expands an inline form — i.e. layer (a) on top of (b) without changing the canonical URLs. Not needed for v1; documented so we don't repaint ourselves into a corner.

### 3.5 Settings — live card preview tile

```
 YardSync Card                                    Open full card →
 ┌─────────────────────────────┐
 │                    [ EN|ES ] │
 │           ╭───────╮          │
 │           │ photo │          │
 │           ╰───────╯          │
 │          GREEN ACRES         │   ← name (DM Serif Display)
 │        Reliable mowing…      │   ← tagline
 │         ‹ Now booking ›      │
 │   We keep SA yards sharp…    │   ← bio (truncates in preview)
 │   📍 San Antonio             │
 │   🍃 Mowing · Edging          │
 │  ┌────────────────────────┐  │
 │  │     Request service    │  │   ← accentColor (live)
 │  └────────────────────────┘  │
 │   [Save] [Call] [Text]       │   ← reflect the show-contact toggles live
 │          ▓▓ QR ▓▓            │   ← encodes /join/{slug}/request
 │     🍃 Powered by YardSync    │
 └─────────────────────────────┘
   ~280 × 400 · full-width on mobile
   Updates live as you edit — no save needed
```

- A **client component** `CardPreview` renders from **local React state mirroring the Settings form inputs** (controlled fields), so typing a tagline or picking an accent color updates the tile instantly with no Firestore write. It imports **no Firebase** — it's a pure view over current form values.
- It mirrors the public card's composition (same element order, fallback chain, accent usage) at reduced scale, so "what you see in Settings = what prospects see."
- Toggling "Show phone/email on card" shows/hides the contact actions in the preview immediately.
- **"Open full card"** links to `/join/{slug}` (only enabled once a slug exists).
- **Reuse for assets:** the same composition feeds the Phase B print/social generator (§7) — see §7.2 on the shared template.

### 3.6 New Leads in `/clients`

*Unchanged from rev 2 §3.4.* A "New leads (N)" section lists `source:'intake' && leadStatus:'new'`, newest first, each with name/phone/address/interest/note/submitted-at/language/consent badge and a possible-duplicate hint. Actions: **Accept** (→ `leadStatus:'accepted'`, `billingMode:'upfront'`, `completedJobsCount:0`) or **Dismiss** (→ `leadStatus:'dismissed'`, soft-delete).

### 3.7 Settings first-run

*Unchanged from rev 2 §3.5.* If `publicSlug` is null, show the "Generate your YardSync card" CTA. After generation, the slug editor, live preview, QR, and asset tools appear.

---

## 4. Copy (EN + ES)

> All strings go through `lib/i18n.js`. **Rev 3 keys are marked NEW.** Existing rev 2 keys (form labels, errors, confirmation, SMS templates, trust-state) are **unchanged** — reproduced compactly below; the new card/preview strings are the additions.

### 4.1 Card + actions — **NEW (rev 3)**

| Key | EN | ES |
|---|---|---|
| `card.requestService` | Request service | Solicitar servicio |
| `card.saveContact` | Save contact | Guardar contacto |
| `card.call` | Call | Llamar |
| `card.text` | Text | Enviar mensaje |
| `card.scanToRequest` | Scan to request service | Escanee para solicitar servicio |
| `card.nowBooking` | Now booking | Reservando ahora |
| `card.poweredBy` | Powered by YardSync | Con tecnología de YardSync |
| `card.notActive` | This card isn't active yet. | Esta tarjeta aún no está activa. |

### 4.2 Request page — **NEW (rev 3)**

| Key | EN | ES |
|---|---|---|
| `request.viewFullCard` | View full card | Ver tarjeta completa |
| `request.heading` | Request service | Solicitar servicio |
| `request.subhead` | Tell us what you need and we'll be in touch. | Cuéntenos qué necesita y nos comunicaremos. |

### 4.3 Form / page labels — *unchanged from rev 2*

| Key | EN | ES |
|---|---|---|
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

### 4.4 Errors / dialogs — *unchanged from rev 2*

| Key | EN | ES |
|---|---|---|
| `err.nameRequired` | Please enter your name. | Por favor ingrese su nombre. |
| `err.phoneRequired` | Please enter a valid phone number. | Por favor ingrese un número de teléfono válido. |
| `err.phoneInvalid` | That phone number doesn't look right. | Ese número de teléfono no parece correcto. |
| `err.emailInvalid` | That email doesn't look right. | Ese correo no parece correcto. |
| `confirm.skipAddress` | Without an address we can't visit or quote you. Skip anyway? | Sin una dirección no podemos visitarlo ni cotizarle. ¿Omitir de todos modos? |
| `err.rateLimited` | Please try again in a few minutes. | Por favor intente de nuevo en unos minutos. |
| `err.generic` | Something went wrong. Please try again or call us. | Algo salió mal. Intente de nuevo o llámenos. |

### 4.5 Confirmation — *unchanged from rev 2*

| Key | EN | ES |
|---|---|---|
| `confirm.thanks` | Thanks! {businessName} will be in touch. | ¡Gracias! {businessName} se pondrá en contacto. |
| `confirm.smsSent` | We've texted a confirmation to your phone. | Le enviamos una confirmación por mensaje de texto. |

### 4.6 SMS templates — *unchanged from rev 2*

**Contractor notification** (to contractor's own phone — **no STOP line**, ≤160 chars, ASCII single-segment; send in the contractor's `language` per Open Q 9.7):
```
EN: New YardSync lead: {clientName} ({phone}). Open YardSync to follow up: yardsyncapp.com/clients
ES: Nuevo cliente YardSync: {clientName} ({phone}). Abra YardSync para responder: yardsyncapp.com/clients
```

**Client thank-you** (only if `smsConsent === true`; STOP + business name):
```
EN: Hi {clientName}! Thanks for your request to {businessName}. We'll be in touch soon. Reply STOP to opt out. – {businessName}
ES: ¡Hola {clientName}! Gracias por su solicitud a {businessName}. Pronto nos comunicaremos. Responda STOP para cancelar. – {businessName}
```

### 4.7 Settings / card editor — **partly NEW (rev 3)**

| Key | EN | ES | New? |
|---|---|---|---|
| `settings.cardSection` | YardSync Card | Tarjeta YardSync | NEW |
| `settings.generateCard` | Generate your YardSync card | Genere su tarjeta YardSync | — |
| `settings.openFullCard` | Open full card | Abrir tarjeta completa | NEW |
| `settings.headshot` | Personal photo | Foto personal | — |
| `settings.tagline` | Tagline | Eslogan | — |
| `settings.bio` | About your business | Acerca de su negocio | NEW |
| `settings.bioHint` | Up to 300 characters | Hasta 300 caracteres | NEW |
| `settings.serviceArea` | Service area | Área de servicio | — |
| `settings.accentColor` | Brand color | Color de marca | — |
| `settings.showPhone` | Show phone on card | Mostrar teléfono en la tarjeta | NEW |
| `settings.showEmail` | Show email on card | Mostrar correo en la tarjeta | NEW |
| `settings.previewLive` | Updates live as you edit — no save needed | Se actualiza mientras edita — no es necesario guardar | NEW |
| `settings.downloadCard` | Download business card (PDF) | Descargar tarjeta de presentación (PDF) | — |
| `settings.downloadSquare` | Download social post | Descargar publicación | — |
| `settings.downloadStory` | Download story | Descargar historia | — |

### 4.8 Leads / trust-state — *unchanged from rev 2*

| Key | EN | ES |
|---|---|---|
| `lead.accept` | Accept | Aceptar |
| `lead.dismiss` | Dismiss | Descartar |
| `lead.possibleDuplicate` | Possible duplicate of {name} | Posible duplicado de {name} |
| `trust.firstTimeBanner` | First-time client — invoice will require payment before service. Let them know to pay ahead, or service can't be rendered. | Cliente nuevo — la factura requiere pago antes del servicio. Avísele que pague por adelantado, o no se puede prestar el servicio. |
| `trust.switchPrompt` | {clientName} paid their first invoice. Switch to post-visit billing for this client? | {clientName} pagó su primera factura. ¿Cambiar a facturación después de la visita para este cliente? |

---

## 5. Edge Cases (rev 3 additions in **bold**)

Rev 2 cases 1–18 carry forward unchanged. New/updated:

| # | Scenario | Behavior |
|---|---|---|
| 2 | Contractor has no logo | Card shows headshot only. |
| 3 | Neither logo nor headshot | Generated initials avatar from `businessName`. Never a broken image. |
| 4 | No service packages | Omit the services line on the card and the "Service interest" dropdown on the form. |
| 7 | QR scanned, **JS disabled** | **`/join/{slug}/request` is server-rendered: identity header, native `<form action="/api/join/submit" method="POST">`, and the `tel:` "call instead" CTA all work. The QR-encoded URL renders the form directly with no client JS.** |
| 10 | Slug not generated | Branded "card not active" page on both `/join/{slug}` and `/join/{slug}/request`. |
| 11 | Slug changed, old QR scanned | 301 to the new slug for 30 days (if shipped): `/join/[old] → /join/[new]` and **`/join/[old]/request → /join/[new]/request`**. Else branded 404. |
| 19 | **`showContactPhone === false`** | **Hide the phone, "Call," and "Text" actions on the card; the vCard omits `TEL`. "Save contact" still appears (with whatever channels are exposed).** |
| 20 | **`showContactEmail === false`** | **Hide the email on the card; the vCard omits `EMAIL`.** |
| 21 | **Both contact flags off** | **Card still works: "Request service" + QR + "Save contact" (URL-only vCard) remain. The icon row may collapse to just "Save."** |
| 22 | **Card loaded with client JS disabled** | **Card is server-rendered: hero, bio, services, the SSR'd QR SVG, "Request service" (a normal `<a>`), "Call"/"Text" (`tel:`/`sms:` links), and "Save contact" (`<a>` to the vCard route) all function. Only the EN/ES live toggle needs JS; the page still renders in the `Accept-Language` default without it.** |
| 23 | **Bio over 300 chars** | **Settings blocks save past 300; render truncates with an ellipsis as a safety net.** |
| 24 | **Someone deep-links `/join/{slug}/request` directly (printed QR)** | **Intended. Identity header + "View full card" back-link provide context; no card visit required.** |

---

## 6. Trust-State Billing Mechanic (per-client)

*Unchanged from rev 2.* Per-client `billingMode` (`'upfront'`→`'postvisit'`), idempotent `completedJobsCount` increment on `invoice.payment_succeeded` (per-invoice `countedTowardTrust` guard), one-time switch prompt, legacy (missing count) = trusted. See rev 2 §6.1–6.4 — no changes from the card-first redesign.

---

## 7. Card generation — print + social (Phase B, rev 3)

### 7.1 Outputs

*Unchanged sizes from rev 2.* One template, multiple exports, all per-contractor from the same field set. The operator's brand leads; YardSync rides as a small trust mark.

| Output | Size | Format | Use |
|---|---|---|---|
| Print card — front + back | 3.5" × 2" + 1/8" bleed | PDF, 300 DPI, CMYK-safe | Hand-out card, print shop |
| Social square | 1080 × 1080 px | PNG | Feed posts (FB / IG / Nextdoor) |
| Social story | 1080 × 1920 px | PNG | IG / FB stories |
| **Digital card (new)** | responsive, 360px min | live web (`/join/{slug}`) | The shareable link + on-screen QR |

**Per-contractor inputs** (all from `users/{uid}` + slug): `headshotURL`, `logoURL`, `businessName`, `tagline`, `bio`, services line, `phone`, `serviceArea`, `accentColor`, and a **QR encoding `https://yardsyncapp.com/join/{slug}/request`** (the form — same target as the on-card QR).

**Branding rules** (unchanged): contractor brand leads; the **"Powered by YardSync"** mark is fixed and **non-removable on the free/standard tier**. `accentColor` defaults to `#0F6E56` when unset. Substitute the real YardSync brand palette/fonts for any placeholder.

### 7.2 Shared hero composition — Phase B compatibility (**confirmed feasible**)

**The ask:** the new digital card should share its hero composition with the print card / social square / social story so the visual identity is consistent. **Confirmed — feasible, with one structural note.**

- **Single source of composition:** `lib/cardTemplate.js` becomes a **framework-neutral composition spec** — it exports the ordered element list, relative proportions, accent/role-color mapping, the fallback chain (headshot → logo → initials), the "Powered by YardSync" mark placement, and the QR treatment. It contains **layout/data, not rendering** — no JSX, no canvas calls — so both consumers can read it.
- **Two renderers, one composition:**
  - The **digital card** (`/join/{slug}`) renders the composition with React + Tailwind (interactive: buttons, live QR SVG, EN/ES toggle).
  - The **print/social generator** (`/api/card/[slug]`) renders the *same* composition through the server-side HTML/SVG → image/PDF pipeline (static: the interactive buttons collapse to the QR + phone + slug URL).
- **Why they can't literally share render code (the note):** one is an interactive client/server React tree; the other is a static image/PDF pipeline. They **share the composition spec and the brand tokens**, not the component code. This is the same "digital card is the interactive superset; print formats are the static projection" relationship — the hero (headshot/logo/initials + name + tagline + accent + YardSync mark) is pixel-consistent across all four because all four read `cardTemplate.js`.
- **No changes required** to the rev 2 §7.1 print/social layouts beyond pointing their QR at `/join/{slug}/request` (already specified above) and sourcing the hero from the shared spec. **Confirmed compatible.**

---

## 8. Implementation Notes

*Reuse the rev 2 patterns:* `lib/firestoreRest.js` (server Firestore; extend with a slug-resolver `get` + clients `runQuery` if missing), `lib/sms.js` `sendSms()` → `TWILIO_MESSAGING_SERVICE_SID`, `PhoneInput` normalization from `app/clients/ClientsContent.js`, `lib/i18n.js` `translate()`, `lib/baseUrl.js`, `LogoUpload` (commit `bcc87ed`) for headshot, Node `crypto` SHA-256 for `uaHash`/`ipHash`.

**Rev 3 specifics:**
- **No Firebase in the `/join` trees** (both `/join/[slug]` and `/join/[slug]/request`): pages are server components reading via `firestoreRest`; `CardActions` and `IntakeForm` are client components importing no Firebase.
- **QR:** render server-side as inline SVG (run a QR lib in the route) so the QR survives no-JS. The Settings on-screen QR and the live-preview QR can use the same lib client-side for the download-PNG path.
- **vCard:** `lib/vcard.js` builds a vCard 3.0 string; served by `app/api/join/[slug]/vcard/route.js`.
- **Accent color at runtime:** apply `accentColor` via inline `style` (Tailwind can't JIT arbitrary runtime hex). Keep contrast safe — if a contractor picks a very light accent, the primary button text should stay legible (use a luminance check to pick black/white button text).

### 8.1 New files / routes / components vs. modifications

**NEW files:**

| File | Purpose |
|---|---|
| `app/join/[slug]/CardActions.js` | Client component: EN/ES toggle state, "Save contact" (links to vCard route), copy-link, `tel:`/`sms:` actions. No Firebase. |
| `app/join/[slug]/request/page.js` | **NEW route.** Server component: resolve slug, fetch minimal profile + packages, render identity header + `<IntakeForm>`. No Firebase client SDK. |
| `app/api/join/[slug]/vcard/route.js` | **NEW.** Returns `text/vcard` download (gated by `showContactPhone`/`showContactEmail`). |
| `app/settings/CardPreview.js` | **NEW.** Client component: live ~280×400 preview from local Settings form state. No Firebase. |
| `lib/vcard.js` | **NEW.** Build a vCard 3.0 string from a profile. |
| `lib/cardTemplate.js` | (Planned in rev 2; now also the **shared hero composition spec** consumed by the digital card + asset generator — §7.2.) |

**MODIFIED files:**

| File | Change |
|---|---|
| `app/join/[slug]/page.js` | **Repurposed:** was the form host; now renders the **card** (hero, bio, services, contact line, primary button → `/request`, secondary actions, SSR QR → `/request`, YardSync mark). Remove the intake form from this tree. |
| `app/join/[slug]/IntakeForm.js` | **Moved consumer:** now imported by `app/join/[slug]/request/page.js` instead of the card page. Form logic unchanged; ensure the native `<form>` no-JS fallback is intact. |
| `app/settings/SettingsContent.js` | Add the "YardSync Card" section: generate-card CTA, slug editor, **`CardPreview`**, headshot upload, `tagline`, **`bio` (300-char counter)**, `serviceArea`, `accentColor` picker, **`showContactPhone`/`showContactEmail` toggles**, QR + asset downloads. |
| `app/api/card/[slug]/route.js` | Phase B generator; ensure all QR codes encode `/join/{slug}/request`; source hero from `lib/cardTemplate.js`. |
| `lib/slug.js` | Add `request` to the reserved blocklist. |
| `lib/firestoreRest.js` | (If needed) slug-resolver `get` + clients `runQuery` helpers. |
| `app/api/stripe/webhook/route.js` | Idempotent `completedJobsCount` increment (rev 2 §6.3 — unchanged). |

**Routes summary:**

| Route | Method | Renders / does | Auth |
|---|---|---|---|
| `/join/[slug]` | GET | Digital business card | none |
| `/join/[slug]/request` | GET | Intake form (+ identity header) | none |
| `/api/join/submit` | POST | Write lead + notify (unchanged) | none |
| `/api/join/[slug]/vcard` | GET | vCard download | none |
| `/api/card/[slug]` | GET | Print/social asset (Phase B) | none |

### 8.2 New fields on `users/{uid}` (rev 3)

| Field | Type | Default | Purpose |
|---|---|---|---|
| `bio` | string (≤300) | `''` | Card "about" paragraph |
| `showContactPhone` | boolean | `true` | Gate phone + Call/Text + vCard `TEL` |
| `showContactEmail` | boolean | `false` | Gate email + vCard `EMAIL` |
| `cardStatusBadge` | `'booking'`\|`'none'` | `'booking'` | "Now booking" badge toggle (optional — Open Q 9.10) |

(Plus the rev 2 Phase B fields already specified: `headshotURL`, `serviceArea`, `tagline`, `accentColor`, `publicSlug`.)

---

## 9. Open Questions (rev 3 additions: 9.9–9.11)

Rev 2 questions 1–8 carry forward unchanged (trust-state legacy default, `leadStatus` filter location, duplicate-phone handling + match scope, card brand palette/fonts, slug-redirect ship-or-defer, bio source [**now resolved → add `bio`, see 9.6 below**], contractor notification language, `serviceArea` visibility).

6. **Bio — RESOLVED (rev 3).** Add a single free-text `bio` (≤300 chars) to `users/{uid}`; contractor-authored, not auto-translated. Rendered on the card and (optionally) reused in social assets.

9. **Contact gating defaults.** Recommended `showContactPhone: true`, `showContactEmail: false`. Confirm — or default phone off too if you want strict opt-in. **Recommendation: phone on, email off.**

10. **Status badge field.** Add `cardStatusBadge` (`'booking'`/`'none'`) so contractors can hide "Now booking," or hardcode the badge ON for v1 and defer the field? **Recommendation: add the field, default `'booking'` — it's one toggle and "Now booking" isn't always true.**

11. **vCard delivery.** Server route (`/api/join/[slug]/vcard`, no-JS friendly) vs. client-side `Blob` generation. **Recommendation: the route.**

---

## 10. Build / Verification Checklist (PR to `chore/preview-env`)

- [ ] `/join/[slug]` renders the **card** (no intake form in its tree) with **zero** Firebase client SDK imports (grep the build).
- [ ] `/join/[slug]/request` renders the **form** with the identity header + "View full card" link; zero Firebase client SDK imports.
- [ ] The card's "Request service" button and the on-card QR both target `/join/{slug}/request`; printed/social QR codes encode the same.
- [ ] On-card QR is **server-rendered SVG** and scans to the form with client JS disabled.
- [ ] "Save contact" downloads a valid `.vcf`; `TEL`/`EMAIL` respect `showContactPhone`/`showContactEmail`; "Call"/"Text"/phone hidden when `showContactPhone` is false.
- [ ] Settings **live preview** updates from form state with no save; mirrors the public card; reflects accent + contact toggles instantly.
- [ ] `bio` capped at 300 chars (save-blocked + render-truncated).
- [ ] Slug resolver works for both routes; `request` rejected as a reserved slug; collisions suffix correctly; 30-day redirect (if shipped) covers `/request`.
- [ ] Intake writes `clients/{id}` with all §1.2 fields; lead excluded from reminder cron; honeypot drops silently; 429 at >10/hr.
- [ ] Contractor notification SMS (≤1 segment, no STOP, contractor's language); thank-you SMS only on consent, correct language, with STOP + business.
- [ ] EN/ES verified on every YardSync string; `Accept-Language` detection + toggle both work; `tagline`/`bio` render as authored (not translated).
- [ ] No-JS native `<form>` posts and validates server-side on `/request`.
- [ ] New Leads Accept/Dismiss + duplicate hint; trust banner on first-time invoice; idempotent `completedJobsCount` (fire a duplicate webhook in test mode).
- [ ] Phase B: headshot/tagline/bio/accent/service-area/contact-toggles save; QR correct; all exports (print PDF front+back, social square, social story) generate with contractor branding + the YardSync mark, hero sourced from `lib/cardTemplate.js`.
- [ ] Full E2E on the preview URL with test Stripe keys before any merge to `main`.
