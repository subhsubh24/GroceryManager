/**
 * PUBLIC, no-account "try the aha" demo endpoint (ROADMAP §34).
 *
 * Runs ONE real Gemini receipt extraction for an anonymous visitor and returns the parsed line items
 * — nothing is written to the DB, no account, no user data. This is the single AI surface a stranger
 * can reach, so it is hardened like a paid endpoint (Track G / G1+G5+G7), in this order:
 *
 *   1. per-IP rate limit          (rate-limit.ts)         — burst control
 *   2. captcha                    (verifyTurnstile)       — bot gate (fail-open until owner sets key)
 *   3. Gemini key present?        (loadEnv)               — else degrade to a calm 503, never a crash
 *   4. bounded input validation   (size caps below)       — no oversized payloads reach the model
 *   5. per-IP + GLOBAL daily cap  (checkDemoQuota)        — the code-level SPEND CEILING (wallet-drain)
 *   6. single cheap-tier extract  (maxAttempts: 1)        — no escalation to pro; bounded cost
 *
 * The quota is reserved as LATE as possible (only once we're about to spend and the input is valid),
 * so denied/invalid requests never consume the demo budget. Error responses are calm and generic —
 * they never leak a schema, stack, or model detail.
 */
import { loadEnv } from "@gm/config/env";
import { GeminiClient } from "@gm/core/llm";
import { cleanReceiptText, extractReceipt, extractReceiptImage } from "@gm/core/ingestion";
import { checkDemoQuota } from "@gm/core/security/demo-quota";
import { rateLimit, tooManyRequests } from "@/app/api/_lib/rate-limit";
import { verifyTurnstile } from "@/app/api/_lib/captcha";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// One cheap vision/text extraction — give it room beyond the 10s default, but keep it well under a
// serverless deadline so a slow model can't hang the function.
export const maxDuration = 30;

const MAX_TEXT_CHARS = 8_000;
const MAX_IMAGE_BYTES = 2 * 1024 * 1024; // 2 MB — one photo of a receipt
const MAX_RETURNED_ITEMS = 40;

const NO_STORE = { "Cache-Control": "no-store", "Content-Type": "application/json" } as const;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...NO_STORE } });
}

/** First hop of x-forwarded-for (Vercel sets it), falling back to x-real-ip. */
function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

interface DemoItem {
  name: string;
  quantity: number | null;
  unit: string | null;
}

export async function POST(req: Request): Promise<Response> {
  const ip = clientIp(req);

  // 1. Burst rate limit (per IP).
  const rl = rateLimit(`demo-parse:${ip}`, 3, 60_000);
  if (!rl.allowed) return tooManyRequests(rl.retryAfterMs);

  // Read the payload once (JSON text paste OR multipart photo upload).
  let text: string | undefined;
  let image: { mimeType: string; dataBase64: string } | undefined;
  let captchaToken: string | null | undefined;

  const contentType = req.headers.get("content-type") ?? "";
  try {
    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("photo");
      captchaToken = (form.get("cf-turnstile-response") as string | null) ?? undefined;
      if (file instanceof File && file.size > 0) {
        if (file.size > MAX_IMAGE_BYTES) {
          return json({ error: "That image is too large — please use a photo under 2 MB." }, 413);
        }
        if (!file.type.startsWith("image/")) {
          return json({ error: "Please upload an image of a receipt." }, 400);
        }
        image = {
          mimeType: file.type || "image/jpeg",
          dataBase64: Buffer.from(await file.arrayBuffer()).toString("base64"),
        };
      }
    } else {
      const body = (await req.json()) as { text?: unknown; captchaToken?: unknown };
      captchaToken = typeof body.captchaToken === "string" ? body.captchaToken : undefined;
      if (typeof body.text === "string") text = body.text;
    }
  } catch {
    return json({ error: "Couldn't read that request. Please try again." }, 400);
  }

  // 2. Captcha (fail-open until the owner configures Turnstile; present so it enforces once set).
  const captcha = await verifyTurnstile(captchaToken);
  if (!captcha.success && !captcha.skipped) {
    return json({ error: "Bot check failed — please retry." }, 400);
  }

  // 3. Degrade cleanly when no model is configured (keyless CI / dev) — never a crash or fake success.
  const env = loadEnv();
  if (!env.GEMINI_API_KEY && !env.GOOGLE_VERTEX_PROJECT) {
    return json(
      { error: "The live demo is warming up — join the waitlist and we'll email you when it's ready." },
      503,
    );
  }

  // 4. Bounded input validation.
  if (image) {
    // already size/mime-checked above
  } else if (text !== undefined) {
    const trimmed = text.trim();
    if (trimmed.length === 0) return json({ error: "Paste some receipt text to try the demo." }, 400);
    if (trimmed.length > MAX_TEXT_CHARS) {
      return json({ error: "That's a lot of text — paste a single receipt (under 8,000 characters)." }, 400);
    }
    text = trimmed;
  } else {
    return json({ error: "Paste receipt text or upload a photo to try the demo." }, 400);
  }

  // 5. SPEND CEILING — reserve a slot (per-IP + global daily). Reserved only now, right before we
  //    actually spend, so nothing above rejects after consuming budget.
  const quota = checkDemoQuota(ip);
  if (!quota.allowed) {
    const msg =
      quota.reason === "global"
        ? "The free demo has hit today's limit — join the waitlist for full, unlimited access."
        : "You've used today's free demo runs — join the waitlist for the full app.";
    return json({ error: msg, limited: true }, 429);
  }

  // 6. One cheap-tier extraction, no escalation (maxAttempts: 1) → bounded cost. Best-effort: any
  //    failure maps to a calm, generic message (never leaks the model/schema/stack).
  try {
    const client = new GeminiClient(env);
    const extraction = image
      ? await extractReceiptImage(client, [image], { maxAttempts: 1 })
      : await extractReceipt(client, cleanReceiptText(text!), { maxAttempts: 1 });

    const items: DemoItem[] = extraction.value.lineItems
      .slice(0, MAX_RETURNED_ITEMS)
      .map((li) => ({ name: li.name, quantity: li.quantity, unit: li.unitText }))
      .filter((i) => i.name.trim().length > 0);

    if (items.length === 0) {
      return json({
        error: "Couldn't find items on that receipt — try a clearer photo or a different receipt.",
      });
    }
    return json({ items, retailer: extraction.value.retailer });
  } catch {
    return json(
      { error: "The demo couldn't read that one. Give it another try with a clear receipt." },
      502,
    );
  }
}

// Only POST is meaningful; make other verbs explicit 405s rather than Next's default handling.
export function GET(): Response {
  return json({ error: "Method not allowed." }, 405);
}
