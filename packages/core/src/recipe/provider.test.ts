import { describe, expect, it } from "vitest";
import { mapMealDbMeal } from "./provider.js";

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
