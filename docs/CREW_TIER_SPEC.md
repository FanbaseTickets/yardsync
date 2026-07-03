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

## Open items for later decision
- Per-seat dollar amount (e.g., $10–15/mo) — set at Phase 2.
- Whether a future **Manager** role (can see money + invoice) is added — deferred; the 2-role model ships first.
- Worker's client-data exposure on an assigned job (name+address only vs more) — default to minimal.
