import { deleteUserAndAllData, getAdminDb } from "@gm/db";
import { verifyMobileToken } from "../_lib";
import { parseJsonBody, serverError } from "../../_lib/guard";

export const runtime = "nodejs";

/**
 * DELETE /api/mobile/account
 * Body: { confirm: "delete" }
 *
 * Erases all user data via ON DELETE CASCADE. Requires the authenticated user to confirm
 * by sending `"delete"` in the request body — same pattern as the web /profile page.
 */
export async function DELETE(req: Request) {
  const auth = req.headers.get("Authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) {
    return Response.json({ error: "Authorization header required" }, { status: 401 });
  }

  const userId = verifyMobileToken(token);
  if (!userId) {
    return Response.json({ error: "Invalid or expired token" }, { status: 401 });
  }

  const bodyOrErr = await parseJsonBody<{ confirm?: string }>(req);
  if (bodyOrErr instanceof Response) return bodyOrErr;
  const body = bodyOrErr;

  // Server-side confirmation check — never trust the client to skip this.
  if (typeof body.confirm !== "string" || body.confirm.trim().toLowerCase() !== "delete") {
    return Response.json({ error: "Confirmation required: send { confirm: \"delete\" }" }, { status: 422 });
  }

  try {
    await deleteUserAndAllData(getAdminDb(), userId);
    return Response.json({ deleted: true });
  } catch (err) {
    return serverError("mobile/account DELETE", err);
  }
}
