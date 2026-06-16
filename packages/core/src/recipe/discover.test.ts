import { describe, expect, it } from "vitest";
import {
  nextDiscoveryBatch,
  RECIPE_SEEN_TOPIC,
  swipeToSignals,
  type SwipeSignalInput,
} from "./discover.js";

const card = (id: string) => ({ id, title: `Recipe ${id}` });

describe("nextDiscoveryBatch", () => {
  it("filters out already-seen ids", () => {
    const out = nextDiscoveryBatch([card("a"), card("b"), card("c")], ["b"]);
    expect(out.map((c) => c.id)).toEqual(["a", "c"]);
  });

  it("dedupes by id, first occurrence wins", () => {
    const out = nextDiscoveryBatch(
      [{ id: "a", title: "first" }, { id: "a", title: "second" }, { id: "b", title: "b" }],
      [],
    );
    expect(out).toEqual([{ id: "a", title: "first" }, { id: "b", title: "b" }]);
  });

  it("caps to the limit", () => {
    const many = Array.from({ length: 30 }, (_, i) => card(String(i)));
    expect(nextDiscoveryBatch(many, [], 12)).toHaveLength(12);
    expect(nextDiscoveryBatch(many, [], 5)).toHaveLength(5);
  });

  it("defaults the limit to 12", () => {
    const many = Array.from({ length: 30 }, (_, i) => card(String(i)));
    expect(nextDiscoveryBatch(many, [])).toHaveLength(12);
  });

  it("preserves input order", () => {
    const out = nextDiscoveryBatch([card("c"), card("a"), card("b")], []);
    expect(out.map((c) => c.id)).toEqual(["c", "a", "b"]);
  });

  it("handles empty candidates and empty seen", () => {
    expect(nextDiscoveryBatch([], [])).toEqual([]);
    expect(nextDiscoveryBatch([], ["a", "b"])).toEqual([]);
  });

  it("returns [] when everything is seen", () => {
    expect(nextDiscoveryBatch([card("a"), card("b")], ["a", "b"])).toEqual([]);
  });

  it("combines seen-filter, dedupe, order, and cap together", () => {
    const out = nextDiscoveryBatch(
      [card("x"), card("a"), card("a"), card("b"), card("x"), card("c")],
      ["b"],
      2,
    );
    // x kept (first), a deduped to first, b filtered (seen), cap at 2 → [x, a]
    expect(out.map((c) => c.id)).toEqual(["x", "a"]);
  });
});

describe("swipeToSignals", () => {
  const seen = (signals: SwipeSignalInput[]) =>
    signals.find((s) => s.topic === RECIPE_SEEN_TOPIC);
  const cuisine = (signals: SwipeSignalInput[]) =>
    signals.find((s) => s.topic.startsWith("cuisine:"));

  it("always emits a recipe_seen marker carrying the recipe id (neutral, valid source)", () => {
    for (const dir of ["like", "skip"] as const) {
      const out = swipeToSignals({ recipeId: "52772" }, dir);
      const s = seen(out);
      expect(s).toBeDefined();
      expect(s!.value).toBe("52772");
      expect(s!.polarity).toBe("neutral");
      expect(s!.confidence).toBe(1);
      expect(s!.topic).toBe("recipe_seen"); // unprefixed → ignored by projectUserModel
    }
  });

  it("with no cuisine, emits ONLY the recipe_seen signal", () => {
    expect(swipeToSignals({ recipeId: "1" }, "like")).toHaveLength(1);
    expect(swipeToSignals({ recipeId: "1" }, "skip")).toHaveLength(1);
  });

  it("like → positive cuisine affinity signal on the cuisine:<x> topic", () => {
    const out = swipeToSignals({ recipeId: "1", cuisine: "Thai" }, "like");
    const c = cuisine(out);
    expect(c).toBeDefined();
    expect(c!.topic).toBe("cuisine:thai"); // exact topic projectUserModel reads
    expect(c!.value).toBe("Thai");
    expect(c!.polarity).toBe("positive");
    expect(c!.confidence).toBe(0.5);
  });

  it("skip → negative cuisine affinity signal on the cuisine:<x> topic", () => {
    const out = swipeToSignals({ recipeId: "1", cuisine: "Italian" }, "skip");
    const c = cuisine(out);
    expect(c).toBeDefined();
    expect(c!.topic).toBe("cuisine:italian");
    expect(c!.polarity).toBe("negative");
    expect(c!.confidence).toBe(0.5);
  });

  it("ignores blank/whitespace cuisine (only the seen signal)", () => {
    expect(swipeToSignals({ recipeId: "1", cuisine: "   " }, "like")).toHaveLength(1);
  });
});
