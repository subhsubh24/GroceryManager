import { describe, expect, it, vi } from "vitest";
import { fetchFdcPer100g } from "./fdc.js";

/** Build a fake fetch that returns one FDC food with the given nutrient rows. */
function fetchWithFood(nutrients: unknown[], init?: { ok?: boolean }): typeof fetch {
  return vi.fn(async () => ({
    ok: init?.ok ?? true,
    json: async () => ({ foods: [{ foodNutrients: nutrients }] }),
  })) as unknown as typeof fetch;
}

const KEY = "test-key";

describe("fetchFdcPer100g", () => {
  it("reads per-100g macros matched by nutrient number", async () => {
    const fetchImpl = fetchWithFood([
      { nutrientNumber: "208", unitName: "KCAL", value: 165 },
      { nutrientNumber: "203", unitName: "G", value: 31 },
      { nutrientNumber: "205", unitName: "G", value: 0 },
      { nutrientNumber: "204", unitName: "G", value: 3.6 },
    ]);
    const macros = await fetchFdcPer100g("chicken breast", KEY, fetchImpl);
    expect(macros).toEqual({ kcal: 165, proteinG: 31, carbsG: 0, fatG: 3.6 });
  });

  it("falls back to a name contains-match when numbers are absent", async () => {
    const fetchImpl = fetchWithFood([
      { nutrientName: "Energy", unitName: "kcal", value: 52 },
      { nutrientName: "Protein", unitName: "g", value: 0.3 },
      { nutrientName: "Carbohydrate, by difference", unitName: "g", value: 14 },
      { nutrientName: "Total lipid (fat)", unitName: "g", value: 0.2 },
    ]);
    const macros = await fetchFdcPer100g("apple", KEY, fetchImpl);
    expect(macros).toEqual({ kcal: 52, proteinG: 0.3, carbsG: 14, fatG: 0.2 });
  });

  it("reads nested nutrient.* row shapes (number + name under nutrient)", async () => {
    const fetchImpl = fetchWithFood([
      { nutrient: { number: "208", unitName: "kcal" }, amount: 89 },
      { nutrient: { number: "203" }, amount: 1.1 },
    ]);
    const macros = await fetchFdcPer100g("banana", KEY, fetchImpl);
    expect(macros).toEqual({ kcal: 89, proteinG: 1.1, carbsG: 0, fatG: 0 });
  });

  it("prefers the kcal energy reading over a kJ one regardless of row order", async () => {
    const fetchImpl = fetchWithFood([
      // kJ energy first (name match, not number 208), then the real kcal row.
      { nutrientName: "Energy", unitName: "kJ", value: 690 },
      { nutrientNumber: "208", unitName: "kcal", value: 165 },
    ]);
    const macros = await fetchFdcPer100g("x", KEY, fetchImpl);
    expect(macros?.kcal).toBe(165);
  });

  it("takes the first energy value when no kcal-unit row is present", async () => {
    const fetchImpl = fetchWithFood([{ nutrientName: "Energy", unitName: "kJ", value: 690 }]);
    const macros = await fetchFdcPer100g("x", KEY, fetchImpl);
    expect(macros?.kcal).toBe(690);
  });

  it("defaults missing macros to 0 but keeps the energy value", async () => {
    const fetchImpl = fetchWithFood([{ nutrientNumber: "208", unitName: "kcal", value: 100 }]);
    const macros = await fetchFdcPer100g("x", KEY, fetchImpl);
    expect(macros).toEqual({ kcal: 100, proteinG: 0, carbsG: 0, fatG: 0 });
  });

  it("returns null when there is no usable energy value", async () => {
    const fetchImpl = fetchWithFood([
      { nutrientNumber: "203", unitName: "g", value: 10 },
      { nutrientNumber: "204", unitName: "g", value: 5 },
    ]);
    expect(await fetchFdcPer100g("x", KEY, fetchImpl)).toBeNull();
  });

  it("skips rows with no numeric value", async () => {
    const fetchImpl = fetchWithFood([
      { nutrientNumber: "208", unitName: "kcal", value: "not-a-number" },
      { nutrientNumber: "208", unitName: "kcal", value: 200 },
    ]);
    const macros = await fetchFdcPer100g("x", KEY, fetchImpl);
    expect(macros?.kcal).toBe(200);
  });

  it("returns null on a non-200 response", async () => {
    const fetchImpl = fetchWithFood([{ nutrientNumber: "208", value: 100 }], { ok: false });
    expect(await fetchFdcPer100g("x", KEY, fetchImpl)).toBeNull();
  });

  it("returns null when no foods match", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({ foods: [] }),
    })) as unknown as typeof fetch;
    expect(await fetchFdcPer100g("x", KEY, fetchImpl)).toBeNull();
  });

  it("returns null when the payload is not an object", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => null,
    })) as unknown as typeof fetch;
    expect(await fetchFdcPer100g("x", KEY, fetchImpl)).toBeNull();
  });

  it("returns null (never throws) on a network/parse error", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("network down");
    }) as unknown as typeof fetch;
    expect(await fetchFdcPer100g("x", KEY, fetchImpl)).toBeNull();
  });

  it("URL-encodes the ingredient name into the query", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({ foods: [{ foodNutrients: [{ nutrientNumber: "208", value: 1 }] }] }),
    })) as unknown as typeof fetch;
    await fetchFdcPer100g("olive oil & salt", KEY, fetchImpl);
    const calledUrl = (fetchImpl as unknown as { mock: { calls: unknown[][] } }).mock.calls[0]![0] as string;
    expect(calledUrl).toContain("query=olive%20oil%20%26%20salt");
    expect(calledUrl).toContain(`api_key=${KEY}`);
  });

  it("passes an AbortSignal so a hung FDC endpoint can't stall the request past the serverless budget", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({ foods: [{ foodNutrients: [{ nutrientNumber: "208", value: 1 }] }] }),
    })) as unknown as typeof fetch;
    await fetchFdcPer100g("x", KEY, fetchImpl);
    const init = (fetchImpl as unknown as { mock: { calls: unknown[][] } }).mock.calls[0]![1] as
      | RequestInit
      | undefined;
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });
});
