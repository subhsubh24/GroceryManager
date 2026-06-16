import { importRecipeAction } from "./actions";
import { ImportRecipe } from "./import-recipe";
import { PageHeader } from "@/app/components/page-header";

export const dynamic = "force-dynamic";

export default function ImportPage() {
  return (
    <main className="page">
      <PageHeader
        accent="citrus"
        emoji="📥"
        eyebrow="Import a recipe"
        title="Import a recipe"
        subtitle={
          <>
            Paste a link, snap a cookbook page, or paste the text — it&apos;s structured, matched to
            your pantry, and ready to cook hands-free.
          </>
        }
        back={{ href: "/recipes", label: "Recipes" }}
      />
      <div className="mt-6">
        <ImportRecipe action={importRecipeAction} />
      </div>
    </main>
  );
}
