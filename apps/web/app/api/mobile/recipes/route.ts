import { getDb, loadSavedRecipes, withTenant } from "@gm/db";
import { dedupeSaved } from "@gm/core/recipe";
import { verifyMobileToken } from "../_lib";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const auth = req.headers.get("Authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return Response.json({ error: "Authorization header required" }, { status: 401 });
  const userId = verifyMobileToken(token);
  if (!userId) return Response.json({ error: "Invalid or expired token" }, { status: 401 });
  const rows = await withTenant(getDb(), userId, (tx) => loadSavedRecipes(tx, userId));
  const recipes = dedupeSaved(rows);
  return Response.json({ recipes });
}
