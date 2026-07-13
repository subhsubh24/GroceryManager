/**
 * Launch creative briefs (GTM_STANDARD §11) — the AUTHORING half of the media-staging pipeline.
 *
 * {@link stageCreative} (staging.ts) turns a {@link CreativeBrief} into a reviewable
 * {@link StagingResult}; the adapter (media-gen.ts) produces each asset. What was missing was the
 * invocation site that AUTHORS real briefs from the brand kit + launch plan and drives the batch —
 * this module is that site. The briefs below are hand-authored, deterministic data (no generation,
 * no key, no network), each grounded in a concrete beat of `docs/brand/LAUNCH_PLAN.md` and styled per
 * `docs/brand/BRAND_KIT.md` (Leaf mark, brand green `#0c8a3e`, cream `#faf8f3` surfaces, calm
 * food-forward daylight — one typeface, one accent, no per-page color themes).
 *
 * Every item is written to PASS the pre-publish audit ({@link auditMediaAsset}):
 *   - each carries an explicit FTC AI-assisted disclosure, and
 *   - each prompt/caption describes a CONCRETE scene rather than reaching for generator clichés (the
 *     `audit.ts` slop denylist) — the point of the audit is to keep staged creative from reading as
 *     obviously-AI, so the authored briefs model that discipline. `assertBriefsAudit` proves it in CI.
 *
 * This produces NOTHING on its own without a Gemini/Vertex credential: {@link stageLaunchCreative}
 * degrades to an all-`unavailable` manifest per brief (no network, no throw), exactly like the rest of
 * the media pipeline. Persisting the produced assets + running this on a schedule is the owner-gated
 * edge (Track H). The keyless, always-valid half — authoring correct, audit-clean briefs and driving
 * the batch — lives here and is unit-proven.
 */
import { auditMediaAsset, type MediaAuditResult } from "./audit.js";
import { getMediaGenClient, type MediaGenClient } from "./media-gen.js";
import { stageCreative, type CreativeBrief, type StagingResult } from "./staging.js";

/**
 * The single AI-assisted disclosure shipped with every launch asset. Conveys AI involvement (FTC) —
 * satisfies {@link auditMediaAsset}'s disclosure check and is the exact string a reviewer sees.
 */
export const LAUNCH_AI_DISCLOSURE = "Imagery created with AI assistance (Google Gemini).";

/**
 * The launch-beat creative briefs, in the order the launch plan needs them. Each maps to a real
 * milestone in `docs/brand/LAUNCH_PLAN.md`; the prompts describe the specific scene to render in the
 * brand's calm, food-forward daylight style. Priority order within a brief mirrors the plan (hero
 * first). Ids are stable so a persisted staging manifest is re-identifiable across runs.
 */
export const LAUNCH_CREATIVE_BRIEFS: readonly CreativeBrief[] = [
  {
    id: "product-hunt-launch",
    purpose:
      "Product Hunt launch listing — gallery hero + secondary image + a short demo clip (LAUNCH_PLAN Phase 1, Day 0).",
    items: [
      {
        format: "image",
        quality: "pro",
        aspectRatio: "4:3",
        disclosure: LAUNCH_AI_DISCLOSURE,
        prompt:
          "A smartphone resting on a cream kitchen counter in soft morning daylight from a side window. " +
          "The screen shows a tidy pantry list with a small green leaf logo in the corner, a few labelled " +
          "staples (olive oil, rice, eggs, tomatoes) and one 'running low' tag. A wooden bowl of lemons " +
          "sits just behind the phone. Calm, uncluttered, shot slightly from above.",
        caption: "Your pantry, kept up to date for you.",
      },
      {
        format: "image",
        quality: "default",
        aspectRatio: "1:1",
        disclosure: LAUNCH_AI_DISCLOSURE,
        prompt:
          "Overhead view of a light wooden kitchen table: a phone showing a simple weekly dinner plan " +
          "with three meal cards, a short handwritten grocery list on a notepad, a small bunch of fresh " +
          "basil, and two ripe tomatoes. Even natural daylight, plenty of empty table space, nothing glossy.",
        caption: "Plan the week, cook what you have.",
      },
      {
        format: "video",
        aspectRatio: "16:9",
        durationSeconds: 8,
        disclosure: LAUNCH_AI_DISCLOSURE,
        prompt:
          "A calm, screen-recording-style walkthrough of a grocery app: it opens to a pantry list, a finger " +
          "taps 'Cook what I have', and three simple recipe cards slide in. Plain white app surfaces, a single " +
          "green accent, unhurried pacing, no captions on screen.",
        caption: "From a full pantry to tonight's dinner in three taps.",
      },
    ],
  },
  {
    id: "launch-day-social",
    purpose:
      "Launch-day social posts — Instagram square + X/Twitter header (LAUNCH_PLAN Phase 1, Day 0 social beats).",
    items: [
      {
        format: "image",
        quality: "default",
        aspectRatio: "1:1",
        disclosure: LAUNCH_AI_DISCLOSURE,
        prompt:
          "A hand holding a phone in a bright kitchen; the screen shows an expiring-soon shelf with a carton " +
          "of spinach and a 'use by Friday' note beside a suggested recipe. Out-of-focus herbs and a chopping " +
          "board in the background. Warm daylight, natural skin tones, relaxed and real.",
        caption: "Never let good food go to waste.",
      },
      {
        format: "image",
        quality: "default",
        aspectRatio: "16:9",
        disclosure: LAUNCH_AI_DISCLOSURE,
        prompt:
          "A wide, tidy kitchen counter scene in daylight: a phone propped against a small green leaf-logo tile " +
          "shows a grocery list; to the side, a paper bag of vegetables, a loaf of bread, and a single pear. " +
          "Lots of calm negative space to the right for a headline. Soft, even light, no props crowding the frame.",
      },
    ],
  },
  {
    id: "waitlist-launch-email",
    purpose:
      "Launch email header image for the waitlist announcement (LAUNCH_PLAN Phase 1, Day 0 — CONTENT_DRAFTS Email 2).",
    items: [
      {
        format: "image",
        quality: "default",
        aspectRatio: "16:9",
        disclosure: LAUNCH_AI_DISCLOSURE,
        prompt:
          "A welcoming, simple header scene: a cream table by a window with a phone showing the app's home " +
          "screen (a small green leaf logo, a short pantry summary), a cup of coffee, and a few loose " +
          "vegetables. Gentle morning daylight, generous empty space around the phone, nothing staged or shiny.",
        caption: "We're live — your grocery autopilot is here.",
      },
    ],
  },
];

/**
 * Audit every item in every authored brief. The launch briefs are meant to be publish-ready, so this
 * asserts each one is audit-clean (disclosure present + no slop vocabulary) — the keyless proof that
 * the authoring half upholds the same maker≠checker bar the adapter enforces before spending.
 *
 * @returns per-item results keyed by `"<briefId>#<index>"`, and whether ALL passed.
 */
export function auditLaunchBriefs(): {
  pass: boolean;
  results: Array<{ key: string; audit: MediaAuditResult }>;
} {
  const results: Array<{ key: string; audit: MediaAuditResult }> = [];
  for (const brief of LAUNCH_CREATIVE_BRIEFS) {
    brief.items.forEach((item, i) => {
      results.push({ key: `${brief.id}#${i}`, audit: auditMediaAsset(item) });
    });
  }
  return { pass: results.every((r) => r.audit.pass), results };
}

/**
 * Stage every launch brief through the media adapter and collect the reviewable results — the batch
 * driver the launch plan needs. Sequential + bounded (each call is wall-clock capped inside the
 * adapter). NEVER throws: with no Gemini key every brief resolves to an all-`unavailable` manifest.
 * The caller persists the returned manifests + raw assets at the owner-gated edge (Track H / §13).
 *
 * @param client  the media adapter (defaults to the shared singleton; inject a fake in tests).
 * @param now     staging timestamp (injectable for deterministic tests).
 */
export async function stageLaunchCreative(
  client: MediaGenClient = getMediaGenClient(),
  now: Date = new Date(),
): Promise<StagingResult[]> {
  const staged: StagingResult[] = [];
  for (const brief of LAUNCH_CREATIVE_BRIEFS) {
    staged.push(await stageCreative(brief, client, now));
  }
  return staged;
}
