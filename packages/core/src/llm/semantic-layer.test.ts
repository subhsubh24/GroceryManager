import { describe, expect, it } from "vitest";
import { buildSemanticTools, type Tool } from "./semantic-layer.js";

const tools = buildSemanticTools({ userId: "user-1" });
const byName = (n: string): Tool => {
  const t = tools.find((x) => x.name === n);
  if (!t) throw new Error(`tool not found: ${n}`);
  return t;
};

// The complete, intended surface. Read tools + the two ADDITIVE mutations + the DRAFT planner.
const READ_TOOLS = ["get_pantry", "analyze_spend", "get_cooking_stats", "get_taste_profile", "find_recipes"];
const MUTATING_TOOLS = ["add_to_list", "save_recipe"]; // additive + reversible only
const PLAN_TOOLS = ["plan_my_week"]; // draft only — no order placed

describe("buildSemanticTools — registry shape", () => {
  it("exposes exactly the expected tools (and NO destructive/order/payment tools)", () => {
    const names = tools.map((t) => t.name).sort();
    expect(names).toEqual([...READ_TOOLS, ...MUTATING_TOOLS, ...PLAN_TOOLS].sort());

    // Safety invariant: nothing that could delete, order, pay, or change account settings.
    for (const n of names) {
      expect(n).not.toMatch(/delete|remove|clear|order|checkout|buy|pay|charge|cancel|settings|password/i);
    }
  });

  it("every tool has a unique name, a real description, and a JSON-schema object for parameters", () => {
    expect(new Set(tools.map((t) => t.name)).size).toBe(tools.length); // unique

    for (const t of tools) {
      expect(t.name).toMatch(/^[a-z][a-z0-9_]*$/); // Gemini-safe function name
      expect(typeof t.description).toBe("string");
      expect(t.description.length).toBeGreaterThan(20);
      expect(typeof t.handler).toBe("function");

      // parameters must be a well-formed object schema (Gemini functionDeclarations shape).
      expect(t.parameters).toMatchObject({ type: "object" });
      const props = (t.parameters as { properties?: Record<string, unknown> }).properties ?? {};
      expect(typeof props).toBe("object");
      // Each declared property must itself declare a type, and any `required` entry must exist.
      const required = (t.parameters as { required?: string[] }).required ?? [];
      for (const key of required) expect(props).toHaveProperty(key);
      for (const [, schema] of Object.entries(props)) {
        expect(schema).toHaveProperty("type");
      }
    }
  });

  it("the mutating tools declare their required args and are described as additive/reversible", () => {
    const addToList = byName("add_to_list");
    expect((addToList.parameters as { required?: string[] }).required).toContain("items");
    expect(addToList.description.toLowerCase()).toMatch(/additive|reversible|add/);

    const save = byName("save_recipe");
    const saveReq = (save.parameters as { required?: string[] }).required ?? [];
    expect(saveReq).toEqual(expect.arrayContaining(["id", "title"]));
    expect(save.description.toLowerCase()).toMatch(/additive|reversible|save/);
  });

  it("plan_my_week is described as a non-committal DRAFT (no order placed)", () => {
    expect(byName("plan_my_week").description.toLowerCase()).toMatch(/draft|does not|no order|does not place/);
  });
});

describe("handler input validation (runs before any DB access)", () => {
  it("add_to_list rejects an empty / invalid item list with an error (no DB needed)", async () => {
    const addToList = byName("add_to_list");
    await expect(addToList.handler({ items: [] }, { userId: "user-1" })).resolves.toEqual({
      error: expect.stringMatching(/no valid item/i),
    });
    await expect(addToList.handler({ items: ["   ", 7, null] as unknown[] }, { userId: "user-1" })).resolves.toEqual({
      error: expect.stringMatching(/no valid item/i),
    });
    await expect(addToList.handler({}, { userId: "user-1" })).resolves.toEqual({
      error: expect.stringMatching(/no valid item/i),
    });
  });

  it("save_recipe rejects a call missing id or title with an error (no DB needed)", async () => {
    const save = byName("save_recipe");
    await expect(save.handler({ title: "Pad Thai" }, { userId: "user-1" })).resolves.toEqual({
      error: expect.stringMatching(/requires both id and title/i),
    });
    await expect(save.handler({ id: "52772" }, { userId: "user-1" })).resolves.toEqual({
      error: expect.stringMatching(/requires both id and title/i),
    });
  });
});

describe("handler error-safety (a failing handler returns { error }, never throws)", () => {
  // With no DATABASE_URL configured in the unit-test env, the read handlers' getDb()/withTenant()
  // calls fail — proving the try/catch in EVERY handler converts a failure into a safe { error }
  // object so one bad tool call can't crash the function-calling loop.
  for (const name of READ_TOOLS) {
    it(`${name} resolves to an object and never rejects`, async () => {
      const out = await byName(name).handler({}, { userId: "user-1" });
      expect(out).toBeTypeOf("object");
      expect(out).not.toBeNull();
    });
  }
});
