/**
 * AI-adaptive conversational onboarding (PLAN §8.7) — the *agentic* counterpart to the deterministic
 * `answersToSignals` / `parseFreeTextPreferences` in `onboarding.ts`. Instead of a fixed chip form,
 * a warm host asks ONE high-signal question per turn, ADAPTS the next question to the latest answer,
 * and extracts typed PreferenceSignals as it goes — feeding the SAME ledger the planner + recipe
 * ranking read from. After ~5–7 useful exchanges (or once the picture is solid) it wraps up.
 *
 * Server-only by construction: this calls Gemini, so it must only ever be reached from a server
 * action — NEVER imported by a client component. (We don't `import "server-only"` here because this
 * package isn't bundled by Next's RSC compiler — that import isn't resolvable under the package's
 * own tsc/vitest — so the discipline is enforced at the import boundary: only `onboarding/actions.ts`
 * ("use server") imports it.) The web layer's `nextOnboardingTurn` call persists the returned
 * `signals` as source "onboarding_q" and re-projects, exactly like the keyless wizard.
 */
import { z } from "zod";
import type { GeminiClient } from "../llm/client.js";

/**
 * One turn of the interview. `signals` are the preferences inferred FROM THE LATEST ANSWER, typed
 * with the EXACT topic conventions `projectUserModel` consumes (see below). `done` flips true on the
 * wrap-up turn (no new question). `confidence` is 0..1; we clamp on the way out. `options` are 3–6
 * short suggested quick answers for the CURRENT question, rendered as tappable chips in the tile UI
 * (the user can still type their own); empty on a wrap-up (`done`) turn.
 */
export const OnboardingTurnSchema = z.object({
  reply: z.string(),
  done: z.boolean(),
  options: z.array(z.string()).optional(),
  signals: z.array(
    z.object({
      topic: z.string(),
      value: z.string().nullable(),
      polarity: z.enum(["positive", "negative", "neutral"]),
      confidence: z.number(),
    }),
  ),
});

/**
 * The CLEANED turn `nextOnboardingTurn` returns. The raw schema makes `options` optional (the model
 * may omit it), but the function always normalizes it to a concrete array, so the public contract
 * guarantees `options: string[]` (callers never have to null-check it).
 */
export type OnboardingTurn = Omit<z.infer<typeof OnboardingTurnSchema>, "options"> & {
  options: string[];
};

export interface OnboardingMessage {
  role: "user" | "assistant";
  content: string;
}

/**
 * Topic prefixes that actually move the UserModel (see `projectUserModel`). A signal whose topic
 * doesn't start with one of these would just be dead weight in the ledger (the projection ignores
 * unknown kinds), so we drop it — keeping the semantic layer honest regardless of what the model emits.
 */
const ALLOWED_TOPIC_PREFIXES = ["diet:", "allergen:", "cuisine:", "ingredient:", "quality:"] as const;

/**
 * Topics that are facts-about-the-user, not likes/dislikes: a diet they follow, an allergy they
 * have, a quality they want. `projectUserModel` only registers diet/allergen/quality when their net
 * contribution is > 0, and `sign("neutral") === 0` — so a "neutral" diet/allergen would be SILENTLY
 * DROPPED (and allergens are safety-critical). We coerce these kinds to "positive" so they always
 * land, mirroring the deterministic `answersToSignals` convention. (Cuisine/ingredient keep the
 * model's polarity, since "negative" is meaningful there.)
 */
const FORCE_POSITIVE_KINDS = ["diet:", "allergen:", "quality:"] as const;

const clamp01 = (n: number) => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));

/** A topic is usable iff it's "<allowedKind>:<non-empty-key>". */
function isAllowedTopic(topic: string): boolean {
  const t = topic.trim().toLowerCase();
  return ALLOWED_TOPIC_PREFIXES.some((p) => t.startsWith(p) && t.length > p.length);
}

const isForcePositive = (topic: string) => FORCE_POSITIVE_KINDS.some((p) => topic.startsWith(p));

const ONBOARDING_SYSTEM = [
  "You are the warm, concise onboarding host for a grocery + cooking app. Your job is to learn the",
  "user's food world through a short, friendly chat so the app can plan meals, build lists, and",
  "suggest recipes that fit them.",
  "",
  "RULES:",
  "- Ask EXACTLY ONE high-signal question per turn. Never stack multiple questions.",
  "- ADAPT each question to what they've already said — do NOT recite a fixed checklist, and never",
  "  re-ask something already answered. Move through the useful ground: diet, allergies, cuisines",
  "  they love (or avoid), favorite/disliked ingredients, cooking habits + household size, budget,",
  "  and goals — but follow the conversation naturally.",
  "- Keep `reply` SHORT and mobile-friendly (1–2 sentences, warm, plain text — no markdown, no",
  "  bullet lists). End a question turn with your single question.",
  "- For each QUESTION turn, also return `options`: 3–6 SHORT (1–3 words) suggested quick answers to",
  "  YOUR question, shown as tappable chips (the user can also type their own). Make them concrete and",
  "  relevant to what you just asked — e.g. for diet: 'I eat everything','Vegetarian','Vegan','Pescatarian';",
  "  for cuisines: 'Italian','Thai','Mexican','Indian'. Do NOT include 'Other' or 'Skip'. On a wrap-up",
  "  (`done`) turn, return an empty `options` array (no question, no chips).",
  "- From the user's LATEST answer, infer + extract food preferences into `signals` using these EXACT",
  "  topic conventions (lowercase, hyphenated slugs — generic terms, never brands or sentences).",
  "  IMPORTANT: `polarity` says whether the preference APPLIES to the user, NOT whether it's a like vs.",
  "  dislike — a diet they follow, an allergy they have, and a quality they want are all 'positive'.",
  "  Use 'negative' ONLY for a cuisine/ingredient they actively dislike or avoid:",
  "    • diets they follow      -> topic 'diet:<slug>'        polarity 'positive'  (e.g. diet:vegetarian)",
  "    • allergies/intolerances -> topic 'allergen:<slug>'    polarity 'positive'  (e.g. allergen:peanut)",
  "    • cuisines they LOVE     -> topic 'cuisine:<slug>'     polarity 'positive'  (e.g. cuisine:thai)",
  "    • cuisines they DISLIKE  -> topic 'cuisine:<slug>'     polarity 'negative'",
  "    • ingredients they LOVE  -> topic 'ingredient:<slug>'  polarity 'positive'  (e.g. ingredient:salmon)",
  "    • ingredients they avoid -> topic 'ingredient:<slug>'  polarity 'negative'  (e.g. ingredient:cilantro)",
  "    • quality preferences    -> topic 'quality:<slug>'     polarity 'positive'  (e.g. quality:organic)",
  "  Set `value` to the slug. `confidence` is 0..1 (clearly stated ~0.9; merely implied ~0.5). Only",
  "  emit signals you're reasonably sure of; emit an empty array if the latest answer carries none",
  "  (e.g. a household-size or budget answer — those aren't preferences). NEVER invent a preference.",
  "  Do NOT emit any topic outside the kinds above.",
  "- After about 5–7 useful exchanges, OR as soon as you have a solid picture, set `done` to true,",
  "  give a brief friendly wrap-up in `reply` (acknowledge what you learned), and ask NO further",
  "  question. Otherwise keep `done` false.",
].join("\n");

function renderTranscript(messages: OnboardingMessage[]): string {
  // Plain, role-labeled transcript. generateStructured takes a single prompt string, so we fold the
  // turns into one block (the system prompt carries the behavior; this carries the conversation).
  const lines = messages
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .map((m) => `${m.role === "assistant" ? "Host" : "User"}: ${m.content.trim()}`);
  const body = lines.length ? lines.join("\n") : "(no messages yet — open the conversation)";
  return (
    `Conversation so far:\n${body}\n\n` +
    "Produce the next turn: your single adaptive question (or a wrap-up if you have enough), 3–6 short " +
    "tappable `options` for that question (empty if wrapping up), plus any preferences extracted from " +
    "the user's most recent answer as typed signals."
  );
}

/** Clean the model's suggested chips: trim, drop blanks/over-long, de-dupe (case-insensitive), cap at 6. */
function cleanOptions(options: string[] | undefined): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of options ?? []) {
    if (typeof raw !== "string") continue;
    const opt = raw.trim();
    if (!opt || opt.length > 40) continue;
    const k = opt.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(opt);
    if (out.length >= 6) break;
  }
  return out;
}

/**
 * Run ONE adaptive onboarding turn. Calls `generateStructured` (Zod `OnboardingTurnSchema`) at the
 * cheap tier with the host system prompt, then re-validates the emitted signals: lowercases topics,
 * clamps confidence, and DROPS any signal whose topic isn't one of the allowed UserModel kinds (so
 * only signals that actually move the projection survive). Returns the cleaned turn.
 */
export async function nextOnboardingTurn(
  client: GeminiClient,
  messages: OnboardingMessage[],
): Promise<OnboardingTurn> {
  const res = await client.generateStructured(OnboardingTurnSchema, renderTranscript(messages), {
    tier: "cheap",
    system: ONBOARDING_SYSTEM,
  });

  const signals = (res.signals ?? [])
    .map((s) => ({ ...s, topic: (s.topic ?? "").trim().toLowerCase() }))
    .filter((s) => isAllowedTopic(s.topic)) // keep only topics the projection understands
    .map((s) => ({
      topic: s.topic,
      value: s.value ? s.value.trim().toLowerCase() : null,
      // Facts-about-the-user (diet/allergen/quality) must be "positive" or the projection drops them.
      polarity: isForcePositive(s.topic) ? ("positive" as const) : s.polarity,
      confidence: clamp01(s.confidence),
    }));

  // No chips on a wrap-up turn (there's no question to suggest answers for).
  const options = res.done ? [] : cleanOptions(res.options);

  return { reply: res.reply, done: res.done, options, signals };
}
