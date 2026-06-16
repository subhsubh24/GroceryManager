/**
 * Shopping-list assembly (PLAN §7.1 / §7.5). Routes each due item to the right channel:
 * grocery → Instacart, household/personal_care → Amazon. Pure + testable.
 */
import type { Domain } from "@gm/shared";

export type OrderChannel = "instacart" | "amazon";

export function channelForDomain(domain: Domain): OrderChannel {
  return domain === "grocery" ? "instacart" : "amazon";
}

export interface DueItem {
  canonicalItemId: string;
  name: string;
  domain: Domain;
  recommendQty: number | null;
  unit?: string | null;
  /** Amazon ASIN (household/personal-care), when known. */
  asin?: string | null;
}

export interface GroupedOrder {
  instacart: DueItem[];
  amazon: DueItem[];
}

/** Split due items into the two ordering channels. */
export function groupForOrdering(items: DueItem[]): GroupedOrder {
  const out: GroupedOrder = { instacart: [], amazon: [] };
  for (const it of items) out[channelForDomain(it.domain)].push(it);
  return out;
}
