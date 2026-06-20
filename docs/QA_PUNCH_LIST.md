# YardSync QA Punch List — Lead → Schedule → Invoice flows

> Generated 2026-06-20 from three parallel subagent audits (persona-marco, persona-newbie-eager, defensive-guard sweep) of the rev 3 flows. De-duplicated, severity-ranked, cross-referenced against in-flight PRs #18/#19/#20. Items marked ✅verified were confirmed by direct code inspection; others are high-confidence agent findings to confirm while fixing.

## CRITICAL / HIGH

### A. Accept Lead creates a client with NO package → silent $65 invoice  ✅verified
All 3 audits' #1. `handleAcceptLead` ([clients/ClientsContent.js:232-248](../app/clients/ClientsContent.js#L232-L248)) writes only status fields — never `serviceId`, `packageType`, `basePriceCents`, `recurrence`. Downstream falls back to `client.basePriceCents || 6500` ([clients/[id]/page.js:422](../app/clients/[id]/page.js#L422)). Accepted leads silently become "$65 Lawn Care Service" clients; "Send invoice" bills the wrong amount. Manual Add-Client *forces* a package; Accept doesn't — the two creation paths diverged.
**Fix:** Route Accept through a package-assignment step (reuse the validated Add-Client modal, pre-filled from the lead). Fold `serviceInterest` + `note` into the client. Block Send-invoice/Schedule until a package exists.

### B. Re-accepting a lead resets trust-state counters  ✅verified
`handleAcceptLead` sets `completedJobsCount:0, billingModePrompted:false` unconditionally, with no `leadStatus === 'new'` guard and no in-flight disable. A double-tap / stale tab / back-button re-accept wipes a paid client's trust progress (re-arms the first-time-upfront banner). **Fix:** guard `if (lead.leadStatus !== 'new') return`; disable button while in-flight.

### C. Invoice API: no server-side validation + unauthenticated  ✅verified (route is unauth)
[api/stripe/invoice/route.js:48-99](../app/api/stripe/invoice/route.js#L48-L99) only checks `stripeAccountId` + truthy `totalCents`. No Firebase ID-token / ownership check (any caller who knows a connected-account ID can mint fee-bearing payment links); no `Number.isInteger(totalCents) && >= 50`; no reconciliation of `sum(lineItems) === totalCents`. **Fix:** verify ID token + uid owns the account; validate amount; reconcile totals.

### D. Invoice "Send" → duplicate charges (no in-flight/idempotency guard)
[clients/[id]/page.js:320-397](../app/clients/[id]/page.js#L320-L397); same in calendar `confirmSendInvoice` and `handleWalkInInvoice`. `invoicing` flips *after* the first await; a fast double-tap (or "Both" then "Text") fires two POSTs → two PaymentIntents → client charged twice. Duplicate-period warning is computed only on modal-open and is absent in the calendar/walk-in paths. **Fix:** synchronous in-flight ref + Stripe `Idempotency-Key`; centralize the duplicate-period check across all 3 send paths.

### E. Phone validation still length-only → gibberish passes
`normalizePhone` accepts any 10 digits (`0000000000`, `1234567890`). `validatePhone` ([lib/phone.js](../lib/phone.js)) accepts **≥10**, so 15-digit junk gets a green ✓ and `formatPhone` stores it raw. PR #19 added formatting but not stronger validation. **Fix:** strict 10-digit NANP check (reject all-same / 0-1 leading area+exchange); unify `validatePhone` with `normalizePhone`.

### F. Recurring double-booking guard misses future months
PR #20's guard uses `getSchedulesForDay`, scoped to the loaded (visible) month. Recurring occurrences in later months are booked unchecked. **Fix:** query the full date range of the generated series before booking (or check server-side at write).

### G. In-calendar "Add job" still defaults to today
PR #20 fixed only the `?client=` deep-link. The calendar's own **Add job** button uses `selectedDay` (inits to today), and there's **no date field inside the modal** — the date is locked to the title. **Fix:** add an editable date field to the Add-job and Walk-in modals.

### H. Timezone / date-key bug  ✅analyzed — non-issue for US given the cron schedule
All `serviceDate` keys derive from device-local `new Date()` / `toDateStr`; the cron compares bare `YYYY-MM-DD`. In theory near-midnight / cross-TZ scheduling could key a job under the wrong day vs the reminder cron. **Analysis (2026-06-20):** the SMS cron runs at **13:00 UTC** (`vercel.json`), and `formatDate` returns the UTC date. At 13:00 UTC the calendar date is identical across every US timezone (9 AM EDT … 3 AM HST), and schedules store `serviceDate` in the contractor's local date — so `UTC-date == local-date` and the cron matches correctly for any US-based contractor, including out-of-state. **The only real risk is silent:** moving the cron into the 00:00–08:00 UTC window would break it for western US zones. Documented as a guardrail comment in `app/api/cron/sms/route.js`. A per-contractor stored timezone is only needed for non-US contractors or a schedule change — defer to the multi-city / international stage.

### (partially fixed) Contractor lead notification fragility
Single fire-and-forget SMS, no email fallback, no in-app unread badge. **PR #19 already adds the bilingual email fallback + `getBaseUrl` host.** Remaining: in-app unread-leads badge on the Clients nav; surface a "your profile has no phone" setup warning.

## MEDIUM
- **I.** Optimistic SMS toasts claim "sent via text ✓" without confirming delivery (invoice path fire-and-forget). Use the existing `smsStatus` collection / await 2xx.
- **J.** Walk-in default price pre-filled `$65`; zero-amount base line items can appear on invoices. Blank placeholder; drop $0 lines.
- **K.** Edit-client can blank BOTH phone + email (no validation, unlike Add). Add the at-least-one-of guard to the edit save path.
- **L.** Settings CardPreview shows logo, but the real card prefers headshot → preview lies. Pass `headshotURL` to the preview.
- **M.** Walk-in phone stored display-formatted, not E.164 → Twilio send may fail silently. Normalize before persisting.
- **N.** No past-date guard when scheduling (recurring can start in the past). Warn when `selectedDay < today`.
- **O.** Firestore invoice-write failure returns **200 + payment URL** → live charge with no invoice record → webhook can't update, Volume math undercounts. Surface/retry.
- **P.** Rate-limit is non-atomic read-modify-write; weak name validation (1 char passes). Transactional increment + name min-length + per-IP.
- **Q.** Intake `serviceInterest` stored as free-text label, not service ID → can't auto-map to a package on Accept (blocks clean fix for A). Store the service ID.
- **R.** Settings card has two save buttons + no dirty-state warning; deep-link effect lacks a one-shot `useRef` guard (AuthContext re-render can reset in-progress selection).
- **S.** Variable add-on / custom-extra / walk-in price inputs accept `NaN`, negative, scientific-notation, and unbounded values. Clamp min/max; validate server-side (ties to C).

## LOW
- `getInitials` in clients views crashes on double-space names (intake version is correct — copy it).
- EN/ES "SMS OK" badge ternary returns the same string both languages.
- Honeypot-tripped / rate-limited submissions show the *success* screen to a real user.
- No-JS submit errors redirect to `?error=` but `join/[slug]/page.js` never reads/renders it → silent failure on JS-off phones.
- Maps link built for empty address after "skip address"; hide when blank.
- Card bio is a single monolingual field (weak spot for the bilingual differentiator).
- Duplicate-lead detection is phone-only (misses email-only repeats).
- `receipt_email` passed to Stripe unvalidated server-side.

## INFRA / ENVIRONMENT

### INFRA-1. Stable Preview webhook alias (test-mode Stripe webhooks go stale on every branch rotation)  ✅root-caused
The test-mode Stripe webhook destinations (`yardsync-preview`, `yardsync-preview-connect`) are pointed at a **branch-specific** Preview URL (`yardsync-git-chore-preview-env-…vercel.app`). Every test payment is processed by *that* deployment's code, writing into the shared `yardsync-dev` Firestore — so a fix on any *other* branch (e.g. `fix/qa-round-1`) is never executed by the webhook, even though its invoice still gets marked paid in the shared DB. This is what made QA round 1's T8 look like a code failure when the increment fix was actually correct but never run.
**Symptom signature:** an invoice flips to `paid` (webhook ran) but a same-handler side-effect (e.g. `completedJobsCount`) doesn't change → the webhook is hitting a *different* deployment than the branch under test.
**Permanent fix:** assign a **stable Vercel alias** (e.g. `dev.yardsyncapp.com`) to the active dev/integration branch and point both test-mode webhook destinations at it once. Then the test webhook target never goes stale on branch rotation. Until then, the manual workaround is to edit the two destinations' URLs to the current integration branch's deployment (same destination = same signing secret, so no Vercel env-var change needed).

## Suggested fix sequencing (batched PRs)
1. **Accept-lead correctness** (A, B, Q) — actively produces wrong invoices; highest user-facing priority.
2. **Invoice route hardening** (C, O, S-server, L4) — security + double-charge; one focused pass on the API route.
3. **Invoice send UX guards** (D, I) — in-flight ref + centralized duplicate check + honest toasts.
4. **Phone normalization unification** (E, M).
5. **Scheduling hardening** (F, G, H, N) — full-range conflict check, in-modal date field, past-date + TZ.
6. **Small wins** (J, K, L, edit-client validation, CardPreview headshot).
