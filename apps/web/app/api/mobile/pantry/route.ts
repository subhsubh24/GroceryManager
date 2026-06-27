import { getDb, getPantryView, withTenant } from "@gm/db";
import { verifyMobileToken } from "../_lib";
import { serverError } from "../../_lib/guard";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const auth = req.headers.get("Authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) {
    return Response.json({ error: "Authorization header required" }, { status: 401 });
  }

  const userId = verifyMobileToken(token);
  if (!userId) {
    return Response.json({ error: "Invalid or expired token" }, { status: 401 });
  }

  try {
    const items = await withTenant(getDb(), userId, (tx) => getPantryView(tx, userId));
    return Response.json({ items });
  } catch (err) {
    return serverError("mobile/pantry", err);
  }
}
