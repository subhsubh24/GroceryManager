import { describe, expect, it } from "vitest";
import { extractRecipeJsonLd, fieldsToImportedRecipe } from "./import.js";

const page = (jsonLd: unknown) =>
  `<html><head><script type="application/ld+json">${JSON.stringify(jsonLd)}</script></head><body>x</body></html>`;

describe("extractRecipeJsonLd", () => {
  it("parses a standard schema.org Recipe with string instructions", () => {
    const r = extractRecipeJsonLd(
      page({
        "@context": "https://schema.org",
        "@type": "Recipe",
        name: "Tomato Soup",
        image: "https://x/img.jpg",
        recipeYield: "4 servings",
        recipeIngredient: ["2 tomatoes", "1 onion", " "],
        recipeInstructions: "Chop.\nSimmer.",
      }),
      "https://x/soup",
    );
    expect(r).not.toBeNull();
    expect(r!.title).toBe("Tomato Soup");
    expect(r!.imageUrl).toBe("https://x/img.jpg");
    expect(r!.servings).toBe("4 servings");
    expect(r!.sourceUrl).toBe("https://x/soup");
    expect(r!.ingredients).toEqual([{ name: "2 tomatoes" }, { name: "1 onion" }]); // blank dropped
    expect(r!.instructions).toBe("Chop.\nSimmer.");
  });

  it("handles @graph wrapper, @type array, HowToStep instructions, and ImageObject", () => {
    const r = extractRecipeJsonLd(
      page({
        "@graph": [
          { "@type": "WebSite", name: "Food Site" },
          {
            "@type": ["Recipe", "NewsArticle"],
            name: "Pancakes",
            image: { "@type": "ImageObject", url: "https://x/p.jpg" },
            recipeYield: 8,
            recipeIngredient: ["flour", "eggs"],
            recipeInstructions: [
              { "@type": "HowToStep", text: "Mix batter." },
              { "@type": "HowToStep", text: "Cook on griddle." },
            ],
          },
        ],
      }),
    );
    expect(r!.title).toBe("Pancakes");
    expect(r!.imageUrl).toBe("https://x/p.jpg");
    expect(r!.servings).toBe("8");
    expect(r!.instructions).toBe("Mix batter.\nCook on griddle.");
  });

  it("flattens HowToSection itemListElement into steps", () => {
    const r = extractRecipeJsonLd(
      page({
        "@type": "Recipe",
        name: "Cake",
        recipeIngredient: ["sugar"],
        recipeInstructions: [
          {
            "@type": "HowToSection",
            itemListElement: [
              { "@type": "HowToStep", text: "Prep." },
              { "@type": "HowToStep", text: "Bake." },
            ],
          },
        ],
      }),
    );
    expect(r!.instructions).toBe("Prep.\nBake.");
  });

  it("returns null when there's no Recipe node or no name", () => {
    expect(extractRecipeJsonLd(page({ "@type": "WebPage", name: "Not a recipe" }))).toBeNull();
    expect(extractRecipeJsonLd("<html><body>no json-ld here</body></html>")).toBeNull();
    expect(extractRecipeJsonLd('<script type="application/ld+json">{ broken json</script>')).toBeNull();
  });
});

describe("fieldsToImportedRecipe", () => {
  it("joins steps, trims, drops blank ingredients, and keeps measures", () => {
    const r = fieldsToImportedRecipe(
      {
        title: "  Stew ",
        servings: "6",
        ingredients: [
          { name: " beef ", measure: " 500 g " },
          { name: "salt", measure: null },
          { name: "  ", measure: "x" },
        ],
        instructions: ["  Brown the beef. ", "", "Simmer 2 hours."],
      },
      "https://x/stew",
    );
    expect(r.title).toBe("Stew");
    expect(r.servings).toBe("6");
    expect(r.sourceUrl).toBe("https://x/stew");
    expect(r.instructions).toBe("Brown the beef.\nSimmer 2 hours.");
    expect(r.ingredients).toEqual([
      { name: "beef", measure: "500 g" },
      { name: "salt", measure: undefined },
    ]);
  });
});
