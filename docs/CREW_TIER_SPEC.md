# YardSync — Crew Tier (F9)

> Status: SPEC (2026-06-30). The next big rock after Quotes (F14). The only feature that adds a NEW price point (per-seat revenue). Card reader / in-person pay (F4) becomes an enhancement ON TOP of this for both solo + crew.
> Build on `dev` → CC test → promote, phase by phase.

## Locked decisions (Jay, 2026-06-30)
1. **Pricing — per-seat add-on.** Keep the $39/mo (or $390/yr) base; each crew member is +$X/mo billed as a **Stripe subscription quantity** (new `STRIPE_PRICE_CREW_SEAT`). Owner seat is included in the base.
2. **Roles — 2 roles: Owner + Worker.** Worker = **jobs only, no money**: sees their assigned jobs, marks them complete, adds before/after photos. CANNOT see revenue/fees/payouts/invoices, edit the client book, send invoices/quotes, or touch settings.
3. **Money visibility — owner-only** by default (revenue, 5.5% fees, payouts, invoices hidden from Workers).

## Data model (forward-compat design already in ROADMAP.md — no destructive migration)

- **`businesses/{businessId}`** (NEW). **`businessId === ownerUid`** — the owner's uid IS the business id. This means every existing `gardenerUid`-keyed doc (clients/invoices/schedules/quotes) already belongs to the right business with zero migration. Fields: `ownerUid`, `name`, `slug`, `seatCount`, `createdAt`.
- **`memberships/{membershipId}`** (NEW, top-level for easy "which businesses am I in" queries). Fields: `businessUid` (= owner uid), `memberUid` (null until accepted), `role` ('owner' | 'worker'), `status` ('invited' | 'active' | 'removed'), `inviteEmail`/`invitePhone`, `inviteToken`, `invitedByUid`, `createdAt`, `acceptedAt`. The owner gets an implicit owner membership (or is derived from `businesses.ownerUid`).
- **`schedules/{id}`** gains **`assignedTo`** (memberUid) — the crew member responsible for that visit. Workers see schedules where `assignedTo == their uid`.
- **`users/{uid}`**: unchanged for owners. A worker's user doc is a normal account; their ACCESS is derived from their active `memberships`, not a field on the user.

## Roles / RBAC (the crux + the risk)

**Owner** — the current full experience (unchanged).
**Worker** — a SCOPED app: only the calendar of their assigned jobs (mark complete + photos). No `/clients` book, no `/quotes`, no money anywhere, no `/settings`, no invoicing. For an assigned job they see just what's needed to do it (client name + address + service), never price/fees.

Enforcement is **two layers**:
1. **Firestore security rules** (authoritative). Today the rules allow any authed user broad read/write on clients/schedules/invoices. Crew requires **role-aware rules**: a worker may read only the business's schedules assigned to them (+ the minimal client fields for those), and NOTHING in invoices. **⚠️ This is a significant rules redesign — needs Jay's explicit permission and careful staged testing so existing owners are never locked out.** This is also the "admin/client separation + client-lifecycle unification" foundation we flagged — do it here, once, correctly.
2. **AppShell / UI gating** (UX). Resolve the logged-in user's role for their business on load; render the Worker view (scoped nav: Calendar only) vs the Owner view. Defense-in-depth on top of the rules.

## Invite + identity
- Owner invites by **phone or email** from a new Settings → Team screen → creates a `memberships` doc (`status:'invited'`, `inviteToken`) + sends an invite SMS/email (A2P-compliant) with an accept link.
- Invitee signs up / logs in → accept route validates the token → membership `status:'active'`, `memberUid` set, `role:'worker'`. Their next load renders the scoped Worker view.
- Owner can assign a Worker to visits (`schedules.assignedTo`) and remove a member (membership `removed` + decrement the seat quantity).

## Seat billing
- A new **`STRIPE_PRICE_CREW_SEAT`** (recurring, per-unit). The owner's existing subscription gets a **second subscription item** with `quantity = active worker count`. Adding/removing a worker updates the quantity (proration on). Owner seat = the base $39 item (unchanged).
- Guardrails: respect the Early Adopter 5.5% lock (seat pricing is additive, doesn't touch the fee). Free-access owners: seats bill once their base subscription activates.
- Legal: seat pricing → terms-reviewer pass (new charge in §4).

## Phased build order
- **Phase 1 — Foundation + Worker view (no billing).** `businesses` + `memberships` model; role resolution in AuthContext/AppShell; **role-aware Firestore rules** (the critical path — permission + staged test); Settings → Team (invite/accept/assign/remove); scoped Worker calendar (assigned jobs + mark complete). Seats free during this phase.
- **Phase 2 — Seat billing.** `STRIPE_PRICE_CREW_SEAT` + subscription-quantity sync on add/remove; Team screen shows the per-seat cost + running total; terms-reviewer §4 update.
- **Phase 3 — Team profiles.** Owner + crew photo hierarchy on the `/join` card (owner headshot → crew grid); crew headshot upload (reuse LogoUpload pattern).
- **Phase 4 — Enhancement: in-person pay / card reader (F4).** Tap-to-pay usable by owner + assigned workers on a job (Terminal or Stripe Tap to Pay). Rides on the role model from Phase 1.

Each phase: build on `dev` → CC test → promote. Phase 1's rules redesign is the highest-risk step — spec the exact rule matrix + test it against existing owner accounts BEFORE deploying.

## Multi-membership: a person can own a business AND be a worker in N crews (the "hustler")

The `user ↔ business` relationship is **many-to-many** (this is why memberships is a top-level collection, not a subcollection). One `uid` can simultaneously be:
- **Owner** of their own business (`businesses/{uid}`) — full owner experience.
- **Worker** in one or more OTHER businesses (`memberships/{bizUid}_{uid}`, role: worker).

Nothing special is needed — it's just multiple membership rows. Queries:
- **"My crews" list** = `memberships where memberUid == me && status == 'active'` (+ their own business as owner). Show on a Settings → Team / dashboard widget.
- **Unified color-coded calendar** — the calendar merges TWO read sources and color-codes each business:
  1. Own business: `schedules where gardenerUid == myUid` (owner — all jobs).
  2. Each crew I work in: `schedules where gardenerUid == crewOwnerUid && assignedTo == myUid` (worker — only my assigned jobs).
  Assign a stable color per `gardenerUid`/business. The role-aware rules already permit exactly these reads (owner reads own; `isActiveWorker` reads assigned-in-others), so this is purely a client-side aggregate + color map. **This is a real differentiator — a worker sees their whole cross-crew day in one place.**

**App context model:** owner functions (Clients, Invoices, Quotes, Settings, Team) always act on the user's OWN business only. For crews they're merely a Worker in, they get ONLY the assigned jobs on the unified calendar (no owner functions for those businesses). No heavy "business switcher" needed for v1 — one unified calendar + owner-tools-scoped-to-own-business.

## Signup / onboarding + adding a member (owner vs worker BRANCH)

Owner and worker onboarding must diverge:
- **Owner signup (unchanged):** business profile → Stripe Connect (get paid) → card-on-file (free-access). Owner of their own business, solo by default.
- **Adding a member:** owner → **Settings → Team → Invite** (phone or email) → creates a `memberships` doc (`status:'invited'`, `inviteToken`) + sends an A2P-compliant invite SMS/email with an accept link.
- **Worker accepting:**
  - *No account yet* → **lightweight signup** (name + photo + login only — **SKIP Connect / payments / card-on-file entirely**, workers never handle money). On completion the invite token is consumed → membership `active`, role `worker`.
  - *Already has an account* (the hustler — owns their own business or works elsewhere) → **log in + accept** → membership added → their unified calendar now shows the crew's assigned jobs.
- **Assignment:** owner sets `schedules.assignedTo = memberUid` when scheduling; owner can reassign or remove a member (membership `removed` + seat-quantity decrement).

## Phase 1 — Role-aware Firestore rules matrix (REVIEW ARTIFACT — not deployed)

### ⚠️ This also fixes a latent multi-tenant leak
The CURRENT rules for `clients`, `schedules`, `services`, `invoices`, `feePayments` are `allow read, write: if isAdmin() || request.auth != null` — i.e. **ANY logged-in contractor can read/write ANY other contractor's client book, schedules, and invoices** from the client SDK. The app never does this (every query is scoped to the caller's uid), but the *rules* don't enforce it. The role-aware redesign closes this hole by scoping every business collection to the owner (and workers to only their assigned jobs). This is a real security fix independent of Crew.

### Helpers
```
function signedIn() { return request.auth != null; }
function isOwner(bizUid) { return signedIn() && request.auth.uid == bizUid; }   // businessId === ownerUid
function memberPath(bizUid) { return /databases/$(database)/documents/memberships/$(bizUid + '_' + request.auth.uid); }
function isActiveWorker(bizUid) {
  return signedIn() && exists(memberPath(bizUid))
    && get(memberPath(bizUid)).data.status == 'active'
    && get(memberPath(bizUid)).data.role == 'worker';
}
```
`isOwner` short-circuits (no `get()`), so owner reads pay zero extra cost; the membership `get()` only fires for a non-owner touching a schedule.

### Matrix (business data — `gardenerUid` on a doc == the owner/business uid)
| Collection | Owner | Worker | Admin (server) |
|---|---|---|---|
| `clients` | read+write own | **none** (job info is denormalized on schedules) | all |
| `schedules` | read+write own | **read + update ONLY** those with `assignedTo == uid`; update limited to `status/completedAt/photos/updatedAt` (can't reassign or change gardenerUid); no create/delete | all |
| `services` (has prices) | read+write own | **none** | all |
| `invoices` (money) | read+write own | **none** | all |
| `feePayments` (money) | read+write own | **none** | all |
| `businesses/{bizUid}` | read+write own | read the business they belong to | all |
| `memberships/{bizUid}_{memberUid}` | read own-biz memberships | read only their OWN membership | **write = admin/server only** (invites + accepts go through a firestoreRest route so a worker can't self-grant a role) |
| `users`, `subscriptions` | self only (unchanged) | self only | all |
| `quotes`, `slugs`, `settings`, etc. | (unchanged — admin/server-only) | — | all |

### Denormalization requirement
So workers never read the `clients` collection (which holds `basePriceCents` = money), each `schedules` doc must carry the non-money job fields it needs: `clientName`, `serviceAddress`, `serviceLabel` (NO price). Phase 1 backfills/writes these on schedule create.

### Safety / rollout plan (this is the risk)
1. Implement the model + rules on `dev`. 2. **Deploy rules to `yardsync-dev` ONLY**, then run the full OWNER regression via CC (create/edit client, schedule, send invoice, quote, settings, calendar, dashboard) — confirm nothing an owner does is blocked by the tighter rules. 3. Add a Worker test account + verify scoping (sees only assigned jobs, blocked from clients/invoices/money). 4. Only after dev passes → deploy rules to prod (needs Jay's go). **Requires Jay's explicit permission for each rules deploy.**

## Phase 1c — Crew notifications + calendar member-colors (Jay, during the 1b test)

Enhance 1b's core (do after 1b promotes; they don't change the security model):

1. **Morning digest push — "You have X jobs today. Tap to review."** A daily cron (new; mirrors the auto-charge cron pattern + 13:00–14:00 UTC date invariant) sends every user WITH jobs today a morning push → deep-links to the calendar. Applies to **owners AND crew members** (a member's "today" = schedules assigned to them across all crews). Skip 0-job users. Uses `lib/push.js sendPush`.
2. **New-job-assigned push to the crew member.** When an owner assigns a job (`schedules.assignedTo` → a member), the member gets a push: "New job {today/tomorrow/date} — {serviceLabel}." **Impl note:** assign is currently a client-side `updateSchedule`; to push server-side, move it behind a small `POST /api/crew/assign` (authed owner → set assignedTo + `sendPush(memberUid, …)`). Fire only on a real change (empty/other → this member).
3. **Owner calendar: color own vs. team jobs.** Extend the color map so a job the owner ASSIGNED to a member renders in **that member's color** (own/unassigned = green); legend gains the members. Owner sees who's doing what at a glance.
4. **Per-member colors + expandable team actions.** In Settings → Team, clicking a member's name **expands** a panel (mirrors the client "add job" expand) with a **color picker** (sets `memberColor` on the membership, used by #3) + actions (assign, view their jobs, remove). Owner chooses colors per member.
5. **Actionable-notification "field flow" (Jay, during the 1b test).** Turn the worker's day into a notification-driven loop so they barely touch the app:
   - **Quick win first (in-app, ships now, no push infra):** make the ADDRESS row on the worker job card **tappable → opens the device maps app** (`geo:`/`https://maps.google.com/?q={encoded address}` — the universal link lets the OS pick Google/Apple Maps). Zero new deps; a one-line enhancement to the scoped card in `CalendarContent.js`. This alone delivers the "click the tab and go straight to the address" ask.
   - **Push flow (needs Phase 1c push infra + action buttons):** the morning/next-job push is an **expandable notification with two actions** — **"Mark complete"** (swipe/expand → completes the job via a server route, no app open) and **"Navigate"** (one tap → deep-links straight to maps with the address prefilled). On complete, the **next assigned job auto-surfaces as its own notification**, so the worker walks the whole route from the lock screen. Requires: notification action buttons (Web Push `actions` / native), a lightweight authed **`POST /api/crew/complete`** (worker marks their own assigned job — rules already allow the worker to write `status/completedAt/completedBy`), and next-job resolution (their next `assignedTo` job by serviceDate). Sequenced AFTER the basic morning-digest push (1c #1) lands.

## Phase 1e — Crew member cards + richer job scope (Jay, during the scoped-onboarding test, 2026-07-04)

Product gaps found once the scoped worker experience was verified end-to-end (all not bugs — the scoping is correct; these are the next layer):

1. **Crew member business card.** Scoped Settings is Profile + Team only (no Card tab), so a team member can't generate their own card yet. Give crew members a card. Ties to #2 + #5 below (their card is an owner-lead funnel, not a standalone business).
2. **Owner's business logo on the crew card — display-only, pre-populated.** The editable *Business logo* tile is correctly removed from a scoped member's Settings; but their card/identity should still *show* the owner's business logo (pulled from the owning business), read-only. Their **headshot uploader stays** so they add their own photo. So: card = owner's business logo (fixed) + member's own headshot.
3. **Full job scope on the worker card.** Today the crew job card shows service label + address only. It should list **all services/items to perform** for that visit so the worker knows what to bring/prepare. (Denormalize the job's service line-items onto the schedule alongside `serviceLabel`/`serviceAddress` — still no money, just the work.) Reopens the "worker's client-data exposure" open item below — expand from name+address to the task list.
4. **Assign at creation.** Add an **"Assign to" field in the Add job dialog** (in addition to the existing assign-after-creation on the expanded card). Small, quick follow-up.
5. **Crew card QR → owner's lead/intake form.** A crew member's business-card QR must route back to the **owner's** lead/intake form (`/join/[owner-slug]/request` or equivalent) so the **owner captures the lead and assigns it out** — the member is a funnel, not a separate merchant. Confirm the wiring routes to the owner, never the member.

> Grouping: #1 + #2 + #5 are one coherent "team member card that funnels leads to the owner" feature. #3 + #4 are worker-calendar UX. #4 is the cheapest — do it first / alongside Phase 1c.

## Phase 1d / Later
- **Assign clients to specific team members** (client "ownership" by a member) for a more personable feel — the member always services "their" clients. Bigger (client↔member relationship + scheduling defaults). Backlog.

## Open items for later decision
- Per-seat dollar amount (e.g., $10–15/mo) — set at Phase 2.
- Whether a future **Manager** role (can see money + invoice) is added — deferred; the 2-role model ships first.
- Worker's client-data exposure on an assigned job (name+address only vs more) — default to minimal.
