/**
 * Personalization (PLAN §8.7) — project a typed UserModel from the append-only PreferenceSignal
 * ledger. Pure + testable: it accumulates *evidence* (signed, confidence-weighted) per topic and
 * classifies, so the model never assumes — it compounds. Behavior→signal helpers feed the ledger.
 *
 * Topic convention: "diet:vegan", "allergen:peanut", "cuisine:thai", "ingredient:cilantro",
 * "quality:organic", and the profile facts "profile:name", "profile:age", "profile:gender"
 * (carried as the signal's `value`; latest-wins by confidence so a profile edit overrides).
 */
export type SignalPolarity = "positive" | "negative" | "neutral";

export interface PreferenceSignalInput {
  topic: string;
  value?: string | null;
  polarity: SignalPolarity;
  confidence: number;
}

export interface UserModelProjection {
  // Profile facts (single-valued; projected from profile:* signals, latest/most-confident wins).
  name?: string;
  ageYears?: number;
  gender?: string;
  diets: string[];
  allergens: string[];
  loves: string[];
  dislikes: string[];
  cuisineAffinity: Record<string, number>; // -1..1
  qualityPrefs: Record<string, boolean>; // e.g. { organic: true }
  confidencePerField: Record<string, number>; // 0..1 per topic
}

/** Profile topics carry their fact as the signal `value`; they're resolved most-confident-wins. */
const PROFILE_TOPICS = ["profile:name", "profile:age", "profile:gender"] as const;

const sign = (p: SignalPolarity) => (p === "positive" ? 1 : p === "negative" ? -1 : 0);

function splitTopic(topic: string): { kind: string; key: string } {
  const i = topic.indexOf(":");
  return i < 0 ? { kind: topic, key: "" } : { kind: topic.slice(0, i), key: topic.slice(i + 1) };
}

export function projectUserModel(signals: PreferenceSignalInput[]): UserModelProjection {
  const net = new Map<string, number>();
  // Profile facts are single-valued: keep the highest-confidence value seen per topic so a later
  // profile edit (appended at higher confidence) overrides the original onboarding/signup signal.
  const profile = new Map<string, { value: string; confidence: number }>();
  for (const s of signals) {
    if ((PROFILE_TOPICS as readonly string[]).includes(s.topic)) {
      const v = (s.value ?? "").trim();
      if (!v) continue;
      const prev = profile.get(s.topic);
      if (!prev || s.confidence >= prev.confidence) profile.set(s.topic, { value: v, confidence: s.confidence });
      continue;
    }
    net.set(s.topic, (net.get(s.topic) ?? 0) + sign(s.polarity) * s.confidence);
  }

  const m: UserModelProjection = {
    diets: [],
    allergens: [],
    loves: [],
    dislikes: [],
    cuisineAffinity: {},
    qualityPrefs: {},
    confidencePerField: {},
  };

  const nameSig = profile.get("profile:name");
  if (nameSig) {
    m.name = nameSig.value;
    m.confidencePerField["profile:name"] = Math.min(1, nameSig.confidence);
  }
  const ageSig = profile.get("profile:age");
  if (ageSig) {
    const age = Number(ageSig.value);
    if (Number.isFinite(age) && age > 0) {
      m.ageYears = age;
      m.confidencePerField["profile:age"] = Math.min(1, ageSig.confidence);
    }
  }
  const genderSig = profile.get("profile:gender");
  if (genderSig) {
    m.gender = genderSig.value;
    m.confidencePerField["profile:gender"] = Math.min(1, genderSig.confidence);
  }

  for (const [topic, n] of net) {
    const { kind, key } = splitTopic(topic);
    m.confidencePerField[topic] = Math.min(1, Math.abs(n));
    switch (kind) {
      case "diet":
        if (n > 0) m.diets.push(key);
        break;
      case "allergen":
        if (n > 0) m.allergens.push(key);
        break;
      case "cuisine": {
        const a = Math.tanh(n);
        m.cuisineAffinity[key] = a;
        if (a > 0.3) m.loves.push(`cuisine:${key}`);
        else if (a < -0.3) m.dislikes.push(`cuisine:${key}`);
        break;
      }
      case "ingredient":
        if (n > 0.3) m.loves.push(key);
        else if (n < -0.3) m.dislikes.push(key);
        break;
      case "quality":
        if (n > 0) m.qualityPrefs[key] = true;
        break;
      default:
        break;
    }
  }

  m.diets.sort();
  m.allergens.sort();
  m.loves.sort();
  m.dislikes.sort();
  return m;
}

// ---- behavior → signal helpers (what the agent/loops append) ----
export const signalFromOnboardingDiet = (diet: string): PreferenceSignalInput => ({
  topic: `diet:${diet}`,
  value: diet,
  polarity: "positive",
  confidence: 0.9,
});
export const signalFromAllergen = (a: string): PreferenceSignalInput => ({
  topic: `allergen:${a}`,
  value: a,
  polarity: "positive",
  confidence: 0.95,
});
export const signalFromCooked = (cuisine: string): PreferenceSignalInput => ({
  topic: `cuisine:${cuisine}`,
  value: cuisine,
  polarity: "positive",
  confidence: 0.2,
});
export const signalFromSkip = (cuisine: string): PreferenceSignalInput => ({
  topic: `cuisine:${cuisine}`,
  value: cuisine,
  polarity: "negative",
  confidence: 0.15,
});
export const signalFromWaste = (ingredientKey: string): PreferenceSignalInput => ({
  topic: `ingredient:${ingredientKey}`,
  value: ingredientKey,
  polarity: "negative",
  confidence: 0.3,
});
export const signalFromReorder = (ingredientKey: string): PreferenceSignalInput => ({
  topic: `ingredient:${ingredientKey}`,
  value: ingredientKey,
  polarity: "positive",
  confidence: 0.25,
});

// ---- profile facts → signals (name / age / gender live in the semantic layer too) ----
/** Profile facts are stated directly by the user. `confidence` lets a later edit override an
 * earlier value (signup uses 0.9; a profile edit uses ~0.99). Polarity is neutral — these are
 * facts, not preferences. */
export const signalFromProfileName = (name: string, confidence = 0.9): PreferenceSignalInput => ({
  topic: "profile:name",
  value: name,
  polarity: "neutral",
  confidence,
});
export const signalFromProfileAge = (ageYears: number, confidence = 0.9): PreferenceSignalInput => ({
  topic: "profile:age",
  value: String(ageYears),
  polarity: "neutral",
  confidence,
});
export const signalFromProfileGender = (gender: string, confidence = 0.9): PreferenceSignalInput => ({
  topic: "profile:gender",
  value: gender,
  polarity: "neutral",
  confidence,
});
