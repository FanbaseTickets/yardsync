# PWA Push Notifications — Secondary Channel (additive to SMS/email)

> Status: SPEC. Authored 2026-06-27. Owner: Jay.
> **Design principle: push is ADDITIVE, never a replacement.** Every notification
> we send today by SMS/email keeps going out exactly as it does now. Push is an
> extra copy delivered to contractors who have the app installed AND turned
> notifications on. A contractor who hasn't installed the PWA (or doesn't enable
> push) is unaffected — they still get the SMS/email. No one loses a notification.

## Scope — which notifications get a push copy
Only **contractor-facing** notifications (the app user is the contractor). Client
appointment reminders stay SMS-only (clients aren't on the app — nothing to push to).

Push copies of:
- **New lead** — a prospect submitted the public intake form.
- **Payment received** — a client invoice was paid.
- **Daily job summary** — the morning cron summary.
- (later) volume-reward milestones, subscription payment failed (dunning).

Each of these already has an SMS/email path; we add a parallel best-effort push.

## How it works (graceful + non-blocking)
1. Contractor opens Settings → toggles **"Phone notifications"** on → browser asks
   permission → on grant, the client subscribes (VAPID public key) and POSTs the
   subscription to `/api/push/subscribe`, stored as `pushSubscriptions[]` on their
   `users` doc (array — they may have multiple devices).
2. When the server fires a contractor notification, after the existing SMS/email
   send it calls `sendPush(gardenerUid, { title, body, url })` (best-effort,
   wrapped in try/catch, never blocks or fails the main flow).
3. The service worker receives the `push` event and shows the notification;
   tapping it opens the relevant in-app URL (`/clients`, `/dashboard`, etc.).
4. Dead subscriptions (410/404 from the push service) are pruned from the doc.

If a contractor has no subscription → `sendPush` is a no-op → they just get the
SMS/email as before. **Zero behavior change for non-push users.**

## Platform notes
- **Android / Chrome / desktop:** web push works for installed PWA and in-browser.
- **iOS/iPadOS:** web push works only for a PWA **added to the home screen**
  (iOS 16.4+). So an iPhone contractor must "Add to Home Screen" first — which is
  exactly why push is secondary, not primary.

## Build steps
1. **Service worker** `public/sw.js` — handle `push` (showNotification) +
   `notificationclick` (focus/open URL). Register it client-side (a small
   `components/PushInit.js` mounted in the app shell). The SW also unlocks a future
   "new version available" update prompt.
2. **VAPID keys** — generate once (`web-push generate-vapid-keys`); add env vars
   `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` (server) + `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
   (client). Add `web-push` dependency.
3. **Subscribe flow** — Settings toggle (request permission + `pushManager.subscribe`)
   → `POST /api/push/subscribe` (auth'd) stores the subscription; a matching
   `/api/push/unsubscribe` removes it.
4. **`lib/push.js`** server helper — `sendPush(gardenerUid, payload)`: read
   `pushSubscriptions`, send via `web-push`, prune dead ones. Firestore via
   `firestoreRest` (no Admin SDK — constraint #1).
5. **Wire events** — add a best-effort `sendPush(...)` next to the existing SMS/email
   at: lead-notification, invoice-paid (webhook), daily-summary cron.
6. **Settings UI** — a "Phone notifications (push)" toggle in Settings → SMS or
   Billing tab, with an iOS "add to home screen first" hint, EN/ES.

## Out of scope (for now)
- Replacing any SMS/email (everything stays).
- Client-facing push (clients aren't app users).
- Rich notification actions / images (start with title+body+tap-to-open).
