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

## TIER 3 — Phase 3 (Community & Visibility)

| # | Item |
|---|------|
| 21 | Review/survey system → milestones → FB "Contractor of the Month" auto-posts |
| 22 | Verified reviews from paid invoices, contractor discovery, AI visibility engine |

## Deferred / conditional
- **Timezone per-contractor (H)** — non-issue for US given the 13:00 UTC cron (documented in cron + punch list); only needed for international or a cron-schedule change.
