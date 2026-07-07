# YardSync — Master Backlog (priority-ordered)

> Single source of truth, highest priority → lowest. Status live in production. Detailed specs live in `docs/QA_PUNCH_LIST.md` (bugs), `ROADMAP.md` (phases), and the Claude memory store (feature ideas).
> Last updated: 2026-06-20.

## TIER 1 — Pre-launch polish (finish before scaling outreach)

| # | Item | Status |
|---|------|--------|
| 1 | Invoice route auth + validation + double-send guard | ✅ shipped (PR #23) |
| 2 | Strict NANP phone validation | ✅ shipped (PR #23) |
| 3 | Trust-state increment on real client payment | ✅ shipped (PR #21) |
| 4 | Recurring future-month double-booking check | ✅ shipped (PR #24) |
| 5 | Edit-client at-least-one-contact validation | ✅ shipped (PR #24) |
| 6 | Honest invoice SMS toasts (I) | ✅ shipped (PR #25) |
| 7 | Intake name validation / spam (P) | ✅ shipped (PR #25) |
| 8 | **Settings tab refactor** (Profile·Card·SMS·Billing, `?tab=`) | 🔧 round 2d |
| 9 | **Walk-in default price blank + drop $0 lines (J)** | 🔧 round 2d |
| 10 | **Price-input clamping `min=0` (S)** | 🔧 round 2d |
| 11 | Test-account teardown (prod + dev) before real signups | 🟡 in progress (Jay) |
| 12 | Deep-link `?tab=` targeting from signup/Connect/manage-sub flows | ⬜ follow-up to #8 |
| 13 | LOW cosmetic: `getInitials` double-space crash; EN/ES "SMS OK" string; no-JS submit error display; honeypot/rate-limit success screen | ⬜ |

## TIER 2 — Phase 2 (post-launch growth)

| # | Item |
|---|------|
| 14 | C10 Phase B — card asset generation (headshot upload, QR PNG, printable PDF, social 1080²/1080×1920) + **L** CardPreview headshot priority (lands here) |
| 15 | New Leads filter chip on /clients |
| 16 | Calendar reschedule (per-job + bulk "reschedule all day" with A2P notice) |
| 17 | Branded receipts (needs `card_payments` capability + re-KYC) |
| 18 | C11 i18n consolidation (inline EN/ES → `lib/i18n.js`) |
| 19 | Payment page shows contractor logo (trust signal) |
| 20 | Rate-limit atomicity / per-IP throttle (deeper spam hardening) |
| 23 | **YardSync Facebook page link on the digital card** — optional social link (facebook.com/YardSyncApp) on `/join/[slug]` + Settings→Card, alongside website, with a contact-visibility toggle; lucide `Facebook` icon, EN/ES. Low priority, own small PR — don't bundle. |
| 24 | **3-5 selectable business-card templates** — contractor picks a card design (layout/color/typography) in Settings→Card; applies to the live `/join/[slug]` card AND the downloadable social/print assets (`lib/cardTemplate.js`). `cardTemplate` field + picker. EN/ES-safe. Own PR. |

## Client data quality (Jay, 2026-07-05)

| # | Item |
|---|------|
| 30 | **Property type on lead form + client sheet + filter chip** — add a `propertyType` field (Residential · Commercial · HOA · Other) so the contractor gets a more tailored experience per client. Surface it on: the public lead/intake form (`app/join/[slug]/request`), the Clients Add/Accept modal + client info sheet (`app/clients/[id]`), and add a **filter chip row** entry on `/clients` (mirror the Active/Inactive + New Leads chips, with counts). Zero API cost — pure field + UI. EN/ES. Own small PR. |
| 31 | **Address autofill + "use my current location" on the lead form** — debounced address **autocomplete** that fills structured components (street/city/state/ZIP) so contractors/clients can't fat-finger the address; plus a **"Use my current location"** button (browser Geolocation → reverse geocode → fills the same fields). Populates through to the Clients page. Provider rec: **Radar** or **Mapbox** (both have generous free tiers that cover autocomplete + reverse geocode; effectively $0/mo at our volume — avoids Google Places' 2025 billing-account requirement). **Needs Jay to pick a provider + supply an API key.** Apply on the public intake form first (`app/join/[slug]/request`), then optionally the in-app Add-client address field. Own PR (has an external dependency + key). |

## Crew tier — follow-on (Jay, 2026-07-05)

| # | Item |
|---|------|
| 32 | **Landing page — incorporate the Crew tier.** Spruce up `app/(landing)/page.js` to sell crew: add crew members (Owner + Workers), workers see only their assigned jobs + address + Navigate (no money), per-seat pricing ($15/mo/active member on top of the base), the "hustler" story (own your business AND work others' crews). New section + pricing mention + EN/ES parity. Own PR. |
| 33 | **Admin/testing comp path for prod** — a clean way to give a dedicated prod TEST account an `active` subscription at **$0** so paid/crew features can be tested live without real charges. Options: (a) small admin action that comps via the existing `YARDSYNC_FREE` 100%-off coupon on a real Stripe sub (idiomatic; seat proration also comps to $0 if the coupon is whole-subscription, not price-restricted), or (b) an internal tooling script that sets `subscriptionStatus:'active'` + a real `stripeSubscriptionId` on a test account. Recurring pain point — testing paid features in prod currently has no free path. |

## Crew UX refinements (Jay, 2026-07-05)

| # | Item |
|---|------|
| 34 | **Explicit owner/"Me" chip in the Assign-to row** — multi-assign currently falls to "Unassigned (me)" when no member chips are selected (owner implicitly claims the job). Add an explicit **"Me"/owner chip** alongside the member chips so the owner can be selected the same way (and shown in the assignee set), instead of relying on the implicit fallback. Small UI change in `CalendarContent.js` (Add-job dialog + expanded card); decide owner+members co-assignment semantics. |

## Crew worker-card enrichment (Jay, 2026-07-05)

| # | Item |
|---|------|
| 35 | **Crew-facing per-job notes** — a notes field on a job that's visible to the assigned crew member (pets/animals on site, a callback phone number, gate/lock code, etc.). Extends the "what to bring / full job scope" idea ([[CREW_TIER_SPEC]] Phase 1e #3). Denormalize onto the schedule (no money/client-book access) so the worker sees it on their scoped card. |
| 36 | **Show co-assignees on the worker's job card** — with multi-assign live, a worker can't tell if they're solo, with a teammate, or with the owner (card only shows the business chip). Surface "who else is on this job" on the scoped worker card (e.g. "You + Owner" or teammate names) from the denormalized `assignedTeam`. Pairs with #35. |

## Cross-cutting UX (Jay, 2026-07-06)

| # | Item |
|---|------|
| 37 | **Multi-device responsive polish** — the app is currently phone-first (fixed `max-w-lg` shell). Make it feel intuitive + native on ALL screen types: desktop/laptop (use the wider viewport instead of a narrow centered column), tablets/iPad, large phones, and **foldables (Z Fold / open-fold aspect ratios)**. Audit AppShell width constraints, the calendar/dashboard/clients grids, modals, and the public `/join` card at `sm/md/lg/xl` breakpoints. A story/epic, not one PR — phase it (start with AppShell + the highest-traffic screens). Keep the PWA install/mobile ergonomics intact. |

## Crew data-hygiene (low)

| # | Item |
|---|------|
| 38 | **[LOW] Worker can read addon amounts on the schedule** — `schedule.addons` carries `amountCents`, and an assigned crew member reads the whole schedule doc (base price + client financials are NOT there, so the leak is limited to add-on line amounts, never shown in the worker UI). To fully honor "worker never sees money," store a worker-safe label-only `serviceItems: [label]` for crew-visible jobs and keep priced addons off the worker-readable doc (or compute addon amounts at invoice time). Pre-existing; crew are trusted, so low priority. |

## Billing workflow (Jay, 2026-07-06)

| # | Item |
|---|------|
| 39 | **Auto-invoice on job completion for post-visit clients** — when a contractor marks a job **complete** and the client's billing model is **post-visit** (invoice after the job, not paid upfront), automatically **trigger + send the invoice at that moment** (no separate manual send). Gate on the client's `billingMode`/pay-after flag; reuse the existing invoice-create + send path (respect the free-access card-required gate + `on_behalf_of` branding + 5.5% fee). Should also fire for a **crew member** completing the job (owner-owned invoice), so the money side still runs owner-only. Confirm no double-invoice if the job was already invoiced. |

## Crew account lifecycle

| # | Item |
|---|------|
| 40 | **In-app revert: business → crew-only** — the crew→business conversion is now gated behind explicit confirm (bug fixed), but there's still no in-app way to UNDO a conversion. Add a support/settings action (or admin path) to move a mistakenly-converted account back to crew-only + clean up orphaned Stripe Connect artifacts. Backend/data operation; not fully self-serve if a Stripe account exists. |

## Card templates — follow-on

| # | Item |
|---|------|
| 41 | **Apply the card template to the downloadable assets** — #24 shipped 3 distinct layouts (Classic/Photo/Minimal) for the LIVE `/join` card + settings preview + picker. The downloadable social/print assets (`lib/cardTemplate.js` / `CardAssets`) still render one layout; extend them to match the contractor's chosen `cardTemplate` so print/social match the live card. Canvas layout work. |

## Cowork-session findings (2026-07, VS-Claude review)

| # | Item |
|---|------|
| 25 | ✅ **FIXED** — First-paid activation never wrote `firstPaidInvoiceId` for non-free-access accounts → Verified badge never appeared (repro: fully Stripe-verified account "Frank" w/ 14 paid invoices, badge false until field added manually). Root cause: field only stamped in the `free_until_paid` activation block. Fix: decoupled marker in `payment_intent.succeeded` stamps it on the first paid invoice for ANY account. |
| 26 | ✅ **FIXED (primary path)** — Invoice "Text" send could hang the modal with no feedback when the Twilio call stalled (invoice doc IS created first, but a hung SMS fetch meant the modal never closed / `loadData` never ran, so the doc looked "not created"). Fix: 15s abort timeout on the SMS fetch in `app/clients/[id]/page.js`. **Follow-up:** same no-timeout `/api/twilio/send` pattern exists at 4 sites in `CalendarContent.js` + 1 in `SmsContent.js` — wrap them (shared `postWithTimeout` helper) for systemic hardening. |
| 27 | **[MED] Client hard-delete too easy to trigger** — "Remove this client" at the bottom of `app/clients/[id]/page.js` is a permanent delete behind a single "cannot be undone" confirm; a stray click nearly deleted a client. Fix: move behind an overflow menu + require typed-name confirmation, OR implement archive + undo (soft-delete). Repro: open any client → scroll to bottom → the delete is one confirm away. |
| 28 | **[LOW] Phantom/deleted packages leave clients on invalid packages** — clients assigned to a service that no longer exists (e.g., "Test", "ZTest Big Lot") show "— Keep current package —" in the edit form with NO signal the current package is broken. Fix: detect when `client.packageId`/serviceId no longer resolves to a Service and prompt to reassign. Repro: delete a Service that a client uses → edit that client → no warning. `app/clients/[id]/page.js` edit form. |
| 29 | **[LOW/UX] Dashboard "$0.00 this month" empty state** — brand-new users see a bold `$0.00` with no context (deflating). Add a friendly empty state, e.g. "Send your first invoice to see earnings here." `app/dashboard/DashboardContent.js`. |

## TIER 3 — Phase 3 (Community & Visibility)

| # | Item |
|---|------|
| 21 | Review/survey system → milestones → FB "Contractor of the Month" auto-posts |
| 22 | Verified reviews from paid invoices, contractor discovery, AI visibility engine |

## Deferred / conditional
- **Timezone per-contractor (H)** — non-issue for US given the 13:00 UTC cron (documented in cron + punch list); only needed for international or a cron-schedule change.
