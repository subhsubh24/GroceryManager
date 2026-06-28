import { getAdminDb, getUserIdByEmail, recordEmailOptOut } from "@gm/db";
import { verifyUnsubscribeToken } from "@gm/core/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Minimal branded HTML page (no session, no app shell — this is reached from an email client). */
function page(title: string, message: string, status = 200): Response {
  const body = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
<body style="margin:0;background:#f6f7f8;font:400 16px/1.6 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1d2530;">
  <div style="max-width:440px;margin:64px auto;padding:28px;background:#fff;border:1px solid #e6e8ea;border-radius:14px;">
    <p style="margin:0 0 12px;font:600 15px/1.2 inherit;color:#0c8a3e;">GroceryManager</p>
    <h1 style="margin:0 0 10px;font:700 20px/1.3 inherit;">${title}</h1>
    <p style="margin:0;color:#525d6a;">${message}</p>
  </div>
</body></html>`;
  return new Response(body, { status, headers: { "content-type": "text/html; charset=utf-8" } });
}

/**
 * CAN-SPAM unsubscribe (GET, idempotent, double-click safe). The link carries an HMAC-signed token
 * over the recipient email; we verify it before recording an `email_optout` signal that the
 * lifecycle campaign queries honor. We always show a generic success once the token verifies (no
 * email-existence enumeration).
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const email = url.searchParams.get("email");
  const token = url.searchParams.get("token");

  if (!email || !token || !verifyUnsubscribeToken(email, token)) {
    return page("Invalid link", "This unsubscribe link is invalid or has expired.", 400);
  }

  try {
    const admin = getAdminDb();
    const userId = await getUserIdByEmail(admin, email);
    if (userId) await recordEmailOptOut(admin, userId);
  } catch (e) {
    console.error("[email/unsubscribe]", e);
    // Fall through to the generic success page — never leak internals to the caller.
  }

  return page(
    "You're unsubscribed",
    "You won't receive lifecycle emails from GroceryManager anymore. You can still use the app as normal.",
  );
}
