# Feedback Room — Round 1 (Raw Persona Responses)

> Date: 2026-06-24 · Product state: live, pre-first-paying-customer · Panel: 13 personas (independent, did not see each other's answers).
> Format per persona: Verdict · Pay? · Fee reaction · Top-3 must-haves (F#) · Top friction · Churn trigger · Quote.

---

## CORE / LOW-END SEGMENT (cheap to acquire)

### Marco — lawn care, ES, solo, $60 ticket
- **Verdict/Pay:** Conditional. Signs up only after he *sees* an automated reminder fire and an invoice get paid without him calling twice.
- **Fee:** "5.5% sounds small until you do the math." $1,500/mo = $82.50 + $39 sub = ~$120/mo "just to have a nicer notebook." Accepts it *only if* invoices get paid in 2 days vs 1–2 weeks. Bothered the fee is "forever."
- **Top 3:** F1 (the reason to sign up — gets back 20 min × 52 wks), F20 (8 every-week clients he chases), F2 (QR on the truck = free leads).
- **Friction:** Stripe Connect handoff — small English text, asks for routing #/SSN/EIN he doesn't have ready. "That handoff is where I lose trust."
- **Churn:** A client double-charged/wrong amount/confusing message → cancels same day. App down Monday morning with no one to call → done.
- **Quote:** "Por fin algo que habla como yo trabajo — en la calle, desde el teléfono."

### Eager newbie — lawn care, EN, brand new, low volume
- **Verdict/Pay:** Conditional adopt; needs a 14-day trial / first invoice before card. $39 is the bigger ask than the fee at his scale.
- **Fee:** Fine. $2.48 on a $45 cut, ~$15/mo total. "The $39 sub is the bigger ask than the fee at my scale."
- **Top 3:** F2 (QR cards at apartments/Home Depot), F11 (before/after = "kid with a mower" → professional), F17 (referral — "I become a sales rep for free").
- **Friction:** Stripe Connect — needs explicit "personal checking works, no EIN needed" or he stalls and never sends an invoice.
- **Churn:** Inactivity. 3 weeks without a paid invoice and no nudges/milestones → cancels when the charge hits.
- **Quote:** "First time a client texted me 'wow that's professional' — that was a YardSync invoice."

### Joaquín — pest control, ES only, 58, anti-tech
- **Verdict/Pay:** Conditional, does NOT adopt alone. Pro Setup ($99, done *with* him in Spanish) is the only thing keeping him in the room. $39 treated "like cable — pay if it works by itself."
- **Fee:** "The bank robbing me again." $5.50 × 20 jobs = a tank of gas. Acceptable *only* if a human explains the card-link tradeoff in Spanish, face to face.
- **Top 3:** F1 (Spanish reminders rebook his quarterly clients), F20 (quarterly auto-charge), F2 (nephew scans QR; new client self-fills in Spanish).
- **Friction:** Stripe Connect "connect a bank account" stops him cold — depends entirely on his daughter's availability.
- **Churn:** One failure + English-only/chatbot support → cancels that day. "This isn't for me" confirmed.
- **Quote:** "Si alguien me lo explica en español y no tengo que tocarlo mucho, puede que lo deje quedarse."

### Tyrell — pressure washing, EN, solo, social-native, $150–700
- **Verdict/Pay:** Conditional. The `/join/[slug]` skeleton is right but "has no fangs." Pays when F11 + F12 ship.
- **Fee:** Stings on small jobs ($8.25 on a $150 driveway), fine above $300 ticket. Would Zelle small repeat jobs to dodge 5.5%. Likes Early Adopter lock.
- **Top 3:** F11 (before/after = his whole brand, would pay more), F12 (verified reviews = +40% close rate), F5 (one-tap Apple Pay for phone-native clients).
- **Friction:** No deposit on the intake card → drives 40 min and they ghost. Card is lead-collection, not booking.
- **Churn:** Generic/"sketchy"-looking `/join` page = brand damage, out in 30 days. Reviews that aren't shareable to IG/Google/Nextdoor = decorative → churn.
- **Quote:** "The link that turned my TikTok followers into booked jobs — I should've had this in year one."

### Linda — window washing, EN, semi-retired, ~8 clients, $18k/yr  ← PRICING FLOOR
- **Verdict/Pay:** Conditional, leaning walk-away. Condition: annual $199 or a sub-$15/mo starter tier. At $39/mo month-to-month she'd try 2 months and quietly cancel.
- **Fee:** The part that stings most. ~$960/mo volume → $52.80 fee + $39 sub = ~$92/mo (~$1,100/yr) on $18k gross = >6%. Would route check-payers off-platform, run only card clients through (explicit fee-flight).
- **Top 3:** F1 (only feature that pays for itself at her size), F5 (tap-to-pay converts her older check-writers), F20 (3 fully-regular clients).
- **Friction:** Stripe Connect banking/SSN gauntlet on day one — "a meaningful number of people like me close the tab and never come back."
- **Churn:** Does the math at month 2; if she can't point to a faster-paying client or 2 saved jobs → cancels quietly, no review.
- **Quote:** "I'm not your big customer — but there are a lot of me, and if you price me out, you lose the word-of-mouth that gets you the big ones."

---

## HIGH-GMV / ESTABLISHED SEGMENT (the profit + the fee-flight risk)

### Dave — lawn/landscape, EN, 4 trucks/6 emp, ~$33k/mo  ← established switcher
- **Verdict/Pay:** Conditional, leaning walk-away. Won't bet $320k revenue on a pre-first-customer solo-founder tool. Needs QuickBooks sync, crew tier, and ≥10 real reviews.
- **Fee:** First number he ran. ~$33k/mo → $1,815/mo in fees forever vs Jobber $198 flat + Stripe 2.9% (~$960 all-in today). "A high-volume operator isn't your prize — we're your margin, and we know it." Wants negotiated/capped rate at $10k/mo GMV.
- **Top 3:** F6 (hard gate — bookkeeper on QBO), F9 (6 employees, 3 Spanish-only — where bilingual finally pays), F14 (signed estimates before crew on property).
- **Friction:** Migration wall — Pro Setup imports the list but not 12 yrs of job history/recurring/saved cards/quotes. 40-hr rebuild + retraining 6 staff. No portal (F10) → front-office friction *up* on day one.
- **Churn:** Any retroactive pricing change or removed Early Adopter lock. Wants a lawyer on Terms §6. No support SLA during billing week = gone.
- **Quote:** "I need to see the books on who's actually using this before I move my operation."

### Brittany — cleaning/organizing, EN, 5 emp, ~$26k/mo  ← feature maximalist
- **Verdict/Pay:** Conditional, leaning no. Conditions (in order): native QBO 2-way sync ≤90 days, e-sign+deposit quotes, client portal. Parallel 30-day trial; if any is still "coming soon" at day 30 she stays on Housecall Pro.
- **Fee:** ~$26k/mo → $1,430/mo fees + $39 = $1,469/mo vs Housecall Pro $229 + QBO/Stripe ~$770 = ~$999. YardSync is **$470/mo more**. Fee-flight real: use scheduling/SMS, collect outside, pay $39. Wants cap (3% >$10k or $500 ceiling).
- **Top 3:** F6 (disqualifying gap — must be native 2-way, not CSV), F14 (50% of revenue is quoted organizing projects w/ deposit), F10 (saves admin 4–6 hrs/wk = $400–600/mo hidden labor). Write-in: per-service/per-cleaner reporting.
- **Friction:** The moment she learns there's no QB sync — closes the tab. Switching only makes sense if it *removes* busywork; today it adds it.
- **Churn:** F6 ships as a CSV export instead of live API → cancels the day she sees it.
- **Quote:** "The DNA is right and the Spanish is real — now build the accounting layer and I'll pay double."

### Jenny — pool service, EN, 70 recurring accts, ~$9,800/mo  ← FEE-FLIGHT (high-freq)
- **Verdict/Pay:** Conditional; condition is F20 true recurring auto-billing. Without it: walk away. "I'm not hand-sending 70 invoices a month."
- **Fee:** $9,800/mo → $540/mo fee = ~$6,948/yr vs Skimmer flat SaaS, no per-txn cut. Volume-reward free sub saves $468 but "the 5.5% does not go away — that's not a discount, that's a rebrand." **At her volume she'd route recurring billing outside YardSync** (Stripe Billing direct / keep Skimmer for billing). Only stays with a per-account cap / GMV-threshold flat rate / recurring-exempt tier.
- **Top 3:** F20 (the gate), F8 (15 stops/day = 45–60 min daylight), F5 (iPhone homeowners, same-day pay).
- **Friction:** Goes to set up a recurring plan, the flow doesn't exist → closes browser, back to Skimmer.
- **Churn:** Manual 70-invoice cycle or a double-charge → gone in 30 days and tells the SA pool-service Facebook group.
- **Quote:** "The smartest lawn-care app I've ever seen — now make it work for people who don't mow lawns."

### Diego — landscape/irrigation, bilingual, solo→crew, $80–6,000  ← UPSELL PATH
- **Verdict/Pay:** Conditional adopt — signs up *today* if Crew tier has a real date. "The difference between yes and no is a date."
- **Fee:** Fine on $150 maintenance ($8.25); $6k install = $330 "walking out the door." ~$17k/mo → ~$975/mo + $39. Tolerable today, "a problem at scale if the product doesn't scale too."
- **Top 3:** F9 ("I am the demand signal you're waiting for" — 2 helpers now, 3rd hired, needs bilingual stop-lists + 1099 hours), F8 (12 stops/3 zips, splits between helpers), F14 (HOA/property-mgmt won't take verbal quotes).
- **Friction:** Stripe Connect onboarding while two helpers watch him fumble in a Home Depot parking lot.
- **Churn:** Hires 3rd helper, crew features still absent → pulls the plug, eats migration cost, goes to Jobber. "I grew, YardSync didn't."
- **Quote:** "El idioma está bien, los precios están bien — but if it can't talk to my crew, it can only talk to my past."

### Sasha — tree service, EN, $800–3,500 tickets, ~$43k/mo  ← FEE-FLIGHT (high-ticket)
- **Verdict/Pay:** Conditional; signs up the day F14 ships *with deposit collection*. Won't pay $39 to send invoices she's already rerouting.
- **Fee:** ~$43k/mo → **$2,365/mo** in fees, ~$1,112/mo premium over Stripe-direct. **Flight point = $1,500.** Any job over that → "conversation with the client" → check/ACH, payment exits the platform. A $3,200 removal = $176 fee "I'm not doing that. Not once." Volume-reward free sub "is noise — the $192 fee on that one job is the conversation." Wants **per-invoice cap (~$75 ceiling)**, or **ACH tier (1%/flat $20)**, or **job-type fee rule**.
- **Top 3:** F14 (no signed estimate = lawsuit waiting on a $3k job — not close), F5 (driveway tap-to-pay after a removal), F15 (4 × 1099, saves January). Write-in: **fee cap / ACH tier**.
- **Friction:** First real estimate has to happen outside YardSync, then copy in, then chase deposit manually = two extra steps every big job → stops logging in.
- **Churn:** Tries to collect a 40% deposit, no deposit flow exists, shows up with a crew and chipper and no money down → out. "Tree work runs on deposit discipline."
- **Quote:** "Cap the fee at $75 and build deposit collection — I'll send every invoice through you and never look back."

### Charlie — HVAC/electrical, EN/ES, 90 recurring agreements, ~$31k/mo  ← RECURRING CONTRACTS
- **Verdict/Pay:** **Walk away** today. F20 + F10 + F9 are binary blockers. "A lawn guy's invoice sender dressed up as a 12-vertical platform."
- **Fee:** ~$31k/mo → ~$1,700/mo (~$20,400/yr) vs Housecall Pro ~$150/mo. 10–12× his current software cost. Would keep agreement revenue *off* the platform, run only one-off calls through it. Wants **flat per-active-member fee ($1–2/mo)** on agreement charges, not 5.5%.
- **Top 3:** F20 (Comfort Club doesn't exist in YardSync without it — binary), F10 (members self-book tune-ups, cuts office phone time), F14 ($1,800–3,500 repairs need signed itemized estimates).
- **Friction:** Lawn-care positioning. His license #/NATE cert is the trust signal; a mower-app client experience undercuts it. Wants trade-neutral/HVAC-branded client-facing pages.
- **Churn:** 5.5% on agreement auto-charges with no accommodation → cancels, eats migration cost as a lesson.
- **Quote:** "The day F20 ships and the fee model has an answer for recurring agreements, I'll move 90 members over the same week — but not an hour sooner."

---

## CROSS-CUTTING SIGNALS (named by multiple personas, unprompted)

1. **Fee-flight on high tickets / high volume — 9 of 13** (Jenny, Sasha, Charlie, Brittany, Dave, Diego, Tyrell, Linda, Marco). Universal ask: a **cap, ACH/check tier, or recurring-agreement accommodation.** The flat 5.5% is read as "a lawn-care fee structure applied to high-ticket verticals."
2. **Stripe Connect onboarding is the #1 conversion killer — 5 of 13** (Marco, Eager, Joaquín, Linda, Diego). The bank/SSN/EIN wall makes non-digital-native and small operators close the tab.
3. **Recurring auto-billing (F20) is a hard gate for the entire recurring half of the market** (Jenny, Charlie, Rosa, + wanted by Marco, Joaquín, Linda).
4. **E-sign quotes + deposit capture (F14) gates every high-ticket vertical** (Sasha, Charlie, Brittany, Dave, Diego, Marcus).
5. **Crew tier (F9) is the upsell + retention gate for growing operators** (Diego, Rosa, Dave, Brittany).
6. **"Lawn-care" positioning is a trust problem for non-lawn trades** (Charlie, Rosa, Marcus, Brittany).
7. **Human/Spanish support is a retention condition for the core ES segment** (Joaquín, Marco).
