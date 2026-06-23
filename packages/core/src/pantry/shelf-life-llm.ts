/**
 * LLM-assisted shelf-life (PLAN §6 — the "refine with an LLM later" upgrade). The keyword heuristic
 * (shelf-life.ts) is instant + free but only knows the foods in its list; everything else falls to a
 * generic 90-day default, so an unfamiliar FRESH item (e.g. "fresh mozzarella", "cilantro") never ages
 * out and reads "in stock" weeks later. This asks the model — real food-storage knowledge — for those
 * unknowns only.
 *
 * Best-effort by construction: ANY failure (no key, bad JSON, timeout, or a nonsense answer) falls
 * back to the deterministic estimate, so canonical creation never blocks or breaks.
 */
import { z } from "zod";
import type { GeminiClient } from "../llm/client.js";
import { estimateShelfLife, type ShelfLifeEstimate } from "./shelf-life.js";

const Schema = z.object({
  domain: z.enum(["grocery", "household", "personal_care", "supplement"]),
  perishability: z.enum(["perishable", "semi_perishable", "shelf_stable"]),
  shelfLifeFridgeDays: z.number().nullable(),
  shelfLifePantryDays: z.number().nullable(),
});

const SYSTEM = [
  "You are a food-storage expert labelling an item for a kitchen-inventory app. Given an item name,",
  "estimate how it should be tracked. Return JSON only, matching the schema.",
  "- domain: grocery (food/drink), household (cleaning/paper goods), personal_care (toiletries/skincare),",
  "  supplement (vitamins/protein).",
  "- perishability: 'perishable' = spoils in days to ~2 weeks (fresh produce, meat, seafood, dairy);",
  "  'semi_perishable' = ~2 weeks to a couple months (bread, soft cheese, deli, fresh juice);",
  "  'shelf_stable' = months or more (canned, dry goods, oils, frozen, and all non-food).",
  "- shelfLifeFridgeDays / shelfLifePantryDays: typical days it stays good in each place (FoodKeeper-style",
  "  ballparks). Use null for the place that doesn't apply. A perishable or semi_perishable MUST have a",
  "  realistic number in at least one (e.g. fresh berries ~5 fridge, fresh fish ~2 fridge, cilantro ~7",
  "  fridge, bread ~6 pantry). shelf_stable items can leave both null or give a long pantry life.",
].join("\n");

/**
 * Build an estimator `(name) => Promise<ShelfLifeEstimate>`. Intended for UNKNOWN items only (let the
 * keyword rule handle the rest for free) — but safe to call on anything.
 */
export function createLlmShelfLifeEstimator(
  client: GeminiClient,
): (name: string) => Promise<ShelfLifeEstimate> {
  return async (name: string) => {
    try {
      const r = await client.generateStructured(Schema, `Item: ${name}`, {
        tier: "cheap",
        system: SYSTEM,
      });
      // Distrust a confident-but-useless answer: a (semi-)perishable with no shelf life would never
      // age out — fall back to the heuristic rather than store a broken estimate.
      if (r.perishability !== "shelf_stable" && r.shelfLifeFridgeDays == null && r.shelfLifePantryDays == null) {
        return estimateShelfLife(name);
      }
      return r;
    } catch {
      return estimateShelfLife(name);
    }
  };
}
