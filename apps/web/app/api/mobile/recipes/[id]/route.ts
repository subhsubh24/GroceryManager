import { getDb, loadRecipeForCook } from "@gm/db";
import { TheMealDBProvider } from "@gm/core/recipe";
import { verifyMobileToken } from "../../_lib";
import { serverError } from "../../../_lib/guard";
import { rateLimit, tooManyRequests } from "../../../_lib/rate-limit";

export const runtime = "nodejs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = req.headers.get("Authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) {
    return Response.json({ error: "Authorization header required" }, { status: 401 });
  }

  const userId = verifyMobileToken(token);
  if (!userId) {
    return Response.json({ error: "Invalid or expired token" }, { status: 401 });
  }

  const rl = rateLimit(`recipe-detail-read:${userId}`, 60, 60_000);
  if (!rl.allowed) return tooManyRequests(rl.retryAfterMs);

  const { id } = await params;
  if (!id) return Response.json({ error: "Recipe id required" }, { status: 400 });

  try {
    const recipe = UUID.test(id)
      ? await loadRecipeForCook(getDb(), id)
      : await new TheMealDBProvider().getById(id);

    if (!recipe) return Response.json({ error: "Recipe not found" }, { status: 404 });

    return Response.json({ recipe });
  } catch (err) {
    // A transient DB failure or upstream TheMealDB error must not escape as an uncaught 500
    // (an HTML error page to a JSON mobile client). Log server-side (G3) + return a controlled JSON error.
    return serverError("mobile/recipes-detail", err);
  }
}
