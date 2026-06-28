import { getDb, withTenant } from "@gm/db";
import { captureToList, parseQuickCapture } from "@gm/core/capture";
import { verifyMobileToken } from "../_lib";
import { parseJsonBody, serverError } from "../../_lib/guard";
import { rateLimit, tooManyRequests } from "../../_lib/rate-limit";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const auth = req.headers.get("Authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) {
    return Response.json({ error: "Authorization header required" }, { status: 401 });
  }

  const userId = verifyMobileToken(token);
  if (!userId) {
    return Response.json({ error: "Invalid or expired token" }, { status: 401 });
  }

  const rl = rateLimit(`capture-write:${userId}`, 20, 60_000);
  if (!rl.allowed) return tooManyRequests(rl.retryAfterMs);

  const bodyOrErr = await parseJsonBody<{ text?: string }>(req);
  if (bodyOrErr instanceof Response) return bodyOrErr;
  const body = bodyOrErr;

  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) {
    return Response.json({ error: "text is required" }, { status: 400 });
  }
  if (text.length > 2_000) {
    return Response.json({ error: "text is too long (max 2000 characters)" }, { status: 400 });
  }

  const items = parseQuickCapture(text);
  if (items.length === 0) {
    return Response.json({ added: 0, listId: null });
  }

  try {
    const result = await withTenant(getDb(), userId, (tx) => captureToList(tx, userId, items));
    return Response.json(result);
  } catch (err) {
    return serverError("mobile/capture POST", err);
  }
}
