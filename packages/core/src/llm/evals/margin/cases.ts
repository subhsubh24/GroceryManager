/**
 * Margin cost-per-outcome eval matrix for the `grocerymanager-plan-week` workflow.
 *
 * A REAL, representative input matrix — varied pantries × dietary prefs/constraints × target dinner
 * counts × household sizes, including deliberately HARD cases (sparse pantry, everything-expiring,
 * conflicting constraints). Each case is a genuine `PlanWeekInput` fed through the REAL metered path
 * (`planWeek` + `geminiPlanGenerator`) and graded by the REAL evaluator (`evaluateWeekPlan`) — so the
 * economics Margin measures (tokens + latency per graded, passing weekly plan) reflect real usage,
 * not a toy. The matrix is data-only + deterministic so it can be reviewed and can't silently drift.
 *
 * Honesty notes:
 *  - The grader is `evaluateWeekPlan` (agent/evaluate.ts) unchanged — it scores the STRUCTURAL rubric
 *    (valid/known picks, target count, variety, pantry coverage, expiring-first, no invented buys,
 *    narrative). It does NOT verify diet/allergen compliance; diet/allergen prefs here exercise the
 *    model's selection + narrative, and the candidate pools are pre-filtered as the app's §7.2 matcher
 *    would deliver. Diet-compliance grading is a documented gap (see README), not silently faked.
 *  - "Household size" is not a `PlanWeekInput` field; it manifests through `targetDinners` and budget,
 *    and is recorded in `household` for reporting/variety only.
 */
import type { PlanWeekInput } from "../../../agent/plan-week.js";
import type { PlanCandidate } from "../../../agent/evaluate.js";

/** One eval case: a named, tagged `PlanWeekInput` plus reporting metadata. */
export interface PlanWeekEvalCase {
  name: string;
  /** Freeform household descriptor (for the report + variety assertions; not fed to the model). */
  household: string;
  /** Coarse tags for variety coverage (diet, allergen, sparse, expiring, budget, ...). */
  tags: string[];
  input: PlanWeekInput;
}

/** Compact candidate builder — `coverage` 0..1, `missing` = core ingredients not on hand. */
function r(
  id: string,
  title: string,
  cuisine: string,
  coverage: number,
  missing: string[],
  usesExpiring = 0,
  expiringIngredients: string[] = [],
): PlanCandidate {
  return { id, title, coverage, missing, usesExpiring, expiringIngredients, cuisine };
}

/**
 * A pool of realistic candidate recipes (as the §7.2 matcher would rank + hand the planner). Cases
 * draw subsets so the matrix reuses genuine, coherent recipes rather than throwaway ids.
 */
const POOL = {
  // omnivore
  chickenTraybake: r("chk-traybake", "Sheet-pan chicken & veg", "american", 0.85, ["lemon"], 1, ["chicken thighs"]),
  beefStirFry: r("beef-stirfry", "Beef & broccoli stir-fry", "chinese", 0.7, ["oyster sauce"], 1, ["beef strips"]),
  porkTacos: r("pork-tacos", "Pulled-pork tacos", "mexican", 0.6, ["tortillas", "lime"]),
  sausagePasta: r("sausage-pasta", "Sausage & tomato pasta", "italian", 0.9, [], 1, ["sausages"]),
  chickenCurry: r("chk-curry", "Weeknight chicken curry", "indian", 0.75, ["coconut milk"], 1, ["chicken thighs"]),
  meatballs: r("meatballs", "Baked turkey meatballs", "italian", 0.8, ["breadcrumbs"]),
  steakSalad: r("steak-salad", "Seared steak salad", "american", 0.65, ["blue cheese"], 1, ["steak"]),
  // vegetarian
  veggieChili: r("veg-chili", "Three-bean veggie chili", "mexican", 0.9, [], 1, ["bell peppers"]),
  paneerMasala: r("paneer", "Paneer tikka masala", "indian", 0.7, ["paneer", "cream"]),
  margheritaFlat: r("marg-flat", "Margherita flatbread", "italian", 0.85, ["mozzarella"], 1, ["basil"]),
  halloumiBowl: r("halloumi", "Halloumi grain bowl", "mediterranean", 0.6, ["halloumi", "couscous"]),
  mushroomRisotto: r("mush-risotto", "Mushroom risotto", "italian", 0.7, ["arborio rice"], 1, ["mushrooms"]),
  eggFriedRice: r("egg-rice", "Egg fried rice", "chinese", 0.95, [], 1, ["scallions"]),
  caprese: r("caprese-orzo", "Caprese orzo", "italian", 0.75, ["orzo"], 1, ["tomatoes"]),
  // vegan
  tofuStirFry: r("tofu-stirfry", "Ginger tofu stir-fry", "chinese", 0.8, ["firm tofu"], 1, ["bok choy"]),
  chickpeaCurry: r("chana", "Chana masala", "indian", 0.9, [], 1, ["spinach"]),
  lentilSoup: r("lentil-soup", "Red lentil soup", "mediterranean", 0.95, []),
  blackBeanTacos: r("bb-tacos", "Black-bean tacos", "mexican", 0.7, ["tortillas"], 1, ["avocado"]),
  peanutNoodles: r("peanut-noodles", "Peanut sesame noodles", "thai", 0.7, ["peanut butter"]),
  falafelBowl: r("falafel", "Falafel & tahini bowl", "mediterranean", 0.6, ["tahini", "pita"]),
  // pescatarian
  salmonTraybake: r("salmon", "Miso salmon traybake", "japanese", 0.7, ["miso"], 1, ["salmon"]),
  shrimpScampi: r("shrimp-scampi", "Shrimp scampi", "italian", 0.65, ["shrimp"], 1, ["parsley"]),
  tunaMelt: r("tuna-melt", "Tuna melt & salad", "american", 0.9, []),
  fishTacos: r("fish-tacos", "Cod fish tacos", "mexican", 0.6, ["cod", "cabbage"]),
  // gluten-free / low-carb
  zucchiniNoodles: r("zoodles", "Zucchini noodles & pesto", "italian", 0.75, ["pine nuts"], 1, ["zucchini"]),
  cauliRice: r("cauli-rice", "Cauliflower fried rice", "chinese", 0.8, [], 1, ["cauliflower"]),
  cobbSalad: r("cobb", "Chicken cobb salad", "american", 0.7, ["avocado"], 1, ["eggs"]),
  greekBowl: r("greek-bowl", "Greek chicken bowl", "mediterranean", 0.85, []),
} as const;

const NO_PREFS = { diets: [] as string[], allergens: [] as string[], dislikes: [] as string[] };

/** Merge helper: a case with sensible defaults (nothing expiring, no budget, target 5). */
function mk(
  name: string,
  household: string,
  tags: string[],
  candidates: PlanCandidate[],
  over: Partial<PlanWeekInput> = {},
): PlanWeekEvalCase {
  return {
    name,
    household,
    tags,
    input: {
      candidates,
      expiringNames: [],
      prefs: { ...NO_PREFS },
      budgetCents: null,
      targetDinners: 5,
      ...over,
    },
  };
}

const P = POOL;

/**
 * The eval matrix. ~50 cases spanning household sizes, diets, allergens, budgets, target counts, and
 * hard edges. Order groups by theme for readability; the runner may shuffle/cap.
 */
export const PLAN_WEEK_EVAL_CASES: PlanWeekEvalCase[] = [
  // ── Rich omnivore pantry, varying target counts / household sizes ──────────────────────────────
  mk("omni-couple-5", "2 adults", ["omnivore", "rich", "expiring"],
    [P.chickenTraybake, P.beefStirFry, P.sausagePasta, P.chickenCurry, P.meatballs, P.porkTacos, P.steakSalad],
    { targetDinners: 5, expiringNames: ["chicken thighs", "beef strips"] }),
  mk("omni-family-7", "2 adults + 3 kids", ["omnivore", "rich", "large-household"],
    [P.chickenTraybake, P.sausagePasta, P.meatballs, P.chickenCurry, P.porkTacos, P.beefStirFry, P.steakSalad, P.eggFriedRice],
    { targetDinners: 7, budgetCents: 12000 }),
  mk("omni-single-3", "1 adult", ["omnivore", "single", "small-batch"],
    [P.sausagePasta, P.chickenCurry, P.tunaMelt, P.eggFriedRice, P.meatballs],
    { targetDinners: 3 }),
  mk("omni-couple-budget", "2 adults", ["omnivore", "budget-tight"],
    [P.sausagePasta, P.eggFriedRice, P.veggieChili, P.lentilSoup, P.chickenCurry, P.meatballs],
    { targetDinners: 5, budgetCents: 4000 }),
  mk("omni-generous-6", "3 adults", ["omnivore", "budget-generous"],
    [P.steakSalad, P.chickenTraybake, P.beefStirFry, P.porkTacos, P.chickenCurry, P.salmonTraybake, P.meatballs],
    { targetDinners: 6, budgetCents: 20000 }),

  // ── Vegetarian ────────────────────────────────────────────────────────────────────────────────
  mk("veg-couple-5", "2 adults", ["vegetarian", "rich"],
    [P.veggieChili, P.paneerMasala, P.margheritaFlat, P.mushroomRisotto, P.eggFriedRice, P.halloumiBowl, P.caprese],
    { targetDinners: 5, prefs: { ...NO_PREFS, diets: ["vegetarian"] } }),
  mk("veg-family-6-expiring", "2 adults + 2 kids", ["vegetarian", "expiring", "large-household"],
    [P.veggieChili, P.margheritaFlat, P.mushroomRisotto, P.eggFriedRice, P.caprese, P.paneerMasala],
    { targetDinners: 6, expiringNames: ["bell peppers", "mushrooms", "basil", "tomatoes"],
      prefs: { ...NO_PREFS, diets: ["vegetarian"] } }),
  mk("veg-single-lowenergy", "1 adult", ["vegetarian", "single", "low-energy"],
    [P.lentilSoup, P.eggFriedRice, P.caprese, P.margheritaFlat],
    { targetDinners: 3, lowEnergy: true, prefs: { ...NO_PREFS, diets: ["vegetarian"] } }),
  mk("veg-dislikes", "2 adults", ["vegetarian", "dislikes"],
    [P.veggieChili, P.paneerMasala, P.mushroomRisotto, P.halloumiBowl, P.margheritaFlat, P.caprese],
    { targetDinners: 5, prefs: { diets: ["vegetarian"], allergens: [], dislikes: ["mushrooms", "olives"] } }),

  // ── Vegan ─────────────────────────────────────────────────────────────────────────────────────
  mk("vegan-couple-5", "2 adults", ["vegan", "rich"],
    [P.tofuStirFry, P.chickpeaCurry, P.lentilSoup, P.blackBeanTacos, P.peanutNoodles, P.falafelBowl],
    { targetDinners: 5, prefs: { ...NO_PREFS, diets: ["vegan"] } }),
  mk("vegan-family-6-expiring", "2 adults + 3 kids", ["vegan", "expiring", "large-household"],
    [P.tofuStirFry, P.chickpeaCurry, P.lentilSoup, P.blackBeanTacos, P.falafelBowl, P.cauliRice],
    { targetDinners: 6, expiringNames: ["bok choy", "spinach", "avocado"],
      prefs: { ...NO_PREFS, diets: ["vegan"] } }),
  mk("vegan-budget-single", "1 adult", ["vegan", "single", "budget-tight"],
    [P.lentilSoup, P.chickpeaCurry, P.blackBeanTacos],
    { targetDinners: 3, budgetCents: 2500, prefs: { ...NO_PREFS, diets: ["vegan"] } }),
  mk("vegan-nut-allergy", "2 adults", ["vegan", "allergen-nuts", "conflicting"],
    [P.tofuStirFry, P.chickpeaCurry, P.lentilSoup, P.blackBeanTacos, P.falafelBowl, P.cauliRice],
    { targetDinners: 5, prefs: { diets: ["vegan"], allergens: ["peanuts", "tree nuts"], dislikes: [] } }),

  // ── Pescatarian ───────────────────────────────────────────────────────────────────────────────
  mk("pesc-couple-5", "2 adults", ["pescatarian", "expiring"],
    [P.salmonTraybake, P.shrimpScampi, P.tunaMelt, P.fishTacos, P.eggFriedRice, P.caprese],
    { targetDinners: 5, expiringNames: ["salmon"], prefs: { ...NO_PREFS, diets: ["pescatarian"] } }),
  mk("pesc-shellfish-allergy", "2 adults", ["pescatarian", "allergen-shellfish", "conflicting"],
    [P.salmonTraybake, P.tunaMelt, P.fishTacos, P.eggFriedRice, P.lentilSoup],
    { targetDinners: 4, prefs: { diets: ["pescatarian"], allergens: ["shellfish"], dislikes: [] } }),
  mk("pesc-single-4", "1 adult", ["pescatarian", "single"],
    [P.salmonTraybake, P.tunaMelt, P.fishTacos, P.eggFriedRice],
    { targetDinners: 4, prefs: { ...NO_PREFS, diets: ["pescatarian"] } }),

  // ── Gluten-free & low-carb / keto ─────────────────────────────────────────────────────────────
  mk("gf-couple-5", "2 adults", ["gluten-free", "rich"],
    [P.zucchiniNoodles, P.cauliRice, P.cobbSalad, P.greekBowl, P.chickenTraybake, P.salmonTraybake],
    { targetDinners: 5, prefs: { diets: ["gluten-free"], allergens: [], dislikes: [] } }),
  mk("lowcarb-couple-5", "2 adults", ["keto", "low-carb"],
    [P.zucchiniNoodles, P.cauliRice, P.cobbSalad, P.greekBowl, P.steakSalad, P.salmonTraybake],
    { targetDinners: 5, prefs: { diets: ["keto"], allergens: [], dislikes: [] } }),
  mk("gf-family-6", "2 adults + 2 kids", ["gluten-free", "large-household"],
    [P.zucchiniNoodles, P.cauliRice, P.cobbSalad, P.greekBowl, P.chickenTraybake, P.salmonTraybake, P.eggFriedRice],
    { targetDinners: 6, budgetCents: 11000, prefs: { diets: ["gluten-free"], allergens: [], dislikes: [] } }),

  // ── Allergen constraints (dairy / egg / soy) ──────────────────────────────────────────────────
  mk("dairy-free-5", "2 adults", ["allergen-dairy"],
    [P.chickpeaCurry, P.blackBeanTacos, P.porkTacos, P.chickenCurry, P.lentilSoup, P.fishTacos],
    { targetDinners: 5, prefs: { diets: [], allergens: ["dairy"], dislikes: [] } }),
  mk("egg-free-single", "1 adult", ["allergen-egg", "single"],
    [P.chickenCurry, P.sausagePasta, P.lentilSoup, P.porkTacos],
    { targetDinners: 3, prefs: { diets: [], allergens: ["egg"], dislikes: [] } }),
  mk("soy-free-couple", "2 adults", ["allergen-soy"],
    [P.chickenTraybake, P.meatballs, P.veggieChili, P.greekBowl, P.chickenCurry, P.porkTacos],
    { targetDinners: 5, prefs: { diets: [], allergens: ["soy"], dislikes: [] } }),
  mk("multi-allergen-4", "2 adults", ["allergen-nuts", "allergen-dairy", "conflicting"],
    [P.chickpeaCurry, P.blackBeanTacos, P.lentilSoup, P.porkTacos, P.chickenCurry],
    { targetDinners: 4, prefs: { diets: [], allergens: ["tree nuts", "dairy"], dislikes: [] } }),

  // ── Dislikes-heavy (advisory constraints thin the field) ──────────────────────────────────────
  mk("picky-eaters-family", "2 adults + 2 kids", ["dislikes", "large-household"],
    [P.sausagePasta, P.meatballs, P.chickenTraybake, P.eggFriedRice, P.margheritaFlat, P.chickenCurry, P.porkTacos],
    { targetDinners: 6, prefs: { diets: [], allergens: [], dislikes: ["fish", "mushrooms", "spicy", "tofu"] } }),
  mk("picky-couple", "2 adults", ["dislikes"],
    [P.chickenTraybake, P.sausagePasta, P.meatballs, P.greekBowl, P.cobbSalad],
    { targetDinners: 5, prefs: { diets: [], allergens: [], dislikes: ["cilantro", "olives", "blue cheese"] } }),

  // ── Everything-expiring (must front-load use-it-up) ───────────────────────────────────────────
  mk("all-expiring-couple", "2 adults", ["expiring-heavy"],
    [P.chickenTraybake, P.beefStirFry, P.sausagePasta, P.chickenCurry, P.salmonTraybake, P.mushroomRisotto],
    { targetDinners: 5, expiringNames: ["chicken thighs", "beef strips", "sausages", "salmon", "mushrooms"] }),
  mk("all-expiring-veg", "2 adults", ["vegetarian", "expiring-heavy"],
    [P.veggieChili, P.margheritaFlat, P.mushroomRisotto, P.eggFriedRice, P.caprese],
    { targetDinners: 4, expiringNames: ["bell peppers", "basil", "mushrooms", "scallions", "tomatoes"],
      prefs: { ...NO_PREFS, diets: ["vegetarian"] } }),
  mk("expiring-vs-target-mismatch", "1 adult", ["expiring-heavy", "single", "hard"],
    [P.eggFriedRice, P.lentilSoup, P.tofuStirFry],
    { targetDinners: 2, expiringNames: ["scallions", "bok choy"] }),

  // ── Sparse pantry: target exceeds available candidates (grader caps want=min(target,#cands)) ───
  mk("sparse-2-of-5", "2 adults", ["sparse", "hard"],
    [P.eggFriedRice, P.lentilSoup],
    { targetDinners: 5 }),
  mk("sparse-3-of-6", "2 adults + 2 kids", ["sparse", "hard", "large-household"],
    [P.sausagePasta, P.chickenCurry, P.eggFriedRice],
    { targetDinners: 6 }),
  mk("sparse-1-of-4", "1 adult", ["sparse", "hard", "single"],
    [P.lentilSoup],
    { targetDinners: 4 }),
  mk("sparse-lowcov", "2 adults", ["sparse", "low-coverage", "hard"],
    [P.falafelBowl, P.halloumiBowl, P.fishTacos],
    { targetDinners: 5 }),
  mk("sparse-vegan-expiring", "1 adult", ["sparse", "vegan", "expiring", "hard"],
    [P.chickpeaCurry, P.blackBeanTacos],
    { targetDinners: 4, expiringNames: ["spinach", "avocado"], prefs: { ...NO_PREFS, diets: ["vegan"] } }),

  // ── Low-energy weeks (favor quick/low-cleanup) ────────────────────────────────────────────────
  mk("low-energy-couple", "2 adults", ["low-energy"],
    [P.eggFriedRice, P.sausagePasta, P.tunaMelt, P.lentilSoup, P.greekBowl, P.caprese],
    { targetDinners: 5, lowEnergy: true }),
  mk("low-energy-family", "2 adults + 2 kids", ["low-energy", "large-household"],
    [P.eggFriedRice, P.sausagePasta, P.meatballs, P.chickenTraybake, P.tunaMelt, P.greekBowl],
    { targetDinners: 6, lowEnergy: true, budgetCents: 9000 }),

  // ── Nothing expiring, plain (coverage-only optimization) ──────────────────────────────────────
  mk("plain-couple-5", "2 adults", ["plain"],
    [P.greekBowl, P.tunaMelt, P.eggFriedRice, P.lentilSoup, P.sausagePasta, P.cobbSalad, P.chickenTraybake],
    { targetDinners: 5 }),
  mk("plain-single-2", "1 adult", ["plain", "single", "small-batch"],
    [P.eggFriedRice, P.lentilSoup, P.tunaMelt],
    { targetDinners: 2 }),

  // ── Conflicting / stacked constraints (the genuinely hard tail) ───────────────────────────────
  mk("vegan-gf-nut-free", "2 adults", ["vegan", "gluten-free", "allergen-nuts", "conflicting", "hard"],
    [P.chickpeaCurry, P.lentilSoup, P.cauliRice, P.tofuStirFry, P.blackBeanTacos],
    { targetDinners: 5, prefs: { diets: ["vegan", "gluten-free"], allergens: ["tree nuts", "peanuts"], dislikes: [] } }),
  mk("pesc-dairy-free-dislikes", "2 adults", ["pescatarian", "allergen-dairy", "dislikes", "conflicting", "hard"],
    [P.salmonTraybake, P.fishTacos, P.tunaMelt, P.lentilSoup, P.eggFriedRice],
    { targetDinners: 4, prefs: { diets: ["pescatarian"], allergens: ["dairy"], dislikes: ["cilantro"] } }),
  mk("keto-family-budget", "2 adults + 2 kids", ["keto", "budget-tight", "large-household", "conflicting", "hard"],
    [P.cobbSalad, P.greekBowl, P.cauliRice, P.zucchiniNoodles, P.steakSalad, P.salmonTraybake],
    { targetDinners: 6, budgetCents: 8000, prefs: { diets: ["keto"], allergens: [], dislikes: ["eggs"] } }),

  // ── Assorted mid-size households to broaden the distribution ───────────────────────────────────
  mk("omni-3adult-4", "3 adults", ["omnivore"],
    [P.chickenTraybake, P.beefStirFry, P.porkTacos, P.meatballs, P.chickenCurry],
    { targetDinners: 4 }),
  mk("veg-flatmates-5", "3 flatmates", ["vegetarian", "budget-tight"],
    [P.veggieChili, P.eggFriedRice, P.margheritaFlat, P.lentilSoup, P.caprese, P.mushroomRisotto],
    { targetDinners: 5, budgetCents: 6000, prefs: { ...NO_PREFS, diets: ["vegetarian"] } }),
  mk("vegan-couple-lowenergy-expiring", "2 adults", ["vegan", "low-energy", "expiring"],
    [P.lentilSoup, P.chickpeaCurry, P.tofuStirFry, P.blackBeanTacos, P.cauliRice],
    { targetDinners: 4, lowEnergy: true, expiringNames: ["bok choy", "spinach"],
      prefs: { ...NO_PREFS, diets: ["vegan"] } }),
  mk("omni-large-7-expiring", "2 adults + 4 kids", ["omnivore", "large-household", "expiring", "budget-tight"],
    [P.sausagePasta, P.chickenTraybake, P.meatballs, P.chickenCurry, P.beefStirFry, P.eggFriedRice, P.porkTacos, P.veggieChili],
    { targetDinners: 7, budgetCents: 13000, expiringNames: ["sausages", "chicken thighs", "beef strips"] }),
  mk("gf-single-lowenergy", "1 adult", ["gluten-free", "single", "low-energy"],
    [P.greekBowl, P.cauliRice, P.cobbSalad, P.salmonTraybake],
    { targetDinners: 3, lowEnergy: true, prefs: { diets: ["gluten-free"], allergens: [], dislikes: [] } }),
  mk("pesc-family-6", "2 adults + 2 kids", ["pescatarian", "large-household"],
    [P.salmonTraybake, P.tunaMelt, P.fishTacos, P.shrimpScampi, P.eggFriedRice, P.caprese, P.lentilSoup],
    { targetDinners: 6, budgetCents: 14000, prefs: { ...NO_PREFS, diets: ["pescatarian"] } }),
  mk("omni-couple-nothing-expiring-tight", "2 adults", ["omnivore", "budget-tight", "plain"],
    [P.eggFriedRice, P.sausagePasta, P.lentilSoup, P.veggieChili, P.chickenCurry, P.meatballs],
    { targetDinners: 5, budgetCents: 3500 }),
];

/** Total case count (exported for the runner + tests). */
export const PLAN_WEEK_EVAL_CASE_COUNT = PLAN_WEEK_EVAL_CASES.length;
