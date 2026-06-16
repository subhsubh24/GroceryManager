/**
 * Batch-cook / meal-prep friendliness (PLAN §10 "cook once, eat 3×"). Pure + tested.
 *
 * TheMealDB has no yield/servings, so we infer how well a dish keeps & reheats from its title and
 * method: stews, soups, curries, casseroles, braises, and sauces batch beautifully; salads, fried,
 * seared, and "serve immediately" dishes don't. Title signals weigh more than body signals. The
 * resulting batchScore feeds rankRecipes' batch-cook mode (§7.2).
 */
export interface BatchInput {
  title: string;
  instructions?: string | null;
  cuisine?: string | null;
}

export interface BatchEstimate {
  batchScore: number; // 0..1, higher = keeps/reheats/scales better
  batchFriendly: boolean;
  reason: string;
}

const POSITIVE = [
  "stew", "soup", "chili", "chilli", "curry", "casserole", "bake", "baked", "roast", "braise",
  "braised", "sauce", "ragu", "ragout", "bolognese", "lasagna", "lasagne", "dal", "dahl", "lentil",
  "bean", "chickpea", "stock", "broth", "pilaf", "biryani", "paella", "gumbo", "tagine", "goulash",
  "chowder", "marinara", "gravy", "pulled", "brisket", "slow cook", "slow-cook", "pressure",
  "congee", "porridge", "meal prep", "make ahead", "make-ahead", "freeze", "batch",
];
const NEGATIVE = [
  "salad", "fried", "deep fry", "deep-fried", "seared", "sandwich", "toast", "serve immediately",
  "best fresh", "served fresh", "omelette", "omelet", "souffle", "soufflé", "smoothie",
  "guacamole", "ceviche", "sashimi", "sushi", "crispy", "bruschetta",
];

const hits = (hay: string, words: string[]) => words.filter((w) => hay.includes(w));
const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

export function estimateBatchFriendly(input: BatchInput): BatchEstimate {
  const title = ` ${input.title.toLowerCase()} `;
  const body = ` ${(input.instructions ?? "").toLowerCase()} ${(input.cuisine ?? "").toLowerCase()} `;

  const posTitle = hits(title, POSITIVE);
  const negTitle = hits(title, NEGATIVE);
  const posBody = hits(body, POSITIVE).filter((w) => !title.includes(w));
  const negBody = hits(body, NEGATIVE).filter((w) => !title.includes(w));

  const batchScore = clamp01(
    0.5 +
      0.2 * Math.min(posTitle.length, 2) +
      0.06 * Math.min(posBody.length, 3) -
      0.25 * Math.min(negTitle.length, 2) -
      0.08 * Math.min(negBody.length, 3),
  );

  const reason = posTitle[0]
    ? `keeps & reheats well (${posTitle[0]})`
    : negTitle[0]
      ? `best eaten fresh (${negTitle[0]})`
      : posBody[0]
        ? `scales for leftovers (${posBody[0]})`
        : "average for leftovers";

  return { batchScore, batchFriendly: batchScore >= 0.6, reason };
}
