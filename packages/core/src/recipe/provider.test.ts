import { afterEach, describe, expect, it, vi } from "vitest";
import { mapMealDbMeal, TheMealDBProvider } from "./provider.js";

describe("mapMealDbMeal", () => {
  it("extracts populated ingredients and skips empties", () => {
    const meal = {
      idMeal: "52772",
      strMeal: "Teriyaki Chicken Casserole",
      strMealThumb: "https://img/teriyaki.jpg",
      strIngredient1: "soy sauce",
      strMeasure1: "3/4 cup",
      strIngredient2: "water",
      strMeasure2: " ",
      strIngredient3: "  ",
      strIngredient4: "chicken breasts",
      strMeasure4: "2",
      strIngredient5: "",
      strIngredient6: null,
    };
    const r = mapMealDbMeal(meal);
    expect(r.id).toBe("52772");
    expect(r.title).toBe("Teriyaki Chicken Casserole");
    expect(r.imageUrl).toBe("https://img/teriyaki.jpg");
    expect(r.ingredients.map((i) => i.name)).toEqual(["soy sauce", "water", "chicken breasts"]);
    expect(r.ingredients[0]).toEqual({ name: "soy sauce", measure: "3/4 cup" });
    expect(r.ingredients[1]).toEqual({ name: "water" }); // blank measure omitted
    expect(r.ingredients[2]).toEqual({ name: "chicken breasts", measure: "2" });
  });
});

describe("TheMealDBProvider", () => {
  afterEach(() => vi.unstubAllGlobals());

  /** Stub global fetch; capture the requested URL(s) and return a chosen ok/body. */
  function stubFetch(handler: (url: string) => { ok: boolean; body: unknown }) {
    const seen: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        seen.push(String(url));
        const { ok, body } = handler(String(url));
        return { ok, json: async () => body } as Response;
      }),
    );
    return seen;
  }

  it("searchByIngredient maps lightweight candidates (no ingredient list)", async () => {
    const seen = stubFetch(() => ({
      ok: true,
      body: { meals: [{ idMeal: "1", strMeal: "Chili", strMealThumb: "https://img/1.jpg" }] },
    }));
    const out = await new TheMealDBProvider().searchByIngredient("beef");
    expect(out).toEqual([{ id: "1", title: "Chili", imageUrl: "https://img/1.jpg", ingredients: [] }]);
    expect(seen[0]).toContain("/filter.php?i=beef");
  });

  it("searchByIngredient url-encodes the ingredient", async () => {
    const seen = stubFetch(() => ({ ok: true, body: { meals: [] } }));
    await new TheMealDBProvider().searchByIngredient("cream cheese");
    expect(seen[0]).toContain("filter.php?i=cream%20cheese");
  });

  it("searchByIngredient returns [] on a non-ok response", async () => {
    stubFetch(() => ({ ok: false, body: null }));
    expect(await new TheMealDBProvider().searchByIngredient("beef")).toEqual([]);
  });

  it("searchByIngredient tolerates a null meals payload", async () => {
    stubFetch(() => ({ ok: true, body: { meals: null } }));
    expect(await new TheMealDBProvider().searchByIngredient("zzz")).toEqual([]);
  });

  it("getById returns the full mapped recipe", async () => {
    const seen = stubFetch(() => ({
      ok: true,
      body: { meals: [{ idMeal: "52772", strMeal: "Teriyaki", strIngredient1: "soy sauce", strMeasure1: "3/4 cup" }] },
    }));
    const r = await new TheMealDBProvider().getById("52772");
    expect(r?.id).toBe("52772");
    expect(r?.title).toBe("Teriyaki");
    expect(r?.ingredients[0]).toEqual({ name: "soy sauce", measure: "3/4 cup" });
    expect(seen[0]).toContain("/lookup.php?i=52772");
  });

  it("getById returns null on a non-ok response", async () => {
    stubFetch(() => ({ ok: false, body: null }));
    expect(await new TheMealDBProvider().getById("1")).toBeNull();
  });

  it("getById returns null when the lookup has no meals", async () => {
    stubFetch(() => ({ ok: true, body: { meals: null } }));
    expect(await new TheMealDBProvider().getById("1")).toBeNull();
  });

  it("bounds both requests with an AbortSignal so a hung provider can't stall discovery", async () => {
    const fetchMock = vi.fn(
      async (_url: string, _init?: RequestInit) =>
        ({ ok: true, json: async () => ({ meals: null }) }) as Response,
    );
    vi.stubGlobal("fetch", fetchMock);
    await new TheMealDBProvider().searchByIngredient("beef");
    await new TheMealDBProvider().getById("1");
    expect(fetchMock.mock.calls.length).toBe(2);
    for (const call of fetchMock.mock.calls) {
      expect(call[1]?.signal).toBeInstanceOf(AbortSignal);
    }
  });
});
