import { importRecipeAction } from "./actions";
import { ImportRecipe } from "./import-recipe";

export const dynamic = "force-dynamic";

export default function ImportPage() {
  return (
    <main className="page">
      <a href="/recipes" className="back-link">
        <span aria-hidden>←</span> Recipes
      </a>
      <div className="mt-4 mb-6 animate-fade-in-up">
        <p className="eyebrow">Import a recipe</p>
        <h1 className="page-title mt-2">Import a recipe</h1>
        <p className="page-subtitle">
          Paste a link, snap a cookbook page, or paste the text — it&apos;s structured, matched to
          your pantry, and ready to cook hands-free.
        </p>
      </div>
      <ImportRecipe action={importRecipeAction} />
    </main>
  );
}
