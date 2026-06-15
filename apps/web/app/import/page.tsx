import { importRecipeAction } from "./actions";
import { ImportRecipe } from "./import-recipe";

export const dynamic = "force-dynamic";

export default function ImportPage() {
  return (
    <main className="mx-auto min-h-dvh max-w-3xl px-5 pb-16 pt-8">
      <a href="/recipes" className="text-sm text-brand-600">← Recipes</a>
      <h1 className="mt-2 mb-1 text-2xl font-bold text-ink">Import a recipe</h1>
      <p className="mb-6 text-sm text-ink/60">
        Paste a link, snap a cookbook page, or paste the text — it&apos;s structured, matched to your
        pantry, and ready to cook hands-free.
      </p>
      <ImportRecipe action={importRecipeAction} />
    </main>
  );
}
