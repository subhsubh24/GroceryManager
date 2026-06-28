import { deregisterMobilePushToken, getDb, registerMobilePushToken, withTenant } from "@gm/db";
import { verifyMobileToken } from "../_lib";
import { rateLimit, tooManyRequests } from "../../_lib/rate-limit";
import { parseJsonBody } from "../../_lib/guard";

export const runtime = "nodejs";

function extractUserId(req: Request): string | null {
  const h = req.headers.get("Authorization");
  if (!h?.startsWith("Bearer ")) return null;
  return verifyMobileToken(h.slice(7));
}

/** POST /api/mobile/push-token — register an Expo push token for the signed-in device. */
export async function POST(req: Request) {
  const userId = extractUserId(req);
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const rl = rateLimit(`push-token-write:${userId}`, 30, 60_000);
  if (!rl.allowed) return tooManyRequests(rl.retryAfterMs);

  // G2: bounded body parse (32 KB cap) instead of an unbounded req.json().
  const bodyOrErr = await parseJsonBody<unknown>(req);
  if (bodyOrErr instanceof Response) return bodyOrErr;
  const body = bodyOrErr;

  const token =
    typeof (body as Record<string, unknown>).token === "string"
      ? ((body as Record<string, unknown>).token as string)
      : "";
  const deviceId =
    typeof (body as Record<string, unknown>).deviceId === "string"
      ? ((body as Record<string, unknown>).deviceId as string)
      : null;

  // Validate Expo push token format: ExponentPushToken[<10–64 base64url chars>]
  if (!/^ExponentPushToken\[[A-Za-z0-9_-]{10,64}\]$/.test(token)) {
    return Response.json({ error: "token must be a valid Expo push token" }, { status: 400 });
  }

  if (deviceId !== null && deviceId.length > 200) {
    return Response.json({ error: "deviceId too long" }, { status: 400 });
  }

  try {
    await withTenant(getDb(), userId, (tx) =>
      registerMobilePushToken(tx, { userId, token, deviceId }),
    );
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Failed to register token" }, { status: 500 });
  }
}

/** DELETE /api/mobile/push-token — deregister a token on sign-out or token rotation. */
export async function DELETE(req: Request) {
  const userId = extractUserId(req);
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const rl = rateLimit(`push-token-delete:${userId}`, 30, 60_000);
  if (!rl.allowed) return tooManyRequests(rl.retryAfterMs);

  // G2: bounded body parse (32 KB cap) instead of an unbounded req.json().
  const bodyOrErr = await parseJsonBody<unknown>(req);
  if (bodyOrErr instanceof Response) return bodyOrErr;
  const body = bodyOrErr;

  const token =
    typeof (body as Record<string, unknown>).token === "string"
      ? ((body as Record<string, unknown>).token as string)
      : "";
  if (!/^ExponentPushToken\[[A-Za-z0-9_-]{10,64}\]$/.test(token)) {
    return Response.json({ error: "token must be a valid Expo push token" }, { status: 400 });
  }

  try {
    await withTenant(getDb(), userId, (tx) =>
      deregisterMobilePushToken(tx, { userId, token }),
    );
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Failed to deregister token" }, { status: 500 });
  }
}
