import { getDb, withTenant } from "@gm/db";
import { captureToList, parseQuickCapture } from "@gm/core/capture";
import { verifyMobileToken } from "../_lib";

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

  let body: { text?: string };
  try {
    body = (await req.json()) as { text?: string };
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) {
    return Response.json({ error: "text is required" }, { status: 400 });
  }

  const items = parseQuickCapture(text);
  if (items.length === 0) {
    return Response.json({ added: 0, listId: null });
  }

  const result = await withTenant(getDb(), userId, (tx) => captureToList(tx, userId, items));
  return Response.json(result);
}
