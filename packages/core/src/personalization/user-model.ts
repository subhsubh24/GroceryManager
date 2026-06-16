/**
 * Personalization (PLAN §8.7) — project a typed UserModel from the append-only PreferenceSignal
 * ledger. Pure + testable: it accumulates *evidence* (signed, confidence-weighted) per topic and
 * classifies, so the model never assumes — it compounds. Behavior→signal helpers feed the ledger.
 *
 * Topic convention: "diet:vegan", "allergen:peanut", "cuisine:thai", "ingredient:cilantro",
 * "quality:organic".
 */
export type SignalPolarity = "positive" | "negative" | "neutral";

export interface PreferenceSignalInput {
  topic: string;
  value?: string | null;
  polarity: SignalPolarity;
  confidence: number;
}

export interface UserModelProjection {
  diets: string[];
  allergens: string[];
  loves: string[];
  dislikes: string[];
  cuisineAffinity: Record<string, number>; // -1..1
  qualityPrefs: Record<string, boolean>; // e.g. { organic: true }
  confidencePerField: Record<string, number>; // 0..1 per topic
}

const sign = (p: SignalPolarity) => (p === "positive" ? 1 : p === "negative" ? -1 : 0);

function splitTopic(topic: string): { kind: string; key: string } {
  const i = topic.indexOf(":");
  return i < 0 ? { kind: topic, key: "" } : { kind: topic.slice(0, i), key: topic.slice(i + 1) };
}

export function projectUserModel(signals: PreferenceSignalInput[]): UserModelProjection {
  const net = new Map<string, number>();
  for (const s of signals) net.set(s.topic, (net.get(s.topic) ?? 0) + sign(s.polarity) * s.confidence);

  const m: UserModelProjection = {
    diets: [],
    allergens: [],
    loves: [],
    dislikes: [],
    cuisineAffinity: {},
    qualityPrefs: {},
    confidencePerField: {},
  };

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
