# GroceryManager — Launch Plan & Content Calendar

> **Status: STAGED — ready for owner to execute.** All milestones below are buildable in advance;
> execution requires the owner to connect accounts and publish. See PENDING_OPS.md for the
> activation checklist.

---

## Overview

**Goal:** Drive enough downloads in the first 30 days to surface the app in App Store/Play search
for "pantry tracker," "meal planner," and "grocery list" — organic discovery compounds from there.

**Target:** 500 installs in month 1, converting 25+ to paying subscribers ($4.99/mo).

**Channels:** Waitlist email → App Store / Play launch → Product Hunt → Reddit communities →
personal networks → content marketing (SEO). Paid ads are Human Core (owner funds + activates).

---

## Phase 0 — Pre-launch (2–4 weeks before submission)

### Week −4 to −2: Submission prep

| Task | Owner | Deadline |
|---|---|---|
| Apply DB migration 0011 (push tokens) | Owner | Before launch |
| Set Stripe + RevenueCat keys in Vercel | Owner | Before launch |
| Set EXPO_PUBLIC_PROJECT_ID for push | Owner | Before launch |
| Export icon PNGs (1024px + 512px) from `icon.svg` | Owner | Before submission |
| Take screenshots on iPhone 15 Pro (5 screens, see spec) | Owner | Before submission |
| Create Apple Developer account ($99) | Owner | Before submission |
| Create Google Play Console account ($25) | Owner | Before submission |
| Create App Store Connect app + fill in metadata | Owner | Before submission |
| Connect ConvertKit / Mailchimp (waitlist emails) | Owner | Before launch |
| Verify Plausible tracking fires (`NEXT_PUBLIC_PLAUSIBLE_DOMAIN`) | Owner | Before launch |
| Test end-to-end flow on production (sign-up → pantry → cook) | Owner | Before launch |
| Test Stripe subscription checkout (test mode, then live) | Owner | Before launch |

### Week −2 to −1: Pre-launch buzz

| Date (relative) | Activity | Copy source |
|---|---|---|
| T−14 | Send waitlist update email ("launching soon") | `CONTENT_DRAFTS.md` → "Pre-launch waitlist follow-up" |
| T−10 | Post to personal Twitter/X: "working on something" teaser | — |
| T−7 | Submit app to App Store review (expect 1–3 day review) | — |
| T−7 | Submit app to Google Play review (expect 2–7 day review) | — |
| T−3 | Prepare Product Hunt submission draft (title, tagline, description, media) | See "Product Hunt" section below |
| T−3 | Pre-schedule Twitter/Instagram launch posts | `CONTENT_DRAFTS.md` → Social posts |
| T−1 | Confirm apps approved and ready | — |

---

## Phase 1 — Launch week (Day 0–7)

### Day 0 — Launch day

| Time (suggested) | Activity |
|---|---|
| 09:00 local | App goes live (confirm both stores) |
| 09:15 | Send launch email to waitlist | `CONTENT_DRAFTS.md` → Email 2 "Launch day" |
| 09:30 | Post to Twitter/X | `CONTENT_DRAFTS.md` → Twitter launch post |
| 09:30 | Post to Instagram | `CONTENT_DRAFTS.md` → Instagram caption |
| 10:00 | Post to LinkedIn | `CONTENT_DRAFTS.md` → LinkedIn post |
| 11:00 | Submit Product Hunt listing (schedule for 12:01 AM PST for best ranking) | See below |
| 12:00 | Reply to all early comments/questions | — |
| Throughout | Direct message personal network (20–30 people) asking for honest reviews | — |

### Day 1–7 — Post-launch

| Day | Activity |
|---|---|
| Day 1 | Monitor App Store / Play Store reviews; reply to any 1–3 star reviews |
| Day 2 | Submit to Hacker News "Show HN" post | Template below |
| Day 3 | Post in r/mealplanning, r/zerowaste, r/mealprep (authentic, rule-compliant) | Template below |
| Day 5 | Send "getting started" onboarding email to new signups | `CONTENT_DRAFTS.md` → Email 3 |
| Day 7 | Check Plausible: signup rate, upgrade page visits |
| Day 7 | Check App Store / Play Store: conversion rate, keyword rankings |

---

## Phase 2 — Post-launch month (Day 8–30)

### SEO content cadence

One post per week (2–3 hours each). Publish on the `/blog` route (future: add a blog).
Priority topics ranked by search volume and relevance:

| Week | Topic | Target keyword | Estimated intent |
|---|---|---|---|
| Week 2 | "How to stop wasting food at home" | food waste reduction | Broad, top-of-funnel |
| Week 3 | "The easiest meal planning method for busy people" | easy meal planning | High intent, mid-funnel |
| Week 4 | "Pantry tracker apps: what actually works in 2026" | pantry tracker app | Competitor comparison |
| Week 5 | "How to scan grocery receipts and track spending automatically" | scan grocery receipts | Bottom-funnel, product-specific |

*Note: All content must be authentic and helpful first; promotion second. Never stuff keywords.*

### Email drip cadence

Automated via the connected email service (ConvertKit / Mailchimp / Loops):

| Trigger | Email | Copy source |
|---|---|---|
| Sign-up | Email 1: "You're on the list" | `EMAIL_LIFECYCLE.md` → Welcome |
| Launch day | Email 2: "GroceryManager is live" | `EMAIL_LIFECYCLE.md` → Launch |
| Day 7 (inactive) | Email 3: "Getting started" nudge | `EMAIL_LIFECYCLE.md` → Day 7 onboarding |
| Day 30 (active free) | Email 4: "Unlock the full autopilot" | `EMAIL_LIFECYCLE.md` → Day 30 upgrade |
| Trial started | Email 5: "Make the most of your trial" | `EMAIL_LIFECYCLE.md` → Trial start |
| Trial ending | Email 6: "Your trial ends in 2 days" | `EMAIL_LIFECYCLE.md` → Trial ending |

### Metrics to track (weekly)

| Metric | Target (month 1) | Where to find |
|---|---|---|
| App downloads | 500+ | App Store Connect / Play Console |
| Sign-ups | 200+ | Plausible + DB query |
| Free→trial conversion | ≥7% | Plausible "Upgrade" event |
| Trial→paid conversion | ≥20% | Stripe Dashboard |
| 7-day retention | ≥40% | Plausible (return visitors) |
| App Store rating | ≥4.5 | App Store Connect |

---

## Platform-specific copy

### Product Hunt listing

**Name:** GroceryManager
**Tagline:** Your grocery + cooking autopilot
**Description:**
GroceryManager tracks what's in your kitchen, predicts when you're about to run out, suggests
meals you can cook tonight, and builds your shopping list — automatically, from your receipts and
a quick fridge scan. No manual entry. No spreadsheets. Just open the app.

Free core. Premium ($4.99/mo) unlocks Gmail receipt import, AI weekly planner, unlimited
recipe remix, and Grocery Wrapped (your year in food).

Built with Next.js, Expo, and a framework-agnostic engine that powers both the web app and the
native iOS + Android apps identically.

**Topics:** Productivity, Food & Drink, Utilities
**Makers:** [owner's name]
**Gallery:** 5 app screenshots (see store-assets-spec.md for sizes)

**First comment (from maker):**
"I built this because I kept standing in front of an empty fridge not knowing what to cook,
even after a full grocery shop. The app now tells me what to cook from what I have and when to
reorder before I notice I've run out. Would love feedback on the cook-from-pantry experience —
that's the core loop."

---

### Hacker News "Show HN" post

**Title:** Show HN: GroceryManager — grocery + cooking autopilot for people who cook at home

**Body:**
I built a grocery and cooking autopilot as a side project. It ingests receipts (Gmail OAuth or
photo), builds a pantry from them, watches depletion rates, and surfaces "cook what you have
tonight" suggestions and a smart shopping list.

The tech stack: Next.js 15 (App Router) + Expo for the native app, Drizzle + Postgres with
full RLS multi-tenancy, Gemini flash-lite/flash/pro cheap-first cascade for receipt parsing and
meal gen. Everything degrades gracefully without API keys.

It's subscription-based ($4.99/mo or $39.99/yr) with a generous free tier. The PWA is live at
[URL]; native apps just launched on the App Store and Play Store.

Happy to answer questions about the architecture, the RLS multi-tenant model, or the Gemini
receipt-parsing pipeline.

[App Store link] [Play Store link] [Web link]

---

### Reddit communities (authentic, rule-compliant)

Check each community's rules before posting. Many require personal experience, not promotion.

**r/mealplanning** (~250K members):
"I've been using an app I built to auto-track my pantry from receipts — curious if others have
tried similar tools. The part that clicked for me was 'cook from what you have' suggestions:
you tell it what's in your fridge and it ranks recipes by how many ingredients you already
have. Anyone doing this manually with a spreadsheet or another app?"

**r/zerowaste** (~500K members):
"Built a pantry tracker that watches shelf life and surfaces 'use it up' recipes when items are
about to expire — curious if this resonates with people trying to reduce food waste. It also
tracks what I'm throwing away (via the pantry depletion model) which is eye-opening."

**r/mealprep** (~1.5M members):
"Built a 'plan my week' feature that checks what's in my pantry, gaps against my planned meals,
and builds the shopping list. Cut my grocery bill noticeably. Anyone doing something similar?"

*Important: Read each community's self-promotion rules. Post as a genuine participant, not a marketer.*

---

## Growth loop (referrals + share surfaces)

The referral mechanics are wired in the app:
- Every user has an invite code at `/invite` (copy link or native share)
- `?ref=CODE` on `/signup` attributes the referral
- Referred users count is shown on the invite page

**Growth loop actions:**
1. After a successful cook, show a subtle "Share your streak" prompt → links to Grocery Wrapped share page
2. The public shareable cookbook at `/share/cookbook/[token]` includes a "Get GroceryManager free" CTA
3. The public recipe share at `/share/recipe/[id]` includes a "Build your pantry for free" CTA

**Referral incentive (owner decision — Human Core):** The code supports a signal-based credit system;
the actual incentive (e.g., "1 week free per referred friend") is an owner decision and requires
Stripe/RevenueCat wiring to implement credits.

---

## Monthly content calendar template

Use this as a repeating structure after launch:

| Week | Blog post | Social post | Email |
|---|---|---|---|
| Week 1 | Publish long-form food/kitchen guide | Share blog post + excerpt | Segment: inactive users → re-engagement |
| Week 2 | Share customer story (ask happy users) | User testimonial (quoted + screenshot) | Upgrade nudge: active free users |
| Week 3 | App tip / feature spotlight | "Did you know?" short-form | Monthly changelog / what's new |
| Week 4 | Seasonal content (e.g., winter meal prep) | Seasonal recipe roundup | Trial users: expiring reminder |

---

## Budget guidance (Human Core — owner decision)

| Channel | Suggested first-month budget | Notes |
|---|---|---|
| App Store Search Ads | $200–$500 | Target: "pantry tracker," "meal planner," "grocery list" |
| Reddit Ads | $100–$200 | Target: r/mealplanning, r/zerowaste, r/mealprep |
| Twitter/X Ads | Test $50 | If organic post gets strong engagement |
| Influencer / food blogger outreach | $0 (gifted access) | Offer free Premium in exchange for honest review |

**Recommendation for a bootstrapped launch:** Do NOT spend on ads until organic traction
is proven (≥200 downloads, ≥4.3 star average, sign-up page converts >15% of visitors).
Spend on ads too early amplifies a leaky funnel, not a working one.
