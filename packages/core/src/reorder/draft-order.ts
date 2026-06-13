/**
 * Draft-order assembly (PLAN §7.1 / §7.5). Turns reorder inputs into per-channel draft orders:
 * an Instacart shopping-list payload (grocery) and an Amazon Add-to-Cart URL + Subscribe & Save
 * links (household/personal-care). Pure + testable; the DB query feeds it.
 */
import type { Domain } from "@gm/shared";
import { buildAddToCartUrl, buildSubscribeSaveUrl } from "../integrations/amazon/links.js";
import { buildShoppingListPayload, type ShoppingListPayload } from "../integrations/instacart/client.js";
import { predictReorder, type ReorderPolicySnapshot, type StockSnapshot } from "./predict.js";
import { groupForOrdering, type DueItem } from "./shopping-list.js";

export interface ReorderInputRow {
  canonicalItemId: string;
  name: string;
  domain: Domain;
  unit: string | null;
  baseQtyOnHand: number;
  ratePerDay: number | null;
  confidence: number;
  status: string;
  enabled: boolean | null;
  targetParQty: number | null;
  reorderPointQty: number | null;
  leadTimeDays: number | null;
  minIntervalDays: number | null;
  lastSuggestedAt: Date | null;
  packageQty: number | null;
  asin: string | null;
}

export interface DraftOrders {
  instacart: { items: DueItem[]; payload: ShoppingListPayload | null };
  amazon: {
    items: DueItem[];
    addToCartUrl: string | null;
    subscribeSave: { name: string; url: string }[];
  };
}

const DEFAULTS = { enabled: true, leadTimeDays: 2, minIntervalDays: 7 };

export function buildDraftOrders(
  rows: ReorderInputRow[],
  opts: { associateTag?: string; title?: string } = {},
): DraftOrders {
  const due: DueItem[] = [];

  for (const r of rows) {
    const stock: StockSnapshot = {
      baseQtyOnHand: r.baseQtyOnHand,
      estimatedConsumptionRatePerDay: r.ratePerDay,
      confidence: r.confidence,
    };
    const policy: ReorderPolicySnapshot = {
      enabled: r.enabled ?? DEFAULTS.enabled,
      targetParQty: r.targetParQty,
      reorderPointQty: r.reorderPointQty,
      leadTimeDays: r.leadTimeDays ?? DEFAULTS.leadTimeDays,
      minIntervalDays: r.minIntervalDays ?? DEFAULTS.minIntervalDays,
      lastSuggestedAt: r.lastSuggestedAt,
      packageQty: r.packageQty,
    };
    const pred = predictReorder(stock, policy);
    const lowOrOut = r.status === "low" || r.status === "out" || r.status === "expired_likely";
    if (pred.shouldReorder || lowOrOut) {
      due.push({
        canonicalItemId: r.canonicalItemId,
        name: r.name,
        domain: r.domain,
        recommendQty: pred.recommendQty,
        unit: r.unit,
        asin: r.asin,
      });
    }
  }

  const grouped = groupForOrdering(due);

  const payload = grouped.instacart.length
    ? buildShoppingListPayload(
        opts.title ?? "Your GroceryManager list",
        grouped.instacart.map((i) => ({
          name: i.name,
          quantity: i.recommendQty ?? undefined,
          unit: i.unit ?? undefined,
        })),
      )
    : null;

  const withAsin = grouped.amazon.filter((i) => i.asin);
  // Amazon cart quantity is a package count; default to 1 in v1 (user adjusts on Amazon).
  const addToCartUrl = withAsin.length
    ? buildAddToCartUrl(
        withAsin.map((i) => ({ asin: i.asin as string, quantity: 1 })),
        opts.associateTag,
      )
    : null;
  const subscribeSave = withAsin.map((i) => ({
    name: i.name,
    url: buildSubscribeSaveUrl(i.asin as string, opts.associateTag),
  }));

  return {
    instacart: { items: grouped.instacart, payload },
    amazon: { items: grouped.amazon, addToCartUrl, subscribeSave },
  };
}
