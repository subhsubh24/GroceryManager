import { describe, expect, it } from "vitest";
import {
  answerKitchenChat,
  buildKitchenBrief,
  summarizeBrief,
  type ChatMessage,
  type KitchenBriefInputs,
} from "./index.js";
import type { PreferenceSignalInput } from "../personalization/user-model.js";

const d = (s: string) => new Date(s);
const NOW = d("2026-06-16T12:00:00Z"); // a Tuesday → its UTC Monday is 2026-06-15

const empty: KitchenBriefInputs = {
  now: NOW,
  pantry: [],
  purchases: [],
  lineItems: [],
  cookedAt: [],
  signals: [],
  weeklyBudgetCents: null,
};

describe("buildKitchenBrief", () => {
  it("is empty-user safe — every field has a sensible default", () => {
    const b = buildKitchenBrief(empty);
    expect(b.pantry).toEqual([]);
    expect(b.spend.byMonth).toEqual([]);
    expect(b.spend.byWeek).toEqual([]);
    expect(b.spend.topItems).toEqual([]);
    expect(b.spend.priceTrends).toEqual([]);
    expect(b.spend.cheaperElsewhere).toEqual([]);
    expect(b.spend.budget).toEqual({
      thisWeekActualCents: 0,
      weeklyBudgetCents: null,
      deltaCents: null,
      overBudget: false,
    });
    expect(b.cooking).toEqual({
      currentStreakDays: 0,
      longestStreakDays: 0,
      cooksThisWeek: 0,
      totalCooksTracked: 0,
      recentRecipes: [],
    });
    expect(b.taste).toEqual({ diets: [], allergens: [], loves: [], dislikes: [], topCuisines: [] });
    expect(b.recent).toEqual({ purchases: [], lineItems: [] });
    expect(b.generatedAt).toBe(NOW.toISOString());
  });

  it("maps pantry status + run-out date, null-safe", () => {
    const b = buildKitchenBrief({
      ...empty,
      pantry: [
        { name: "Milk", status: "low", estimatedRunOutAt: d("2026-06-20T00:00:00Z") },
        { name: "Rice", status: "in_stock", estimatedRunOutAt: null },
      ],
    });
    expect(b.pantry).toEqual([
      { name: "Milk", status: "low", runOutAt: "2026-06-20" },
      { name: "Rice", status: "in_stock", runOutAt: null },
    ]);
  });

  it("computes spend by month/week and this-week budget delta", () => {
    const b = buildKitchenBrief({
      ...empty,
      weeklyBudgetCents: 5000,
      purchases: [
        { purchasedAt: d("2026-06-15T10:00:00Z"), totalCents: 4000 }, // this UTC week (Mon 6/15)
        { purchasedAt: d("2026-06-16T10:00:00Z"), totalCents: 3000 }, // this UTC week too
        { purchasedAt: d("2026-06-01T10:00:00Z"), totalCents: 1000 }, // earlier in the month, prior week
      ],
    });
    // Month total for June = 8000; latest month first.
    expect(b.spend.byMonth[0]).toEqual({ periodStart: "2026-06-01", totalCents: 8000 });
    // This week (Mon 2026-06-15) = 7000.
    expect(b.spend.budget.thisWeekActualCents).toBe(7000);
    expect(b.spend.budget.weeklyBudgetCents).toBe(5000);
    expect(b.spend.budget.deltaCents).toBe(2000);
    expect(b.spend.budget.overBudget).toBe(true);
  });

  it("ranks top items by spend and surfaces price trends + cheaper retailer", () => {
    const lineItems: KitchenBriefInputs["lineItems"] = [
      { canonicalItemId: "c1", name: "Coffee", retailer: "A", purchasedAt: d("2026-05-01"), unitPriceCents: 800, lineTotalCents: 800 },
      { canonicalItemId: "c1", name: "Coffee", retailer: "B", purchasedAt: d("2026-06-01"), unitPriceCents: 1200, lineTotalCents: 1200 },
      { canonicalItemId: "c2", name: "Eggs", retailer: "A", purchasedAt: d("2026-06-02"), unitPriceCents: 300, lineTotalCents: 300 },
    ];
    const b = buildKitchenBrief({ ...empty, lineItems });
    expect(b.spend.topItems[0]).toMatchObject({ name: "Coffee", totalCents: 2000 });
    const coffeeTrend = b.spend.priceTrends.find((t) => t.name === "Coffee");
    expect(coffeeTrend).toMatchObject({ minCents: 800, maxCents: 1200, latestCents: 1200 });
    // Coffee was bought at two retailers → cheaper-retailer entry with A cheapest.
    expect(b.spend.cheaperElsewhere[0]).toMatchObject({ name: "Coffee", bestRetailer: "A", savingsVsWorstCents: 400 });
  });

  it("derives cooking streaks + this-week cooks and caps recent recipes", () => {
    const cookedAt = [d("2026-06-16T08:00:00Z"), d("2026-06-15T08:00:00Z"), d("2026-06-14T08:00:00Z")];
    const titles = Array.from({ length: 30 }, (_, i) => `Recipe ${i}`);
    const b = buildKitchenBrief({ ...empty, cookedAt, recentCookedTitles: titles });
    expect(b.cooking.currentStreakDays).toBe(3);
    expect(b.cooking.longestStreakDays).toBe(3);
    expect(b.cooking.cooksThisWeek).toBe(2); // Mon 6/15 + Tue 6/16 fall in this week
    expect(b.cooking.totalCooksTracked).toBe(3);
    expect(b.cooking.recentRecipes).toHaveLength(20); // capped
  });

  it("projects taste (diets/allergens/cuisines) from signals", () => {
    const signals: PreferenceSignalInput[] = [
      { topic: "diet:vegetarian", value: "vegetarian", polarity: "positive", confidence: 0.9 },
      { topic: "allergen:peanut", value: "peanut", polarity: "positive", confidence: 0.95 },
      { topic: "cuisine:thai", value: "thai", polarity: "positive", confidence: 1 },
    ];
    const b = buildKitchenBrief({ ...empty, signals });
    expect(b.taste.diets).toContain("vegetarian");
    expect(b.taste.allergens).toContain("peanut");
    expect(b.taste.topCuisines[0]?.cuisine).toBe("thai");
    expect(b.taste.topCuisines[0]?.affinity).toBeGreaterThan(0);
  });

  it("caps pantry and recent rows to bound tokens", () => {
    const pantry = Array.from({ length: 80 }, (_, i) => ({ name: `Item ${i}`, status: "in_stock", estimatedRunOutAt: null }));
    const purchases = Array.from({ length: 80 }, (_, i) => ({
      purchasedAt: new Date(NOW.getTime() - i * 86_400_000),
      totalCents: 100 + i,
    }));
    const lineItems = Array.from({ length: 80 }, (_, i) => ({
      canonicalItemId: `c${i}`,
      name: `Line ${i}`,
      retailer: "A",
      purchasedAt: new Date(NOW.getTime() - i * 86_400_000),
      unitPriceCents: 100 + i,
      lineTotalCents: 100 + i,
    }));
    const b = buildKitchenBrief({ ...empty, pantry, purchases, lineItems });
    expect(b.pantry).toHaveLength(50);
    expect(b.recent.purchases).toHaveLength(50);
    expect(b.recent.lineItems).toHaveLength(50);
    expect(b.spend.topItems.length).toBeLessThanOrEqual(12);
    expect(b.spend.priceTrends.length).toBeLessThanOrEqual(12);
    // Recent purchases sorted newest-first.
    expect(b.recent.purchases[0]!.date).toBe("2026-06-16");
  });

  it("recent lineItems drop null unit prices", () => {
    const b = buildKitchenBrief({
      ...empty,
      lineItems: [
        { canonicalItemId: "c1", name: "A", retailer: "X", purchasedAt: d("2026-06-10"), unitPriceCents: null, lineTotalCents: 500 },
        { canonicalItemId: "c2", name: "B", retailer: "X", purchasedAt: d("2026-06-11"), unitPriceCents: 200, lineTotalCents: 200 },
      ],
    });
    expect(b.recent.lineItems).toEqual([
      { name: "B", unitPriceCents: 200, retailer: "X", date: "2026-06-11" },
    ]);
  });
});

describe("summarizeBrief / answerKitchenChat (keyless fallback)", () => {
  const briefWithData = buildKitchenBrief({
    ...empty,
    weeklyBudgetCents: 5000,
    purchases: [{ purchasedAt: d("2026-06-15T10:00:00Z"), totalCents: 7000 }],
    lineItems: [
      { canonicalItemId: "c1", name: "Coffee", retailer: "A", purchasedAt: d("2026-06-10"), unitPriceCents: 800, lineTotalCents: 800 },
    ],
    cookedAt: [d("2026-06-16T08:00:00Z")],
  });

  it("summarizeBrief surfaces pre-computed stats and a key nudge when keyless", () => {
    const reply = summarizeBrief(briefWithData, true);
    expect(reply).toContain("$70.00"); // month spend
    expect(reply).toContain("over your $50.00 budget");
    expect(reply).toContain("GEMINI_API_KEY");
  });

  it("summarizeBrief handles the empty user without throwing", () => {
    const reply = summarizeBrief(buildKitchenBrief(empty), false);
    expect(reply).toContain("don't have much data");
    expect(reply).not.toContain("GEMINI_API_KEY");
  });

  it("answerKitchenChat with no client returns the keyless summary (never throws), 0 LLM calls", async () => {
    const messages: ChatMessage[] = [{ role: "user", content: "How's my spending?" }];
    const { reply, llmCalls } = await answerKitchenChat({ userId: "u1" }, { messages, brief: briefWithData });
    expect(reply).toContain("GEMINI_API_KEY");
    expect(reply.length).toBeGreaterThan(0);
    expect(llmCalls).toBe(0); // keyless path makes no LLM call — costs zero quota
  });

  it("answerKitchenChat with a client but NO userId degrades to the keyless summary", async () => {
    // No userId means tools can't be scoped, so we must not call the agent — degrade safely.
    let called = false;
    const fakeClient = {
      async runChatWithTools() {
        called = true;
        return { text: "should not be used", steps: 1 };
      },
    } as unknown as Parameters<typeof answerKitchenChat>[0]["client"];
    const { reply } = await answerKitchenChat(
      { client: fakeClient },
      { messages: [{ role: "user", content: "How's my spending?" }], brief: briefWithData },
    );
    expect(called).toBe(false); // the agent is NOT engaged without a userId to scope tools
    expect(reply).toContain("$70.00"); // degrades to the deterministic summary
    expect(reply).not.toContain("GEMINI_API_KEY"); // a key/client exists — don't nudge to add one
  });

  it("answerKitchenChat drives the function-calling loop (tools + code execution) with a client and userId", async () => {
    let captured:
      | { system?: string; codeExecution?: boolean; maxSteps?: number; ctx?: { userId?: string }; tools?: { name: string }[] }
      | null = null;
    const fakeClient = {
      async runChatWithTools(a: {
        system?: string;
        codeExecution?: boolean;
        maxSteps?: number;
        ctx?: { userId?: string };
        tools?: { name: string }[];
      }) {
        captured = a;
        return { text: "Your spending looks healthy.", steps: 2 };
      },
    } as unknown as Parameters<typeof answerKitchenChat>[0]["client"];

    const { reply, llmCalls } = await answerKitchenChat(
      { client: fakeClient, userId: "u1" },
      { messages: [{ role: "user", content: "How's my spending?" }], brief: briefWithData },
    );
    expect(reply).toBe("Your spending looks healthy.");
    expect(llmCalls).toBe(2); // reports the loop's real step count so the caller settles quota per-call
    expect(captured!.codeExecution).toBe(true);
    expect(captured!.system).toMatch(/tool/i);
    expect(captured!.maxSteps).toBe(8); // loop is capped
    expect(captured!.ctx?.userId).toBe("u1"); // tools are scoped to the user
    // The real semantic-layer tools are wired in, including the additive-only mutations.
    const names = (captured!.tools ?? []).map((t) => t.name);
    expect(names).toEqual(expect.arrayContaining(["get_pantry", "analyze_spend", "find_recipes", "add_to_list", "save_recipe", "plan_my_week"]));
  });

  it("answerKitchenChat falls back to the summary when the agent throws", async () => {
    const throwingClient = {
      async runChatWithTools() {
        throw new Error("network down");
      },
    } as unknown as Parameters<typeof answerKitchenChat>[0]["client"];
    const { reply, llmCalls } = await answerKitchenChat(
      { client: throwingClient, userId: "u1" },
      { messages: [{ role: "user", content: "hi" }], brief: briefWithData },
    );
    expect(reply).toContain("$70.00"); // degraded to deterministic stats
    expect(reply).not.toContain("GEMINI_API_KEY"); // not keyless — a key existed, the call just failed
    expect(llmCalls).toBe(1); // a (failed) call was attempted — charge 1, not 0
  });

  it("answerKitchenChat falls back to summary when the agent returns blank text", async () => {
    const blankClient = {
      async runChatWithTools() {
        return { text: "   ", steps: 1 };
      },
    } as unknown as Parameters<typeof answerKitchenChat>[0]["client"];
    const { reply } = await answerKitchenChat(
      { client: blankClient, userId: "u1" },
      { messages: [{ role: "user", content: "hi" }], brief: briefWithData },
    );
    expect(reply.length).toBeGreaterThan(0);
    expect(reply).not.toContain("GEMINI_API_KEY");
  });
});
