import { loadRecipeAnySource } from "@/app/lib/recipe";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!id) return Response.json({ error: "Recipe id required" }, { status: 400 });
  const recipe = await loadRecipeAnySource(id);
  if (!recipe) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ recipe });
}
