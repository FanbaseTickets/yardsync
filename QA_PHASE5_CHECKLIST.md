# YardSync Phase 5 — QA Checklist

Generated 2026-04-08. Run on staging with **test Stripe keys** before flipping to live.

## 1. Calendar — Collapsible job cards
- [ ] Tap a job card → expands; tap again → collapses
- [ ] Chevron rotates 180° on expand
- [ ] Only one card open at a time is **not** required, but verify no UI glitching when multiple toggle quickly
- [ ] Completed jobs show only the Delete button when expanded
- [ ] Walk-in badge shows on walk-in jobs; recurring badge shows on recurring jobs
- [ ] Materials chip ($amount) renders when materials attached
- [ ] Add-ons chip (+N add-ons) renders when extras attached

## 2. Calendar — Filter chips
- [ ] **All** shows every job for the day with correct count
- [ ] **Pending** shows only `status !== 'completed'` with correct count
- [ ] **Completed** shows only completed jobs with correct count
- [ ] Counts update live after marking a job complete or deleting one
- [ ] Active chip is brand-green; inactive chips are white with gray border
- [ ] Chips scroll horizontally on narrow screens without breaking layout

## 3. Calendar — Set route (drag-and-drop)
- [ ] Set route chip activates route mode; helper text appears
- [ ] Each card shows a grip handle on the left with position number (1, 2, 3…)
- [ ] **Mouse drag** (desktop): grab handle, drag over another card, cards reflow live, dragged card shows brand-ring + 60% opacity
- [ ] **Touch drag** (mobile): same behavior with finger
- [ ] On release, new order persists — refresh page, order is preserved
- [ ] Switching out of route mode and back keeps the saved order
- [ ] Adding a new job after reordering inserts at the bottom (or wherever its time slot dictates outside route mode)
- [ ] Completed jobs are draggable too (not blocked)

## 4. Add Extra Service flow
- [ ] On a recurring job, expand → Add extra service → modal opens
- [ ] Saved services list shows all add-on services with correct prices
- [ ] Tap a saved service → appended to schedule's `addons`, modal closes, +N add-ons chip updates
- [ ] Variable-priced services append correctly (price = current variable input)
- [ ] Custom one-off: enter label + price → Add custom → appears as a line on the next invoice
- [ ] Add custom button is disabled when label or price is empty
- [ ] Modal can be cancelled without saving anything

## 5. Send Invoice — Walk-in
- [ ] Walk-in job with base $X + extras + materials → Send invoice opens preview modal
- [ ] Preview shows: base line, each extra, each material (amber rows), Client pays total, 5.5% Stripe fee, You receive total
- [ ] Math is correct: client pays = sum of all lines; fee = round(total × 0.055); you receive = total − fee
- [ ] Cancel closes modal without sending
- [ ] Send now → loading state on button → success toast → modal closes → card collapses → schedule updates
- [ ] Stripe dashboard shows PaymentIntent with correct `application_fee_amount` and destination
- [ ] Test phone receives SMS with payment link
- [ ] Test email receives invoice (if email present, no phone)
- [ ] Walk-in with $0 total (no base, no extras, no materials) errors out instead of sending

## 6. Send Invoice — Recurring (CRITICAL — prepaid double-charge prevention)
- [ ] Recurring client with monthly plan, no extras, no materials → Send invoice errors with "No extras or materials to bill — base is already covered by the plan"
- [ ] Recurring client with extras only → preview shows ONLY extras (no base line) + brand-tinted note "Base service is already covered by the recurring plan"
- [ ] Recurring client with materials only → preview shows ONLY materials + brand note
- [ ] Recurring client with extras + materials → preview shows both, no base
- [ ] **Annual prepaid client (the $1000/yr scenario):** add a $125 pressure-wash extra → invoice charges exactly $125, never the annual base
- [ ] Stripe charge amount === preview "Client pays" amount (verify in Stripe dashboard)

## 7. Materials flow
- [ ] Add Material from expanded card → modal opens with existing materials
- [ ] Add row, set qty + unit cost → subtotal updates live
- [ ] Save → materials chip on card updates with new total
- [ ] Materials carry into both walk-in and recurring Send Invoice flows correctly
- [ ] Delete a material row → subtotal recalculates

## 8. Mark Complete
- [ ] Mark complete on a pending job → status flips, card shows strike-through and brand dot
- [ ] Completed jobs hide all action buttons except Delete
- [ ] Pending count drops, Completed count rises in filter chips

## 9. Delete
- [ ] Delete from expanded card → confirmation prompt
- [ ] Confirm → schedule removed, calendar dot count updates
- [ ] Recurring schedules: verify only the single instance is deleted (or whatever the intended behavior is — confirm with PM)

## 10. Landing page
- [ ] All 6 feature rows render with v4 screenshots (no notch crowding, no crop distortion)
- [ ] Hero section shows three phones cleanly
- [ ] INVOICING row mentions 5.5% transparent fee and shows invoice summary screenshot
- [ ] Spanish toggle swaps all copy; bilingual subtitles render under each feature
- [ ] CTAs route to signup correctly

## 11. Bilingual (EN/ES)
- [ ] Switch lang to ES on calendar → all chips, buttons, modals, helper text translate
- [ ] Filter chip labels: Todos / Pendientes / Completados / Ruta
- [ ] Add extra service modal in ES
- [ ] Confirm invoice modal in ES (including the prepaid base note)

## 12. Mobile / PWA
- [ ] Install as PWA on iOS Safari and Android Chrome
- [ ] Calendar drag-and-drop works with finger
- [ ] Modals fit viewport, no horizontal scroll
- [ ] Bottom nav doesn't cover modal Send button
- [ ] Status bar / safe area respected on iPhone notch devices

## 13. Pre-flip production checklist
- [ ] **Audit `users` collection for stale `setupFeePaid: true` flags** (pre-fix bug, commit fe64910). Open Firestore console → users collection → filter `setupFeePaid == true` → manually clear the flag for any account that did NOT actually purchase the $99 Pro Setup add-on. Cross-reference against your real Pro Setup customer list. Do this BEFORE the live keys flip so no false-positive contractors show up in the new pending widget on day one.
- [ ] **End-to-end Pro Setup purchase test (Stripe test mode):**
  - [ ] Run a fresh test signup with the $99 Pro Setup add-on selected
  - [ ] Confirm Twilio SMS lands at `ADMIN_PHONE_NUMBER` with name + email + UID
  - [ ] Confirm SendGrid email lands at `ADMIN_EMAIL` with the styled HTML template and "Open admin dashboard" CTA
  - [ ] Confirm the new amber widget appears at the top of `/admin/dashboard` with the test purchase listed
  - [ ] Tap "Mark contacted →" → confirm the modal opens, completes, and the entry disappears from the widget
  - [ ] Confirm a normal subscription checkout (no Pro Setup add-on) does NOT trigger any of the above — verifies the bug fix
- [ ] **Email invoice delivery smoke test (Bug 1, commit 79c7472):**
  - [ ] Use a Connect-complete contractor account (e.g. Marco's)
  - [ ] Find or create a client with email but no phone (legacy email-only scenario)
  - [ ] Send an invoice → confirm SendGrid email lands with branded template + pay link
  - [ ] Verify Vercel logs show `Client email sent via SendGrid to ...`
  - [ ] Also test: client with phone only → confirm SMS still sends, no email attempted
  - [ ] Also test: client with both phone + email → confirm both SMS and email fire
- [ ] Swap `STRIPE_SECRET_KEY` to live key in Vercel env
- [ ] Swap `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` to live key
- [ ] Create live Stripe webhook → copy signing secret → update `STRIPE_WEBHOOK_SECRET`
- [ ] Create live Stripe coupons (match test coupon IDs)
- [ ] Verify Twilio A2P registration approved
- [ ] Verify Firebase Auth is in production mode (not test)
- [ ] Run one real signup with a real card → cancel immediately
- [ ] Confirm invoice email + SMS deliver in production
- [ ] Sentry / error monitoring receiving events
- [ ] Set up uptime monitor on yardsyncapp.com

## 14. Things you may have missed (worth a glance)
- [ ] **`/invoices` index page** — still a "coming soon" toast per roadmap. Decide: ship as-is or hide the link
- [ ] **Server-side duplicate invoice enforcement** — client-side check is racy per known risks. Consider a Firestore transaction guard before launch
- [ ] **Reactivation path** — fully-deleted sub → new sub flow is "lightly tested." Run one full cancel → reactivate cycle
- [ ] **Square dead code** — confirm no Square imports run at boot (bundle bloat)
- [ ] **Webhook route doing too much** — subs + Connect + admin SMS in one handler; verify it doesn't time out under load
- [ ] **Expired card on reactivation** — what happens if the saved card is expired when they come back? Test it
- [ ] **Empty states** — new user with zero clients/schedules/services: every page should render gracefully
- [ ] **Stripe Connect Express onboarding** — run it end-to-end with a fresh test account
- [ ] **Deep links** — `/clients/[id]?openInvoice=true` still works (calendar used to route there for recurring; verify nothing else relies on it)
- [ ] **Toast spam** — rapid Send Invoice taps shouldn't fire multiple times (loading state should block re-entry — verify)

## Sign-off
- [ ] All P0 sections (5, 6) green
- [ ] No console errors on any flow
- [ ] No 4xx/5xx in network tab on success paths
- [ ] Tester name + date: ________________
