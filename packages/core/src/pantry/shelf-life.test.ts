import { describe, expect, it } from "vitest";
import { estimateShelfLife, matchShelfLifeRule } from "./shelf-life.js";

describe("matchShelfLifeRule", () => {
  it("returns an estimate for a KNOWN item (so it never needs the LLM)", () => {
    expect(matchShelfLifeRule("organic hass avocados")).not.toBeNull();
    expect(matchShelfLifeRule("whole milk")?.perishability).toBe("perishable");
  });

  it("returns null for an UNKNOWN item (the signal to ask the LLM instead of defaulting)", () => {
    expect(matchShelfLifeRule("fresh mozzarella di bufala")).toBeNull();
    expect(matchShelfLifeRule("zalabia")).toBeNull();
  });

  it("estimateShelfLife falls back to the generic default for unknowns", () => {
    expect(estimateShelfLife("zalabia").perishability).toBe("semi_perishable");
  });
});

describe("estimateShelfLife", () => {
  it("soft produce → perishable, short fridge life", () => {
    const a = estimateShelfLife("organic hass avocados");
    expect(a.domain).toBe("grocery");
    expect(a.perishability).toBe("perishable");
    expect(a.shelfLifeFridgeDays).not.toBeNull();
    expect(a.shelfLifeFridgeDays!).toBeLessThanOrEqual(10);
  });

  it("dairy → perishable", () => {
    expect(estimateShelfLife("whole milk").perishability).toBe("perishable");
  });

  it("meat → perishable, very short fridge life", () => {
    const m = estimateShelfLife("boneless chicken breast");
    expect(m.perishability).toBe("perishable");
    expect(m.shelfLifeFridgeDays!).toBeLessThanOrEqual(5);
  });

  it("personal-care items → personal_care domain, shelf-stable, no spoilage ceiling", () => {
    const w = estimateShelfLife("flushable wipes");
    expect(w.domain).toBe("personal_care");
    expect(w.perishability).toBe("shelf_stable");
    expect(w.shelfLifeFridgeDays).toBeNull();
    expect(w.shelfLifePantryDays).toBeNull();
  });

  it("cleaning supplies → household, shelf-stable", () => {
    const d = estimateShelfLife("laundry detergent");
    expect(d.domain).toBe("household");
    expect(d.perishability).toBe("shelf_stable");
  });

  it("dry + canned staples → shelf-stable grocery", () => {
    expect(estimateShelfLife("jasmine rice").perishability).toBe("shelf_stable");
    expect(estimateShelfLife("canned black beans").perishability).toBe("shelf_stable");
  });

  it("peanut butter is shelf-stable, not dairy", () => {
    expect(estimateShelfLife("peanut butter").perishability).toBe("shelf_stable");
  });

  it("supplements → supplement domain", () => {
    expect(estimateShelfLife("vitamin d3 gummies").domain).toBe("supplement");
  });

  it("unknown grocery → semi-perishable default with a months-long window (ages out a stale backfill)", () => {
    const u = estimateShelfLife("zorblax widget");
    expect(u.domain).toBe("grocery");
    expect(u.perishability).toBe("semi_perishable");
    expect(u.shelfLifePantryDays!).toBeGreaterThan(30);
  });
});
