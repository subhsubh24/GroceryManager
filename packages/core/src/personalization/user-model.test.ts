import { describe, expect, it } from "vitest";
import {
  projectUserModel,
  signalFromAllergen,
  signalFromCooked,
  signalFromOnboardingDiet,
  signalFromReorder,
  signalFromSkip,
  signalFromWaste,
  type PreferenceSignalInput,
} from "./user-model.js";

describe("projectUserModel", () => {
  it("captures onboarding diets + allergens", () => {
    const m = projectUserModel([signalFromOnboardingDiet("vegetarian"), signalFromAllergen("peanut")]);
    expect(m.diets).toContain("vegetarian");
    expect(m.allergens).toContain("peanut");
  });

  it("accumulates cuisine affinity from behavior (net positive → loved)", () => {
    const m = projectUserModel([
      signalFromCooked("thai"),
      signalFromCooked("thai"),
      signalFromCooked("thai"),
      signalFromSkip("thai"),
    ]);
    expect(m.cuisineAffinity.thai).toBeGreaterThan(0);
    expect(m.loves).toContain("cuisine:thai");
  });

  it("flags a disliked ingredient from repeated waste", () => {
    const m = projectUserModel([
      signalFromWaste("cilantro"),
      signalFromWaste("cilantro"),
    ]);
    expect(m.dislikes).toContain("cilantro");
  });

  it("net evidence can flip: enough reorders outweigh one waste", () => {
    const signals: PreferenceSignalInput[] = [
      signalFromWaste("kale"),
      signalFromReorder("kale"),
      signalFromReorder("kale"),
    ];
    const m = projectUserModel(signals);
    expect(m.dislikes).not.toContain("kale");
    expect(m.confidencePerField["ingredient:kale"]).toBeGreaterThan(0);
  });

  it("records quality preferences (organic)", () => {
    const m = projectUserModel([{ topic: "quality:organic", polarity: "positive", confidence: 0.6 }]);
    expect(m.qualityPrefs.organic).toBe(true);
  });
});
