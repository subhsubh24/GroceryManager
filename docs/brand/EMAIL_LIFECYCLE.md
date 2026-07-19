# GroceryManager — Full Email Lifecycle

> **Status: STAGED — do NOT send.** All sequences are ready for import into your email service
> (Resend, SendGrid, Mailchimp, etc.) once the owner connects and funds the account.
> Sending is Human Core — see `PENDING_OPS.md`.
>
> Placeholders: `[APP_NAME]` → final brand name from `NAMING_CANDIDATES.md`;
> `[APP_STORE_URL]`, `[PLAY_STORE_URL]`, `[DEEP_LINK_*]` → owner fills at activation.
> `{{user.first_name}}` → dynamic field from your email platform.

---

## Sequence map

```
Sign-up
  │
  ├─ WL1: Waitlist welcome (pre-launch only)
  │
  └─ A0: Welcome (post-launch, on account creation)
       │
       ├─ A1: Day 2 — activation nudge (if no receipt scanned or Gmail connected)
       ├─ A2: Day 7 — "one setup step" nudge (if still no receipt/Gmail)
       ├─ A3: Day 14 — premium feature spotlight (if free, has ≥3 pantry items)
       │
       └─ Trial starts
            │
            ├─ T1: Trial day 1 — welcome to trial
            ├─ T2: Trial day 5 — "2 days left" nudge
            ├─ T3: Trial day 7 — last chance (if not yet converted)
            │
            └─ Converted to Paid
                 │
                 ├─ P1: Payment confirmation
                 ├─ P2: Month 1 → month 3: quarterly check-in
                 ├─ P3: Month 11 (annual plan): renewal reminder
                 │
                 └─ Churned
                      │
                      ├─ C1: Post-cancellation: "what happened?" (day 1)
                      └─ C2: Win-back day 30 (if inactive ≥ 30 days post-cancel)

Re-engagement
  └─ R1: Dormant user (30 days no login, still free or paid)
```

---

## WL — Waitlist (pre-launch)

### WL1 — Waitlist welcome

**Trigger:** User submits the waitlist form on the landing page (pre-launch).
**Send:** Immediately on sign-up.

**Subject:** You're on the list

**Preview:** We'll reach out the moment [APP_NAME] goes live.

---

Hi {{user.first_name | default: "there"}},

You're on the list. We'll email you the moment [APP_NAME] hits the App Store and Google Play.

Here's what you're getting access to:

**Always know what to cook.** [APP_NAME] tracks what's in your kitchen — automatically, from your receipts — and suggests meals you can make tonight with what you already have.

**Know what to buy before you run out.** The app watches how fast you go through things and tells you when to reorder, so the shopping list builds itself.

**Your pantry, on autopilot.** Snap a receipt, scan your fridge, or connect Gmail — items flow in without manual entry.

We're putting the finishing touches on now. You'll be first to know.

— The [APP_NAME] team

---

*You're on this list because you signed up at [APP_URL]. Not you? Ignore this.*

---

### WL2 — Launch day (to waitlist)

**Trigger:** App goes live. Send to full waitlist.
**Send:** Launch day, 09:00 owner local time.

**Subject:** [APP_NAME] is live — download it now

**Preview:** Available on the App Store and Google Play.

---

Hi {{user.first_name | default: "there"}},

It's here. [APP_NAME] is live.

**[Download on the App Store →]([APP_STORE_URL])**
**[Get it on Google Play →]([PLAY_STORE_URL])**

Set up your pantry in under two minutes — snap your most recent grocery receipt to get started. The app will pull out every item, estimate how much you have, and tell you what to cook tonight.

The free tier gives you everything for the core loop: pantry tracking, receipt capture, cook logging, and your shopping list. No credit card needed.

If you want the full autopilot — automatic Gmail receipt import, AI weekly meal planner, unlimited recipe discovery — start your **7-day free trial** inside the app. No charge until the trial ends.

Welcome.

— The [APP_NAME] team

---

## A — Activation (post-launch, new users)

### A0 — Welcome

**Trigger:** New account created (post-launch).
**Send:** Immediately.

**Subject:** Your pantry starts here

**Preview:** One step to get started — it takes 30 seconds.

---

Hi {{user.first_name | default: "there"}},

Welcome to [APP_NAME].

The fastest way to set up your pantry: **snap your most recent grocery receipt.**

Open the app → tap Import → take a photo of any receipt. We'll pull out every item and add it to your pantry automatically. After 2–3 receipts, the app knows what you have and starts building your shopping list on its own.

[Snap your first receipt →]([DEEP_LINK_SCAN])

If you'd rather start manually, the Quick Add button on the Pantry screen lets you type items in one by one. Both methods work; the receipt scan just gets you there faster.

One more thing: connect Gmail (Import → Connect Gmail) if you want receipts to import automatically from your inbox — no photos needed.

Any questions? Reply to this email.

— The [APP_NAME] team

---

### A1 — Day 2 activation nudge

**Trigger:** 48 hours after signup, user has 0 pantry items AND has not connected Gmail.
**Send:** Day 2 after signup.

**Subject:** Getting your pantry started

**Preview:** The one step that makes everything else work.

---

Hi {{user.first_name | default: "there"}},

It looks like you haven't added anything to your pantry yet.

The fastest way: **point your phone camera at any grocery receipt.** It takes about 10 seconds and the app fills in everything from that shop automatically.

[Add your first receipt →]([DEEP_LINK_SCAN])

Once you have a few items in, you'll start seeing:

- What you're running low on (before you run out)
- Meals you can cook tonight with what you have
- A shopping list that builds itself

It's worth the 30 seconds. Give it a try.

— The [APP_NAME] team

---

### A2 — Day 7 activation nudge

**Trigger:** 7 days after signup, user has fewer than 5 pantry items AND has never started a trial.
**Send:** Day 7 after signup.

**Subject:** Getting the most out of [APP_NAME]

**Preview:** One setup step that makes the whole thing click.

---

Hi {{user.first_name | default: "there"}},

If you've only added a few items manually, here's the step that makes [APP_NAME] feel automatic: **snap a receipt**.

Open the app → tap Import → photograph any recent grocery receipt. We'll pull out items, quantities, and prices. After a few receipts the app knows your pantry, your reorder patterns, and when you're about to run out.

[Snap a receipt now →]([DEEP_LINK_SCAN])

Or connect Gmail (Import → Connect Gmail) to pull receipts from your inbox automatically — no photos needed. Gmail import is a Premium feature; you get 7 days free to try it.

Any questions? Reply to this email — we read every one.

— The [APP_NAME] team

---

### A3 — Day 14 premium feature spotlight

**Trigger:** 14 days after signup, user is on free plan, has ≥ 3 pantry items (engaged but not converted).
**Send:** Day 14.

**Subject:** You've got a pantry — here's what's next

**Preview:** Automatic receipt import + AI meal planning — 7-day free trial.

---

Hi {{user.first_name | default: "there"}},

You've been tracking your pantry for two weeks. Nice.

Here's what Premium adds on top of what you're already doing:

**Automatic Gmail receipt import.** Instead of snapping receipts, connect your inbox and every grocery delivery or supermarket order flows in on its own. Your pantry stays current without you doing anything.

**AI weekly planner.** Tell the app what you feel like eating this week. It checks your pantry, fills gaps, and builds a shopping list of only what you're missing — one tap.

**AI recipe remix.** Make any recipe fit what you already have — healthier, cheaper, or vegan in a tap.

Try all of it free for 7 days — no charge until the trial ends, cancel anytime.

[Start your free trial →]([DEEP_LINK_UPGRADE])

— The [APP_NAME] team

---

## T — Trial sequences

### T1 — Trial day 1: welcome to trial

**Trigger:** User starts a free trial (subscription created, status = trialing).
**Send:** Immediately on trial start.

**Subject:** Your trial has started — here's what's unlocked

**Preview:** 7 days of the full [APP_NAME] experience.

---

Hi {{user.first_name | default: "there"}},

Your 7-day free trial is active.

Here's what's now unlocked for you:

- **Automatic Gmail receipt import** — connect your inbox in Import → Connect Gmail
- **AI weekly planner** — tap Plan on the home screen
- **Unlimited Discover feed** — scroll meal ideas tuned to your pantry
- **AI recipe remix** — make any recipe fit what you have
- **Advanced spend insights** — see your grocery budget breakdown

The most useful first step: **connect Gmail**. It's the feature that makes everything else feel automatic.

[Connect Gmail now →]([DEEP_LINK_GMAIL])

Your trial ends in 7 days. After that it's $4.99/month or $39.99/year. Cancel anytime from your profile — no questions asked.

— The [APP_NAME] team

---

### T2 — Trial day 5: "2 days left"

**Trigger:** Trial day 5, user has NOT converted.
**Send:** Day 5 of trial.

**Subject:** 2 days left in your trial

**Preview:** Still time to connect Gmail and see it work.

---

Hi {{user.first_name | default: "there"}},

Your free trial ends in 2 days.

If you haven't connected Gmail yet, this is the move: Import → Connect Gmail → follow the consent screen. It takes 60 seconds and then your pantry updates automatically after every grocery order.

After your trial ends:

- Free features stay: pantry tracking, receipt scan, cook logging, shopping list, recipes
- Premium features pause: Gmail import, AI planner, Discover, remix

Keep everything for $4.99/month. Cancel anytime.

[Continue with Premium →]([DEEP_LINK_UPGRADE])

— The [APP_NAME] team

---

### T3 — Trial day 7: last chance (not yet converted)

**Trigger:** Trial day 7 (last day), user has NOT converted.
**Send:** Morning of trial expiry day.

**Subject:** Your trial ends today

**Preview:** Keep Gmail import and the AI planner for $4.99/month.

---

Hi {{user.first_name | default: "there"}},

Your free trial of [APP_NAME] ends today.

After today, Gmail import, AI meal planning, and unlimited recipe discovery will pause. Your pantry and all your data stay — nothing is deleted.

If the trial has been useful, keep it going:

**[Continue with Premium — $4.99/month →]([DEEP_LINK_UPGRADE])**
**[Annual plan — $39.99/year (save 33 %) →]([DEEP_LINK_UPGRADE_ANNUAL])**

If now isn't the right time, no problem. The free tier is genuinely useful — come back whenever.

— The [APP_NAME] team

---

## P — Paid subscriber sequences

### P1 — Payment confirmation

**Trigger:** Subscription payment succeeds (first charge or renewal).
**Send:** Immediately on successful payment.

**Subject:** Receipt — [APP_NAME] Premium

**Preview:** ${{charge_amount}} charged to {{payment_method}}.

---

Hi {{user.first_name | default: "there"}},

Here's your receipt for [APP_NAME] Premium.

**Plan:** {{plan_name}}
**Amount:** ${{charge_amount}}
**Date:** {{charge_date}}
**Next renewal:** {{next_renewal_date}}

Manage or cancel your subscription anytime from your Profile page or from App Store / Google Play account settings.

Questions? Reply to this email.

— The [APP_NAME] team

---

### P2 — Quarterly value check-in (months 3, 6, 9)

**Trigger:** User has been a paid subscriber for 3, 6, or 9 months.
**Send:** On the monthly anniversary, if not already on annual plan.

**Subject:** 3 months of [APP_NAME]

**Preview:** What you've tracked — and what's waiting if you upgrade to annual.

---

Hi {{user.first_name | default: "there"}},

You've been using [APP_NAME] for 3 months.

Over that time you've logged {{cook_count | default: "dozens of"}} cooks, added {{receipt_count | default: "receipts"}} receipts, and kept a pantry that basically runs itself.

One thing worth knowing: the annual plan works out to $3.33/month — you'd save $20 vs monthly over the next year. If [APP_NAME] is part of your weekly routine, the annual plan is the better deal.

[Switch to annual →]([DEEP_LINK_UPGRADE_ANNUAL])

Otherwise, no action needed — you'll renew automatically on {{next_renewal_date}}.

— The [APP_NAME] team

---

### P3 — Annual renewal reminder (month 11)

**Trigger:** Annual subscriber, 30 days before renewal.
**Send:** Day 335 of annual subscription.

**Subject:** Your annual plan renews in 30 days

**Preview:** $39.99 renews on {{renewal_date}}.

---

Hi {{user.first_name | default: "there"}},

A heads-up: your [APP_NAME] annual plan renews on **{{renewal_date}}** for **$39.99**.

No action needed to continue. To cancel before renewal, go to your profile page or manage your subscription through App Store / Google Play.

If you have questions or feedback before renewal, reply here.

— The [APP_NAME] team

---

## C — Cancellation and win-back

### C1 — Post-cancellation (day 1)

**Trigger:** Subscription cancelled (not expired — user actively cancelled).
**Send:** Same day as cancellation.

**Subject:** You've cancelled — here's what happens next

**Preview:** Your access continues until {{end_date}}.

---

Hi {{user.first_name | default: "there"}},

Got it — your [APP_NAME] Premium subscription has been cancelled.

Your Premium access continues until **{{subscription_end_date}}**. After that, your pantry, recipes, and data all stay — only Premium features pause.

**One thing:** if you cancelled because something wasn't working, we'd genuinely like to know. Reply to this email and tell us what happened. We read every reply.

If you change your mind before {{subscription_end_date}}, you can reactivate from your profile page.

— The [APP_NAME] team

---

### C2 — Win-back day 30

**Trigger:** User cancelled ≥ 30 days ago, has not reactivated, but has logged in at least once in the last 30 days (still using the free tier).
**Send:** Day 30 post-cancellation.

**Subject:** Still cooking?

**Preview:** One thing that's changed since you cancelled.

---

Hi {{user.first_name | default: "there"}},

It's been a month since you cancelled [APP_NAME] Premium.

We've shipped a few updates since then — here's the one most people notice: the Cook Tonight suggestions now prioritise items that are about to expire first, so you waste less without thinking about it.

If you want to come back:

**[Reactivate Premium →]([DEEP_LINK_UPGRADE])**

Annual plan is still $39.99/year — that's $3.33/month if you want to lock it in.

No pressure either way. Just wanted you to know what's new.

— The [APP_NAME] team

---

## R — Re-engagement

### R1 — Dormant user

**Trigger:** User (free or paid) has not opened the app in 30 days.
**Send:** Day 30 of inactivity.

**Subject:** What's in your fridge right now?

**Preview:** [APP_NAME] has some suggestions.

---

Hi {{user.first_name | default: "there"}},

It's been a while. Your pantry is probably a bit stale — things will have moved on since you last checked.

One quick thing: open the app and snap your fridge or a recent receipt. 60 seconds to get back up to date, and Cook Tonight will have something useful for you tonight.

[Open [APP_NAME] →]([DEEP_LINK_HOME])

— The [APP_NAME] team

---

*You're getting this because you have a [APP_NAME] account. [Unsubscribe]([UNSUBSCRIBE_URL]).*

---

## Implementation notes for the owner

**Email platform:** Resend (recommended for transactional) + a list tool (Mailchimp or Loops) for
broadcast. Both integrate with the Next.js API routes. Triggers are documented here; the owner
connects the platform and maps each trigger to the relevant API event (Stripe webhook, sign-up
event, inactivity signal from the DB).

**Dynamic fields:** Replace `{{user.first_name}}` etc. with your platform's merge-tag syntax
before importing. Fields like `{{cook_count}}` require a data enrichment step (query the DB
before send); add that to the platform's pre-send hook.

**Compliance:** Every broadcast email requires an unsubscribe link (`[UNSUBSCRIBE_URL]`).
Transactional emails (P1 receipt, trial confirmations) are exempt from unsubscribe requirements
in most jurisdictions but should still include a "contact us" path.

**Timing rules (platform config):**
- Never send more than 1 email per day to any user
- Suppress C2 win-back if user has reactivated
- Suppress R1 re-engagement if user is in a trial sequence
- All sequences stop on account deletion
