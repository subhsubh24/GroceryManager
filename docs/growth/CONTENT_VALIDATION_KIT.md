# Content-First Demand Validation Kit — receipt → pantry (v1)

> **Status: PREPARED, not posted.** Per `docs/growth/DEMAND_VALIDATION_PLAYBOOK.md`, the GTM factory
> prepares this kit; the OWNER films the reaction cut and posts it. No autonomous posting, no
> manufactured engagement, no fabricated comment/view counts — ever. Every claim below is TRUE and
> matches the live product. Pre-launch: every on-screen/caption CTA points at the public waitlist
> (`grocery-manager-web.vercel.app/#waitlist`), never the gated app.

## A. Hero feature (the input → reveal moment)

**Pick: receipt → pantry auto-fill.** Paste a receipt's text (or snap a photo) → a clean, itemized
pantry list appears in ~10 seconds. This is not a new pick — it's the SAME feature the product
factory independently chose as the public, no-account demo (`/demo`, PR #471, §34 Part A, live +
quality-audited as of `QUALITY_SCORECARD` 2026-07-11). Two independent processes converging on the
same "aha" is corroborating evidence this is the right hero moment, not just this run's guess.

It also matches `demand_signal`'s two DURABLE themes (`docs/growth/GROWTH_STATUS.md`): "manual pantry
entry never stays current" and "purchases don't automatically flow into the pantry" — real, cited
complaints against Paprika and KitchenPal. The demo is a direct answer to both, on camera, in one cut.

## B. The demo footage — reuse, don't rebuild

The playbook calls for a throwaway 2–3 screen prop; here that step is DONE for free. The live `/demo`
page (`apps/web/app/demo/page.tsx`) already clears the VISION design bar (real design-system
components, no generic-AI-screen slop) and needs no rebuild — it's the demo footage source directly:

1. Open `grocery-manager-web.vercel.app/demo` on a phone, in good light, screen-recording on.
2. Paste (or type) a short, realistic receipt: e.g. `2% Milk, Eggs (dozen), Sourdough Bread, Bananas,
   Chicken Breast, Greek Yogurt`.
3. Tap submit. Hold the shot on the reveal — the itemized pantry list appearing — for at least 2 full
   seconds before cutting away. That reveal IS the payoff; don't rush it.
4. Optional second take: photograph a real paper receipt instead of pasting text, to show both entry
   paths named in the app's own copy ("Paste or snap").

No fake data is needed — the demo runs on the real extraction, so whatever receipt you type produces
a genuine result. Do not caption or claim anything the screen doesn't actually show.

## C. Hook variations (text overlay, first 1–2 seconds — the crucial variable)

Each hook targets a real, cited pain point (see §A) or a common personal frustration in the same
space — adapt freely, do not reuse verbatim, do not fabricate a "people are saying" claim:

1. "POV: your pantry has been lying to you for years"
2. "I stopped guessing what's actually in my kitchen"
3. "Watch my grocery receipt turn into a pantry list in real time"
4. "The app that reads your receipt so you don't have to type your groceries in"
5. "Why does every 'pantry tracker' app make YOU do all the typing"
6. "This is the laziest way to know what's actually in your fridge"
7. "I paste a receipt. It builds the list. That's it."
8. "Nobody tells you your pantry app is basically a second job — until this"

Order of testing: lead with #1, #3, #7 (curiosity + direct payoff) across the first batch; hold #5/#8
(pain-callout framing) for a second batch once there's a read on which register performs.

## D. Shot list (15–25 seconds total)

1. **0:00–0:02** — Hook text overlay over a static or subtly-moving shot of a cluttered fridge/pantry
   (owner-filmed, real, not stock).
2. **0:02–0:05** — Reaction beat: a short, genuine "ugh, my pantry" moment (no scripted acting needed
   — an honest sigh or eye-roll reads better than a performance).
3. **0:05–0:08** — Cut to phone screen: open `/demo`, paste the receipt text.
4. **0:08–0:12** — Tap submit → hold on the reveal (the itemized list rendering). This is the "wait,
   THAT'S it?" moment — don't cut early.
5. **0:12–0:18** — Quick reaction to the reveal (surprised/pleased, genuine).
6. **0:18–0:22** — On-screen caption: "Full app coming soon — link in bio" (bio link → the public
   waitlist, never the gated `/signup`).
7. Caption/description (below the video, not on-screen): one honest sentence + the waitlist link. No
   invented review counts, no "trusted by X people," no claim beyond what the demo just showed.

## E. Reaction + audio direction

- **Reaction:** first-person, phone-in-hand energy — filmed like you just found this, not like an ad.
  Genuine > polished.
- **Audio category (owner picks the actual track in-app — licensing lives with the platform):**
  "oddly satisfying / clean reveal" trending sounds, or a fast-cut comedic sound tied to the
  before/after beat. Avoid anything that implies a claim the video doesn't make (e.g. tracks
  associated with "life-changing" hype trends the product hasn't earned yet).

## F. Volume plan

Bulk-record 3–5 reaction takes in one sitting (same demo footage, different reaction energy/framing),
pair each with 2–3 of the hooks above (§C), and post as separate short-form pieces across
TikTok / Instagram Reels / YouTube Shorts rather than one "perfect" cut. The game is volume + hook
iteration, not a single hero video — this is the first batch; more hook variations can follow once
there's a comment-signal read (§G).

## G. Reading the signal (once posted)

Views alone prove nothing. Read the COMMENTS for genuine intent: "what's this called," "where do I
get this," "does this work with [X]," "is this real." The GTM factory reads this signal once the
owner reports results back (screenshots/counts) or connects a channel read API — NEVER fabricated,
NEVER estimated from view count alone. Feed a real signal into:
- `demand_signal` (§10) as a THIRD, independent evidence type (content-reaction, not just competitor
  reviews) — same honesty bar: cite the actual comment text, never paraphrase into a fabricated count.
- `BUSINESS_CASE.md` confidence (qualitative, never a new invented number — the same hard bound §10
  already enforces).
- Positioning: whichever hook gets the most "what's this called" replies becomes the landing headline
  candidate for the next `landing_hero` experiment variant.
- A ROADMAP steer only if the signal clears GTM_STANDARD §3's bar (real data, significant N, high
  confidence) or §10's demand-driven auto-steer corroboration bar (≥3 independent posts/threads,
  recent + recurring, direct product-fit) — a few comments on one video do not clear either bar; more
  volume + a real read would be needed first.

## Hard boundaries (restated)

The GTM factory prepared this kit; it does NOT create an account, film, post, or otherwise touch a
social platform. The OWNER owns filming and posting on their own accounts. No manufactured engagement,
no bought views, no fake comments — ever. Every on-screen and caption claim is checked against what
the live `/demo` page actually does. This is WAITLIST-only content per the current `site_gate_up: true`
/ pre-launch phase — the destination link is always the public waitlist, never `/signup`.
