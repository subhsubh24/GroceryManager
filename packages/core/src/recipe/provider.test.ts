import { describe, expect, it } from "vitest";
import { mapMealDbMeal } from "./provider.js";

describe("mapMealDbMeal", () => {
  it("extracts populated ingredients and skips empties", () => {
    const meal = {
      idMeal: "52772",
      strMeal: "Teriyaki Chicken Casserole",
      strMealThumb: "https://img/teriyaki.jpg",
      strIngredient1: "soy sauce",
      strIngredient2: "water",
      strIngredient3: "  ",
      strIngredient4: "chicken breasts",
      strIngredient5: "",
      strIngredient6: null,
    };
    const r = mapMealDbMeal(meal);
    expect(r.id).toBe("52772");
    expect(r.title).toBe("Teriyaki Chicken Casserole");
    expect(r.imageUrl).toBe("https://img/teriyaki.jpg");
    expect(r.ingredients.map((i) => i.name)).toEqual(["soy sauce", "water", "chicken breasts"]);
  });
});
