# YardSync — Quotes · E-Sign · Deposits (F14 / P1)

> Status: SPEC (2026-06-28). Next big rock after recurring auto-billing shipped.
> Build on `dev` → CC test → promote `dev→main`, phase by phase.

## Goal

Let a contractor send a professional **quote**, have the client **e-sign to accept**, and optionally collect a **deposit upfront**. The signed quote + paid deposit double as **dispute evidence**, reinforcing the chargeback-protection workstream. An accepted quote **auto-converts the prospect into a client** and prompts the contractor to schedule the first visit; the deposit credits toward the final invoice.

## Locked decisions (Jay, 2026-06-28)

1. **Deposit amount — per-quote ($ or %).** Contractor enters a flat $ amount OR a % of the total on each quote (not a global default).
2. **Deposit gating — contractor chooses per quote.** A `require deposit to accept` toggle on each quote. No toggle / no deposit ⇒ e-sign alone accepts.
3. **E-signature — typed name + "I agree" + timestamp/IP.** UETA/ESIGN-valid lightweight e-sign. No drawn-signature canvas.
4. **On accept — auto-convert to client + offer schedule.** Accepted quote creates/links the client record and prompts the contractor to schedule the first visit. Deposit (if paid) credits toward the final invoice. (Not auto-scheduled — contractor confirms the schedule.)

## Reuses existing infrastructure

- **Direct charges** — a deposit is a PaymentIntent on the **connected account** with the 5.5% (capped) application fee, exactly like an invoice (`app/api/stripe/invoice/route.js` + `lib/fee.js`). Deposit account derived server-side from the quote's `gardenerUid` (never client-supplied), same as `lib/autoCharge.js`.
- **Public page pattern** — `/quote/[id]` mirrors `/join/[slug]` and `/pay/[id]` (server-rendered, no auth, bilingual).
- **Senders** — SMS via `lib/sms.js` (Messaging Service + STOP), email via `lib/email.js` `sendClientEmail`, client language drives EN/ES.
- **Contractor sync** — accept/decline/deposit-paid push via `lib/push.js` `sendPush`, like the auto-charge digests.
- **Fee pass-through** — `coverFees` gross-up consistent with invoices so the quote total is inclusive.

## Data model — `quotes/{quoteId}`

```
gardenerUid            string
clientId               string|null      // set when quoting an EXISTING client
prospect               { name, phone, email, address, language } | null  // for a NEW lead
title                  string
lineItems              [{ label, category, amountCents }]
subtotalCents          number           // sum of lineItems
coverFees              bool             // gross-up the displayed total (mirrors invoices)
totalCents             number           // what the client sees (grossed up if coverFees)
deposit                { type:'amount'|'percent', value:number, depositCents:number, required:bool } | null
validUntil             string(ISO date) // default +30 days
status                 'draft'|'sent'|'viewed'|'accepted'|'declined'|'expired'|'converted'|'void'
signature              { name, agreedAt(ISO), ip, userAgent } | null
depositPaid            bool
depositPaymentIntentId string|null
depositPaidAt          string|null
depositInvoiceId       string|null      // the deposit's invoice doc (invoiceType:'deposit')
channels               'sms'|'email'|'both'
language               'en'|'es'         // client-facing language for this quote
sentAt, viewedAt, acceptedAt, declinedAt, convertedAt   string|null
convertedClientId      string|null
createdAt, updatedAt   string(ISO)
```

Status flow: `draft → sent → viewed → accepted → converted` (with `declined` / `expired` / `void` as terminal off-ramps). A required-deposit quote signs to `accepted` but only **converts** once `depositPaid` lands (webhook).

## API routes

- `POST /api/quotes` — **authed** (verify caller uid == gardenerUid, like the invoice route). Create + send. Resolves `depositCents` from type/value; validates line items + total ≥ 50¢; default `validUntil` +30d. Sends SMS+email with `/quote/[id]`. Returns `{ quoteId, quoteUrl }`.
- `GET /api/quotes/[id]/public` — **public**. Sanitized quote + contractor brand (businessName, logoUrl). Records `viewedAt` + `status: viewed` on first view.
- `POST /api/quotes/[id]/accept` — **public**. Body `{ signatureName }`. Records `signature {name, agreedAt, ip(from headers), userAgent}`, `status: accepted`. If `deposit.required` (or deposit present), creates the deposit PI server-side on the connected account and returns `{ clientSecret, connectedAccountId, payUrl }`. Conversion fires here if **no required deposit**, else on `depositPaid`.
- `POST /api/quotes/[id]/decline` — **public**. Optional reason → `status: declined`.
- (Contractor management) `POST /api/quotes/[id]/void`, resend reuses `POST /api/quotes` semantics.

## Webhook additions (`app/api/stripe/webhook/route.js`)

- `payment_intent.succeeded` with `metadata.kind==='deposit'` → set quote `depositPaid/depositPaidAt`, write a deposit **invoice doc** (`invoiceType:'deposit'`, `quoteId`), and trigger **conversion** (`lib/quoteConvert.js`). Idempotent via `quote.depositPaid`. Deposit counts as real contractor revenue.

## Conversion (`lib/quoteConvert.js`)

- If `quote.clientId` set → link it. Else create a client from `prospect` (status active; recurrence/onetime per quote; `basePriceCents` from quote where sensible). Set `convertedClientId`, `status: converted`.
- **Credit the deposit:** store `depositCreditCents` so the eventual final invoice nets it out (final = total − deposit). Surface "Deposit paid −$X" in the invoice builder.
- Contractor push: "Quote accepted by {client} — ${total}" / "Deposit ${dep} paid". Set a **"schedule first visit"** prompt on the new client (leads-style CTA), per the locked "offer schedule" decision.

## Contractor UI

- New **`/quotes`** route: list with status badges (sent/viewed/accepted/declined/expired/converted), resend, void, "convert/schedule" CTA.
- **Quote builder** (modal or page): pick existing client OR enter a prospect; add line items (reuse the service/package + materials pickers); set deposit ($ or %) + `require deposit` toggle; `validUntil`; fee pass-through toggle; live preview; send (channels). Entry points: `/quotes` "New quote", client detail "Send quote", dashboard.

## Public quote page `/quote/[id]`

Server-rendered, no auth, bilingual (quote.language). Contractor brand header (logo + businessName), validity, line items, inclusive total, deposit terms. **Accept**: type name → check "I agree to {business}'s service terms and YardSync's Terms" → Accept (→ deposit pay if required). **Decline**: optional reason. Records viewed/accepted/declined. Mobile-first like `/pay`.

## Legal

E-sign is a binding acceptance — short terms reference on the quote page + full signature trail (name/timestamp/IP/UA). Add quote/deposit/e-sign disclosures to ToS + Privacy; mark `PENDING LEGAL REVIEW` and add to the counsel packet ([[project-legal-gaps-fee-dispute]]). Deposits are contractor revenue on the connected account (contractor = MoR); refundability follows the existing refund/dispute model.

## Phased build order

- **Phase 1 — Quote core:** data model, `POST /api/quotes`, builder UI (existing client or prospect, line items, validUntil, fee toggle — NO deposit yet), SMS+email send, `/quotes` list with statuses. Ships behind no flag; quotes are inert until a client page exists, so pair with at least a read-only `/quote/[id]`.
- **Phase 2 — Public page + e-sign:** `/quote/[id]` bilingual, viewedAt, typed-name accept, decline, status transitions, contractor accept/decline push. (No deposit.)
- **Phase 3 — Deposits:** deposit fields on the builder, deposit PI on accept (connected account, 5.5% capped fee), webhook `kind:'deposit'`, deposit invoice doc, required-deposit gating, deposit credited to final invoice.
- **Phase 4 — Conversion + schedule + lifecycle:** auto-create/link client on accept (or depositPaid), "schedule first visit" prompt, final-invoice deposit net-out, `expired` cron (past `validUntil`), void.

Each phase: build on `dev` → CC test → promote.
