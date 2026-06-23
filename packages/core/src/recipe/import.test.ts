import { describe, expect, it } from "vitest";
import {
  cleanIngredientName,
  extractRecipeJsonLd,
  fieldsToImportedRecipe,
  isPublicHttpUrl,
} from "./import.js";

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

describe("cleanIngredientName", () => {
  it("strips leading quantities and units", () => {
    expect(cleanIngredientName("2 tomatoes")).toBe("tomatoes");
    expect(cleanIngredientName("200 g chicken breast")).toBe("chicken breast");
    expect(cleanIngredientName("1 1/2 cups flour")).toBe("flour");
    expect(cleanIngredientName("½ tsp chili flakes")).toBe("chili flakes");
  });

  it("drops prep after a comma and the leading count+unit", () => {
    expect(cleanIngredientName("3 cloves garlic, thinly sliced")).toBe("garlic");
    expect(cleanIngredientName("garlic, minced")).toBe("garlic");
  });

  it("leaves a plain food name (or unrecognized text) intact", () => {
    expect(cleanIngredientName("olive oil")).toBe("olive oil");
    expect(cleanIngredientName("salt to taste")).toBe("salt to taste");
  });

  it("does NOT strip a leading unit word when no quantity preceded it (regression)", () => {
    expect(cleanIngredientName("gram flour")).toBe("gram flour"); // 'gram' = chickpea flour
    expect(cleanIngredientName("cans of tomatoes")).toBe("cans of tomatoes");
    expect(cleanIngredientName("g")).toBe("g"); // never collapses to empty
  });
});

describe("isPublicHttpUrl (SSRF guard)", () => {
  it("allows public http(s) URLs", () => {
    expect(isPublicHttpUrl("https://cooking.example.com/recipe")).toBe(true);
    expect(isPublicHttpUrl("http://example.org/r")).toBe(true);
  });

  it("blocks non-http schemes, loopback, private ranges, and cloud metadata", () => {
    expect(isPublicHttpUrl("file:///etc/passwd")).toBe(false);
    expect(isPublicHttpUrl("ftp://example.com")).toBe(false);
    expect(isPublicHttpUrl("http://localhost:3000/x")).toBe(false);
    expect(isPublicHttpUrl("http://127.0.0.1/x")).toBe(false);
    expect(isPublicHttpUrl("http://10.0.0.5/x")).toBe(false);
    expect(isPublicHttpUrl("http://192.168.1.1/x")).toBe(false);
    expect(isPublicHttpUrl("http://172.16.0.1/x")).toBe(false);
    expect(isPublicHttpUrl("http://169.254.169.254/latest/meta-data/")).toBe(false);
    expect(isPublicHttpUrl("http://metadata.google.internal/")).toBe(false);
    expect(isPublicHttpUrl("http://[::1]/x")).toBe(false);
    expect(isPublicHttpUrl("not a url")).toBe(false);
  });

  it("blocks IPv4-mapped IPv6 addresses that bypass the IPv4 range checks", () => {
    // Node's URL parser normalizes ::ffff:x.x.x.x to all-hex [::ffff:xxxx:xxxx],
    // so the plain 127./10./169.254. regexes above never match — explicit guard needed.
    expect(isPublicHttpUrl("http://[::ffff:127.0.0.1]/")).toBe(false);  // loopback
    expect(isPublicHttpUrl("http://[::ffff:10.0.0.1]/")).toBe(false);   // private class A
    expect(isPublicHttpUrl("http://[::ffff:169.254.169.254]/")).toBe(false); // cloud metadata
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
