import { describe, expect, it } from "vitest";
import {
  projectUserModel,
  signalFromAllergen,
  signalFromCooked,
  signalFromOnboardingDiet,
  signalFromProfileAge,
  signalFromProfileGender,
  signalFromProfileName,
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

  it("accumulates cuisine affinity from behavior (net negative → disliked)", () => {
    // Mirror of the "loved" case: repeated skips drive net affinity below the −0.3 dislike threshold
    // (3 skips → net −0.45 → tanh ≈ −0.42), so the cuisine becomes an anti-preference the recommender
    // steers away from — not merely absent from `loves`.
    const m = projectUserModel([
      signalFromSkip("thai"),
      signalFromSkip("thai"),
      signalFromSkip("thai"),
    ]);
    expect(m.cuisineAffinity.thai).toBeLessThan(-0.3);
    expect(m.dislikes).toContain("cuisine:thai");
    expect(m.loves).not.toContain("cuisine:thai");
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

  it("projects profile facts (name / age / gender) from profile:* signals", () => {
    const m = projectUserModel([
      signalFromProfileName("Ada"),
      signalFromProfileAge(34),
      signalFromProfileGender("female"),
    ]);
    expect(m.name).toBe("Ada");
    expect(m.ageYears).toBe(34);
    expect(m.gender).toBe("female");
  });

  it("a higher-confidence profile edit overrides the original value", () => {
    const m = projectUserModel([
      signalFromProfileAge(34, 0.9), // signup
      signalFromProfileAge(35, 0.99), // later profile edit wins
    ]);
    expect(m.ageYears).toBe(35);
  });

  it("ignores a blank or non-numeric profile fact", () => {
    const m = projectUserModel([
      signalFromProfileName("  "),
      { topic: "profile:age", value: "not-a-number", polarity: "neutral", confidence: 0.9 },
    ]);
    expect(m.name).toBeUndefined();
    expect(m.ageYears).toBeUndefined();
  });
});
