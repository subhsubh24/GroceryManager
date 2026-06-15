/**
 * Seed: global units of measure + a small starter canonical catalog across all three
 * domains (grocery / household / personal_care), with shelf-life (FoodKeeper-style).
 * Idempotent. Run with: pnpm --filter @gm/db db:seed
 */
import { loadEnv } from "@gm/config/env";
import { createDb } from "./client.js";
import { canonicalItems, unitsOfMeasure } from "./schema.js";

type UnitSeed = {
  code: string;
  name: string;
  dimension: "MASS" | "VOLUME" | "COUNT" | "DISCRETE";
  toBaseFactor: string | null;
  isMetric?: boolean;
};

const UNITS: UnitSeed[] = [
  { code: "g", name: "gram", dimension: "MASS", toBaseFactor: "1", isMetric: true },
  { code: "kg", name: "kilogram", dimension: "MASS", toBaseFactor: "1000", isMetric: true },
  { code: "oz", name: "ounce", dimension: "MASS", toBaseFactor: "28.349500" },
  { code: "lb", name: "pound", dimension: "MASS", toBaseFactor: "453.592000" },
  { code: "ml", name: "milliliter", dimension: "VOLUME", toBaseFactor: "1", isMetric: true },
  { code: "l", name: "liter", dimension: "VOLUME", toBaseFactor: "1000", isMetric: true },
  { code: "fl_oz", name: "fluid ounce", dimension: "VOLUME", toBaseFactor: "29.573500" },
  { code: "tsp", name: "teaspoon", dimension: "VOLUME", toBaseFactor: "4.928920" },
  { code: "tbsp", name: "tablespoon", dimension: "VOLUME", toBaseFactor: "14.786800" },
  { code: "cup", name: "cup", dimension: "VOLUME", toBaseFactor: "236.588000" },
  { code: "each", name: "each", dimension: "COUNT", toBaseFactor: "1" },
  { code: "dozen", name: "dozen", dimension: "COUNT", toBaseFactor: "12" },
  // Item-specific (no global factor → resolved via item_unit_conversions):
  { code: "clove", name: "clove", dimension: "DISCRETE", toBaseFactor: null },
  { code: "bunch", name: "bunch", dimension: "DISCRETE", toBaseFactor: null },
  { code: "can", name: "can", dimension: "DISCRETE", toBaseFactor: null },
];

type ItemSeed = {
  slug: string;
  name: string;
  domain: "grocery" | "household" | "personal_care" | "supplement";
  category: string;
  baseUnit: string;
  perishability: "perishable" | "semi_perishable" | "shelf_stable";
  pantry?: number;
  fridge?: number;
  freezer?: number;
  isStaple?: boolean;
  unitsPerPackage?: number; // e.g. 120 capsules/bottle — powers dosage-based depletion (§6)
  aliases?: string[];
};

const ITEMS: ItemSeed[] = [
  // grocery
  { slug: "chicken-breast", name: "chicken breast", domain: "grocery", category: "meat", baseUnit: "g", perishability: "perishable", fridge: 2, freezer: 270, isStaple: true, aliases: ["boneless skinless chicken breast"] },
  { slug: "whole-milk", name: "whole milk", domain: "grocery", category: "dairy", baseUnit: "ml", perishability: "perishable", fridge: 7, isStaple: true, aliases: ["milk"] },
  { slug: "large-egg", name: "large egg", domain: "grocery", category: "dairy", baseUnit: "each", perishability: "semi_perishable", fridge: 35, isStaple: true, aliases: ["eggs", "egg"] },
  { slug: "baby-spinach", name: "baby spinach", domain: "grocery", category: "produce", baseUnit: "g", perishability: "perishable", fridge: 7, aliases: ["spinach"] },
  { slug: "garlic", name: "garlic", domain: "grocery", category: "produce", baseUnit: "g", perishability: "semi_perishable", pantry: 90, aliases: ["garlic clove", "garlic bulb"] },
  { slug: "olive-oil", name: "olive oil", domain: "grocery", category: "pantry", baseUnit: "ml", perishability: "shelf_stable", pantry: 540, isStaple: true, aliases: ["extra virgin olive oil", "evoo"] },
  { slug: "white-rice", name: "white rice", domain: "grocery", category: "pantry", baseUnit: "g", perishability: "shelf_stable", pantry: 720, isStaple: true, aliases: ["rice", "long grain rice"] },
  // household
  { slug: "dish-soap", name: "dish soap", domain: "household", category: "cleaning", baseUnit: "ml", perishability: "shelf_stable", pantry: 1095, isStaple: true, aliases: ["dishwashing liquid"] },
  { slug: "paper-towels", name: "paper towels", domain: "household", category: "paper", baseUnit: "each", perishability: "shelf_stable", isStaple: true, aliases: ["paper towel roll"] },
  { slug: "laundry-detergent", name: "laundry detergent", domain: "household", category: "cleaning", baseUnit: "ml", perishability: "shelf_stable", pantry: 1095, isStaple: true },
  // personal care
  { slug: "shampoo", name: "shampoo", domain: "personal_care", category: "haircare", baseUnit: "ml", perishability: "shelf_stable", pantry: 1095, isStaple: true },
  { slug: "toothpaste", name: "toothpaste", domain: "personal_care", category: "oralcare", baseUnit: "ml", perishability: "shelf_stable", pantry: 730, isStaple: true },
  { slug: "facial-moisturizer", name: "facial moisturizer", domain: "personal_care", category: "skincare", baseUnit: "ml", perishability: "shelf_stable", pantry: 365, isStaple: true, aliases: ["moisturizer", "face cream"] },
  // supplements (count-based, base unit "each" → dosage depletion: bottle size ÷ daily dose)
  { slug: "vitamin-d3", name: "vitamin D3", domain: "supplement", category: "supplements", baseUnit: "each", perishability: "shelf_stable", pantry: 730, unitsPerPackage: 120, aliases: ["vitamin d", "d3"] },
  { slug: "omega-3", name: "omega-3 fish oil", domain: "supplement", category: "supplements", baseUnit: "each", perishability: "shelf_stable", pantry: 730, unitsPerPackage: 90, aliases: ["fish oil", "omega 3"] },
  { slug: "magnesium-glycinate", name: "magnesium glycinate", domain: "supplement", category: "supplements", baseUnit: "each", perishability: "shelf_stable", pantry: 730, unitsPerPackage: 120, aliases: ["magnesium"] },
];

async function main() {
  const env = loadEnv();
  const { db, client } = createDb(env.DATABASE_URL, 1);
  try {
    console.log(`→ seeding ${UNITS.length} units…`);
    await db.insert(unitsOfMeasure).values(UNITS).onConflictDoNothing({ target: unitsOfMeasure.code });

    const units = await db.select({ id: unitsOfMeasure.id, code: unitsOfMeasure.code }).from(unitsOfMeasure);
    const unitByCode = new Map(units.map((u) => [u.code, u.id]));

    console.log(`→ seeding ${ITEMS.length} canonical items…`);
    for (const it of ITEMS) {
      const baseUnitId = unitByCode.get(it.baseUnit);
      if (!baseUnitId) throw new Error(`missing base unit ${it.baseUnit} for ${it.slug}`);
      await db
        .insert(canonicalItems)
        .values({
          slug: it.slug,
          name: it.name,
          domain: it.domain,
          category: it.category,
          baseUnitId,
          perishability: it.perishability,
          shelfLifePantryDays: it.pantry ?? null,
          shelfLifeFridgeDays: it.fridge ?? null,
          shelfLifeFreezerDays: it.freezer ?? null,
          isStaple: it.isStaple ?? false,
          unitsPerPackage: it.unitsPerPackage != null ? String(it.unitsPerPackage) : null,
          aliases: it.aliases ?? [],
        })
        .onConflictDoNothing({ target: canonicalItems.slug });
    }

    console.log("✓ seed complete");
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
