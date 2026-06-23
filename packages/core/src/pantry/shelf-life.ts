/**
 * Shelf-life + domain heuristic for a newly-created canonical item (PLAN §6 spoilage ceiling).
 *
 * New items created during ingestion (a receipt line we've never seen) start with no perishability
 * or shelf-life, so the depletion engine's spoilage ceiling can never fire — a perishable bought 5
 * months ago would still read "in stock". This gives every new item a sensible default from its
 * name, so "what's left today" is reasonable right after a backfill. It's a fast keyword heuristic
 * (no LLM, no key, cached once on the row); an LLM refinement at create-time is a clean future upgrade.
 *
 * Pure + tested. Returns the domain (so household/personal-care/supplement items route to the right
 * vertical) plus perishability and a fridge/pantry shelf life. Convention used by the projector:
 * `shelf_stable` never spoils (it depletes only by consumption rate); everything else spoils once it
 * passes its shelf life. Days are rough FoodKeeper-style ballparks — confidence, not precision.
 */

export type Perishability = "perishable" | "semi_perishable" | "shelf_stable";
export type ItemDomain = "grocery" | "household" | "personal_care" | "supplement";

export interface ShelfLifeEstimate {
  domain: ItemDomain;
  perishability: Perishability;
  shelfLifeFridgeDays: number | null;
  shelfLifePantryDays: number | null;
}

/** First rule whose any-keyword matches wins, so order = priority (specific → general). */
interface Rule extends ShelfLifeEstimate {
  keywords: string[];
}

const RULES: Rule[] = [
  // ── Non-grocery verticals — these DEPLETE by use, they don't spoil (shelf_stable, no ceiling). ──
  {
    keywords: ["vitamin", "supplement", "probiotic", "omega", "fish oil", "magnesium", "creatine", "protein powder", "collagen", "melatonin"],
    domain: "supplement",
    perishability: "shelf_stable",
    shelfLifeFridgeDays: null,
    shelfLifePantryDays: 730,
  },
  {
    keywords: [
      "shampoo", "conditioner", "soap", "body wash", "toothpaste", "deodorant", "lotion", "moisturizer",
      "sunscreen", "razor", "shave", "floss", "makeup", "cosmetic", "skincare", "serum", "cleanser",
      "tampon", " pads ", "heating pad", "nursing pad", "breast pad", "cotton pad", "diaper", "wipe",
    ],
    domain: "personal_care",
    perishability: "shelf_stable",
    shelfLifeFridgeDays: null,
    shelfLifePantryDays: null,
  },
  {
    keywords: [
      "detergent", "cleaner", "bleach", "disinfect", "sanitizer", "paper towel", "toilet paper", "tissue",
      "napkin", "trash bag", "garbage bag", "dish soap", "dishwasher", "laundry", "sponge", "foil",
      "plastic wrap", "ziploc", " battery ", " batteries ", "light bulb",
    ],
    domain: "household",
    perishability: "shelf_stable",
    shelfLifeFridgeDays: null,
    shelfLifePantryDays: null,
  },

  // ── Perishable groceries — spoil after a short fridge life. ──
  {
    keywords: ["chicken", "beef", "pork", "turkey", "lamb", "bacon", "sausage", "ground meat", "steak", "fish", "salmon", "tuna", "shrimp", "seafood", "cod", "tilapia"],
    domain: "grocery",
    perishability: "perishable",
    shelfLifeFridgeDays: 3,
    shelfLifePantryDays: null,
  },
  {
    keywords: ["milk", "cream", "yogurt", "yoghurt", "kefir", "half and half"],
    domain: "grocery",
    perishability: "perishable",
    shelfLifeFridgeDays: 12,
    shelfLifePantryDays: null,
  },
  {
    keywords: ["egg"],
    domain: "grocery",
    perishability: "perishable",
    shelfLifeFridgeDays: 28,
    shelfLifePantryDays: null,
  },
  {
    keywords: ["cheese", "tofu", "hummus", "deli", "guacamole"],
    domain: "grocery",
    perishability: "semi_perishable",
    shelfLifeFridgeDays: 21,
    shelfLifePantryDays: null,
  },
  {
    // Leafy + soft + ripening produce — short-lived.
    keywords: ["lettuce", "spinach", "kale", "arugula", "herb", "basil", "cilantro", "parsley", "mint", "berry", "strawberr", "raspberr", "blueberr", "blackberr", "avocado", "banana", "tomato", "mushroom", "cucumber", "broccoli", "asparagus", "grape", "peach", "mango", "spring mix", "salad"],
    domain: "grocery",
    perishability: "perishable",
    shelfLifeFridgeDays: 6,
    shelfLifePantryDays: null,
  },
  {
    // Hardy produce — keeps for weeks.
    keywords: ["apple", "orange", "lemon", "lime", "carrot", "potato", "onion", "garlic", "cabbage", "squash", "beet", "celery", "pepper", "ginger", "citrus"],
    domain: "grocery",
    perishability: "perishable",
    shelfLifeFridgeDays: 21,
    shelfLifePantryDays: null,
  },
  {
    keywords: ["bread", "bagel", "tortilla", "bun", "muffin", "croissant", "cake", "pastry", "roll"],
    domain: "grocery",
    perishability: "perishable",
    shelfLifeFridgeDays: null,
    shelfLifePantryDays: 6,
  },

  // ── Shelf-stable groceries — don't spoil on a normal timescale; deplete by use. ──
  {
    keywords: ["frozen", "ice cream"],
    domain: "grocery",
    perishability: "shelf_stable",
    shelfLifeFridgeDays: null,
    shelfLifePantryDays: 180,
  },
  {
    keywords: ["canned", " can ", "jar", "soup", "broth", "sauce", "salsa", "condiment", "ketchup", "mustard", "mayo", "oil", "vinegar", "honey", "syrup", "peanut butter", "jam", "jelly"],
    domain: "grocery",
    perishability: "shelf_stable",
    shelfLifeFridgeDays: null,
    shelfLifePantryDays: 540,
  },
  {
    keywords: ["rice", "pasta", "flour", "sugar", "cereal", "oat", "bean", "lentil", "nut", "coffee", "tea", "chip", "cracker", "cookie", "spice", "salt", "pepper corn", "quinoa", "granola", "snack"],
    domain: "grocery",
    perishability: "shelf_stable",
    shelfLifeFridgeDays: null,
    shelfLifePantryDays: 365,
  },
  {
    keywords: ["soda", "juice", "water", "seltzer", "kombucha", "drink", "beer", "wine"],
    domain: "grocery",
    perishability: "semi_perishable",
    shelfLifeFridgeDays: null,
    shelfLifePantryDays: 180,
  },
];

// Unknown grocery: assume it's a perishable-ish food so a months-old backfill doesn't read "in stock"
// forever, but give it a generous window so recent buys stay. (Tuned: ~3 months.)
const DEFAULT: ShelfLifeEstimate = {
  domain: "grocery",
  perishability: "semi_perishable",
  shelfLifeFridgeDays: null,
  shelfLifePantryDays: 90,
};

/**
 * Match the keyword rules; returns null when NOTHING matches (an unknown item). The null is the useful
 * signal: a known food gets an instant, free estimate, while an unknown one is exactly where the LLM
 * estimator earns its keep (instead of falling back to the generic 90-day default).
 */
export function matchShelfLifeRule(name: string): ShelfLifeEstimate | null {
  const n = ` ${name.toLowerCase()} `;
  for (const rule of RULES) {
    if (rule.keywords.some((k) => n.includes(k))) {
      const { keywords: _k, ...estimate } = rule;
      return estimate;
    }
  }
  return null;
}

export function estimateShelfLife(name: string): ShelfLifeEstimate {
  return matchShelfLifeRule(name) ?? DEFAULT;
}
