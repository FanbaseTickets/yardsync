# Smart Business Card (rev 3 card-first) + trust-state + New Leads UI

> **How to use this file:** This is the PR body text. Open the PR-creation URL below in a browser, paste this content (skip the H1 line above — that becomes the PR title), and submit.
>
> PR-creation URL: https://github.com/FanbaseTickets/yardsync/compare/main...chore/preview-env?expand=1
>
> Title: `Smart Business Card (rev 3 card-first) + trust-state + New Leads UI`

---

## Summary

Ships the Smart Business Card feature end-to-end (rev 3 card-first redesign), the trust-state billing mechanic, and the New Leads UI in `/clients`. 24 commits accumulated on `chore/preview-env` over a multi-session build, all verified by Claude Chrome across 15 explicit test scenarios.

## What ships

### Smart Business Card (rev 3 — card-first)
- **`/join/[slug]`** is a digital business card (hero, name, tagline, "Now booking" badge, bio, service area, services line, primary "Request service" CTA, secondary Save/Call/Text row, server-rendered QR SVG, "Powered by YardSync" mark). Mobile-first, bilingual EN/ES, accent-color themed per contractor.
- **`/join/[slug]/request`** is the intake form (compact identity header + form). Where the on-card QR and printed/social QR codes land.
- **`/api/join/[slug]/vcard`** — vCard 3.0 download for "Save contact." TEL/EMAIL gated by `showContactPhone` / `showContactEmail` flags. Normalized to E.164.
- **Settings → YardSync Card section** — live `CardPreview` tile (no save required to see changes), bio (300-char counter), contact-visibility toggles, "Now booking" badge toggle, brand-accent color picker, **Direct intake link** alongside the card URL for warm-lead workflows.
- New `users/{uid}` fields: `bio`, `showContactPhone` (default true), `showContactEmail` (default false), `cardStatusBadge` (default 'booking'), `email`.
- New collections: `slugs/{slug}` (resolver doc, forward-compat with future Crew tier), `rateLimits/{slug}` (10-submissions/hour spam throttle). Firestore rules added.
- 30-day old-slug redirect window for printed QR codes after a slug change.
- Server-rendered QR + branded 404 + no-JS native form fallback all work without client JS.

### Trust-state billing mechanic (spec §6)
- Per-client `billingMode` (`upfront` | `postvisit`), `completedJobsCount`, `billingModePrompted`.
- Webhook (`invoice.payment_succeeded`) idempotently increments `completedJobsCount` on the client doc, guarded by per-invoice `countedTowardTrust` flag so Stripe retries don't double-count.
- Client detail page shows an **amber first-time-upfront banner** (count=0) and a **one-time "switch to post-visit?" prompt** (count≥1). Either answer sets `billingModePrompted=true` so the prompt never re-shows.
- Per-client `upfrontDeadlineHours` override on the edit modal (1–168), inherits the global Settings default when blank.
- `lib/invoiceSms.js` picks between a standard short template (existing clients) and a first-time-upfront template ("please pay within Nh before service") for invoice payment-link SMS. Walk-ins always get standard. Stays single-segment (≤160 chars).

### New Leads UI in `/clients`
- "New leads (N)" section above the regular client list — only `leadStatus === 'new'` docs.
- Per-lead card: name, age, language/SMS-consent pills, clickable phone/email, address, service interest, note, possible-duplicate hint, **Accept** / **Dismiss** buttons.
- Accept → `leadStatus:'accepted'`, `billingMode:'upfront'`, `completedJobsCount:0`, `status:'active'`.
- Dismiss → `leadStatus:'dismissed'` (soft-delete, kept for audit + duplicate detection).
- Regular client list + active/inactive counts both exclude `leadStatus IN ('new','dismissed')`.
- Lead phones formatted via the existing `formatPhone()` helper.

## Tested

15 explicit test scenarios, all PASS:

| # | Scope | Status |
|---|---|---|
| 1 | Card page render + EN/ES toggle | ✅ |
| 2 | Primary CTA → form route | ✅ |
| 3 | Back-link navigation | ✅ |
| 4 | QR target verification (encodes `/request`) | ✅ |
| 4b | Phone scan after Vercel auth disable | ✅ |
| 5 | vCard download — TEL/EMAIL gating + E.164 format | ✅ |
| 6 | End-to-end form submission + confirmation screen | ✅ |
| 7 | Branded 404 on missing slug (both routes) | ✅ |
| 8 | Direct intake link in Settings | ✅ |
| 9 | Both URLs work standalone (no login) | ✅ |
| 10 | New Leads section in /clients | ✅ |
| 11 | Accept lead → graduates to active client w/ upfront billing | ✅ |
| 12 | First-time-upfront banner on client detail | ✅ |
| 13 | Dismiss lead — soft-delete + hidden from list | ✅ |
| 14 | Per-client deadline override field (visible only for upfront) | ✅ |
| 15 | First-time SMS template body construction (EN + ES + override) | ✅ |

## Architectural notes

- **No Firebase Admin SDK** — all server-side Firestore via `lib/firestoreRest.js`.
- **No Firebase Client SDK** in `/join/[slug]` or `/join/[slug]/request` (server components + client components that import no Firebase).
- **No payment/Connect gating** on the card — it's live the moment a `publicSlug` exists.
- **Server-rendered QR** as inline SVG so it scans even with client JS disabled.
- **Per-environment QR target** — uses request host for the QR's encoded URL, so Preview QRs work in Preview and production QRs work in production.
- **One-shot form init** in Settings (useRef-guarded) so AuthContext background re-renders don't stomp user edits.
- **No-JS native `<form>` fallback** on the intake form route — submits to `/api/join/submit` with the slug in a hidden input.

## Deferred to follow-up PRs

- **C10 (Phase B asset generation)** — headshot upload + printable PDF card + 1080×1080 social square + 1080×1920 social story + downloadable QR PNG. Spec §7. Will share `lib/cardTemplate.js` composition spec with the digital card.
- **C11 (i18n consolidation)** — inline EN/ES STRINGS tables get folded into `lib/i18n.js`.
- **Settings tab refactor** — the page is getting long (Profile / Card / SMS / Billing). Convert to top tabs with `?tab=` URL param.

## Test plan post-merge

- [ ] Visit `https://yardsyncapp.com/settings` as a logged-in contractor → confirm the new YardSync Card section renders
- [ ] Generate a slug → confirm `https://yardsyncapp.com/join/{slug}` shows the card
- [ ] Confirm the QR on the card scans to `https://yardsyncapp.com/join/{slug}/request`
- [ ] Submit a test lead → confirm it appears in `/clients` New Leads section
- [ ] Accept the lead → confirm trust-state banner shows
- [ ] Optional: dollar-test invoice → confirm webhook increments `completedJobsCount` and the switch prompt appears on re-open

🤖 Generated with [Claude Code](https://claude.com/claude-code)
