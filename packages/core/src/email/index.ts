/**
 * Provider-agnostic email sender (H2 Email lifecycle runner).
 * Fail-open (no-op with warning) when no provider key is set.
 * Tries RESEND_API_KEY → SENDGRID_API_KEY → POSTMARK_API_KEY in order.
 * Uses fetch + JSON only — no SDKs.
 */
import { createHmac, timingSafeEqual, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

export interface EmailPayload {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  listUnsubscribeUrl?: string;
}

export interface EmailResult {
  sent: boolean;
  skipped: boolean;
  reason?: string;
  messageId?: string;
}

// ─── Unsubscribe tokens ────────────────────────────────────────────────────

function getUnsubscribeSecret(): string {
  return process.env["EMAIL_UNSUBSCRIBE_SECRET"] ?? "gm-unsub-fallback-secret-do-not-use-in-prod";
}

/**
 * Generates a signed unsubscribe token (HMAC-SHA256 of email).
 * Uses EMAIL_UNSUBSCRIBE_SECRET env or a safe fallback for dev.
 */
export function generateUnsubscribeToken(email: string): string {
  return createHmac("sha256", getUnsubscribeSecret())
    .update(email.toLowerCase().trim())
    .digest("hex");
}

/**
 * Verifies an unsubscribe token. Uses timing-safe comparison to prevent timing attacks.
 */
export function verifyUnsubscribeToken(email: string, token: string): boolean {
  const expected = generateUnsubscribeToken(email);
  try {
    return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(token, "hex"));
  } catch {
    return false;
  }
}

// ─── Sender identity ─────────────────────────────────────────────────────────

const DEFAULT_FROM_EMAIL = "noreply@grocerymanager.app";
const DEFAULT_FROM_NAME = "GroceryManager";

/** Sender address — owner-configurable via EMAIL_FROM, defaults to the brand no-reply. */
export function getFromEmail(): string {
  const v = process.env["EMAIL_FROM"]?.trim();
  return v && v.length > 0 ? v : DEFAULT_FROM_EMAIL;
}

/** Sender display name — owner-configurable via EMAIL_FROM_NAME, defaults to the brand. */
export function getFromName(): string {
  const v = process.env["EMAIL_FROM_NAME"]?.trim();
  return v && v.length > 0 ? v : DEFAULT_FROM_NAME;
}

// ─── Provider implementations ──────────────────────────────────────────────

async function sendViaResend(
  payload: EmailPayload,
  apiKey: string,
): Promise<EmailResult> {
  const headers: Record<string, string> = {
    "Authorization": `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
  if (payload.listUnsubscribeUrl) {
    headers["List-Unsubscribe"] = `<${payload.listUnsubscribeUrl}>`;
  }

  const body: Record<string, unknown> = {
    from: `${getFromName()} <${getFromEmail()}>`,
    to: [payload.to],
    subject: payload.subject,
    html: payload.html,
    text: payload.text,
  };
  if (payload.replyTo) body["reply_to"] = payload.replyTo;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => res.statusText);
    return { sent: false, skipped: false, reason: `resend:${res.status} ${errText}` };
  }

  const data = (await res.json()) as { id?: string };
  return { sent: true, skipped: false, messageId: data.id };
}

async function sendViaSendgrid(
  payload: EmailPayload,
  apiKey: string,
): Promise<EmailResult> {
  const headers: Record<string, string> = {
    "Authorization": `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
  if (payload.listUnsubscribeUrl) {
    headers["List-Unsubscribe"] = `<${payload.listUnsubscribeUrl}>`;
  }

  const body: Record<string, unknown> = {
    personalizations: [{ to: [{ email: payload.to }] }],
    from: { email: getFromEmail(), name: getFromName() },
    subject: payload.subject,
    content: [
      { type: "text/plain", value: payload.text },
      { type: "text/html", value: payload.html },
    ],
  };
  if (payload.replyTo) {
    (body as Record<string, unknown>)["reply_to"] = { email: payload.replyTo };
  }

  const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => res.statusText);
    return { sent: false, skipped: false, reason: `sendgrid:${res.status} ${errText}` };
  }

  const messageId = res.headers.get("X-Message-Id") ?? undefined;
  return { sent: true, skipped: false, messageId };
}

async function sendViaPostmark(
  payload: EmailPayload,
  apiKey: string,
): Promise<EmailResult> {
  const headers: Record<string, string> = {
    "X-Postmark-Server-Token": apiKey,
    "Content-Type": "application/json",
  };
  if (payload.listUnsubscribeUrl) {
    headers["List-Unsubscribe"] = `<${payload.listUnsubscribeUrl}>`;
  }

  const body: Record<string, unknown> = {
    From: `${getFromName()} <${getFromEmail()}>`,
    To: payload.to,
    Subject: payload.subject,
    HtmlBody: payload.html,
    TextBody: payload.text,
  };
  if (payload.replyTo) body["ReplyTo"] = payload.replyTo;

  const res = await fetch("https://api.postmarkapp.com/email", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => res.statusText);
    return { sent: false, skipped: false, reason: `postmark:${res.status} ${errText}` };
  }

  const data = (await res.json()) as { MessageID?: string };
  return { sent: true, skipped: false, messageId: data.MessageID };
}

// ─── Test/CI capture transport (side-effect ROUND-TRIP, ROADMAP F4.1) ────────

/**
 * The capture transport writes each outgoing email to a directory as JSON instead of dispatching it
 * to a real provider, so the e2e journey suite can prove a GENUINE round-trip (submit → email LEAVES
 * → RETRIEVE it from the sink → follow the confirm link → confirmed) without standing up Mailpit/an
 * SMTP server (both egress-blocked here) and without spending on a real provider.
 *
 * Activated ONLY by an explicit `EMAIL_CAPTURE_DIR` env var. It is TEST/CI ONLY: if it is ever set in
 * a real PRODUCTION runtime it FAILS CLOSED (throws) rather than silently diverting every customer
 * email to disk (an undelivered-email outage). Mirrors the rate-limit bypass guard.
 *
 * Allowed: CI (`CI=true`) and non-production runtimes. HARD-REFUSED (throws): Vercel production
 * (`VERCEL_ENV=production`) and any other `NODE_ENV=production` runtime that isn't CI.
 */
export function resolveEmailCaptureDir(env: {
  EMAIL_CAPTURE_DIR?: string;
  CI?: string;
  VERCEL_ENV?: string;
  NODE_ENV?: string;
}): string | null {
  const dir = env.EMAIL_CAPTURE_DIR?.trim();
  if (!dir) return null; // default + production: real provider transport
  const isCI = env.CI === "true" || env.CI === "1";
  const isProdRuntime = env.VERCEL_ENV === "production" || (env.NODE_ENV === "production" && !isCI);
  if (isProdRuntime) {
    throw new Error(
      "EMAIL_CAPTURE_DIR is set in a PRODUCTION runtime — refusing to boot. This capture sink is " +
        "TEST/CI ONLY; never set it on the live platform (it would divert all email to disk).",
    );
  }
  return dir;
}

/** Writes the email to the capture dir as JSON. The filename embeds the recipient so a test can find
 *  its own message deterministically (the suite self-seeds a unique recipient per run). */
async function captureToFile(payload: EmailPayload, dir: string): Promise<EmailResult> {
  const id = randomUUID();
  const safeRecipient = payload.to.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 80);
  const file = join(dir, `${safeRecipient}.${id}.json`);
  await mkdir(dir, { recursive: true });
  await writeFile(
    file,
    JSON.stringify(
      { id, to: payload.to, subject: payload.subject, html: payload.html, text: payload.text },
      null,
      2,
    ),
    "utf8",
  );
  return { sent: true, skipped: false, messageId: `capture:${id}` };
}

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * Sends one email. Tries RESEND_API_KEY first, then SENDGRID_API_KEY, then POSTMARK_API_KEY.
 * If no provider key is set, returns { sent: false, skipped: true, reason: "no-provider" }.
 * The sender identity is owner-configurable via EMAIL_FROM / EMAIL_FROM_NAME (see getFromEmail).
 * NEVER sends bulk unsolicited email. Only sends to explicitly opted-in addresses.
 */
export async function sendEmail(payload: EmailPayload): Promise<EmailResult> {
  // TEST/CI capture transport (F4.1): when EMAIL_CAPTURE_DIR is set (never in prod — see
  // resolveEmailCaptureDir's fail-closed guard), divert the email to a JSON sink so the journey suite
  // can RETRIEVE it and complete a real round-trip. Takes precedence over real providers.
  // NOTE: this call is DELIBERATELY outside the provider try/catch below — if EMAIL_CAPTURE_DIR is set
  // in a production runtime the guard THROWS, and that throw must propagate (fail closed = crash, not
  // silently swallow all customer email). Do NOT wrap it to "handle" the error.
  const captureDir = resolveEmailCaptureDir(process.env);
  if (captureDir) {
    try {
      return await captureToFile(payload, captureDir);
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      console.error("[email] capture write error:", reason);
      return { sent: false, skipped: false, reason };
    }
  }

  const resendKey = process.env["RESEND_API_KEY"];
  const sendgridKey = process.env["SENDGRID_API_KEY"];
  const postmarkKey = process.env["POSTMARK_API_KEY"];

  try {
    if (resendKey) {
      return await sendViaResend(payload, resendKey);
    }
    if (sendgridKey) {
      return await sendViaSendgrid(payload, sendgridKey);
    }
    if (postmarkKey) {
      return await sendViaPostmark(payload, postmarkKey);
    }

    // No provider configured — fail open with warning
    console.warn("[email] no email provider key configured — skipping send to", payload.to);
    return { sent: false, skipped: true, reason: "no-provider" };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    console.error("[email] send error:", reason);
    return { sent: false, skipped: false, reason };
  }
}

/**
 * Sends to a batch but ONLY if a provider is connected AND the recipient list came from the DB
 * (not injected). Hard limit: refuses if batch > 500 (anti-spam guardrail).
 */
export async function sendEmailBatch(
  payloads: EmailPayload[],
): Promise<{ sent: number; skipped: number }> {
  const BATCH_LIMIT = 500;

  if (payloads.length > BATCH_LIMIT) {
    console.error(
      `[email] batch of ${payloads.length} exceeds hard limit of ${BATCH_LIMIT} — refusing to send`,
    );
    return { sent: 0, skipped: payloads.length };
  }

  let sent = 0;
  let skipped = 0;

  for (const payload of payloads) {
    const result = await sendEmail(payload);
    if (result.sent) {
      sent++;
    } else {
      skipped++;
    }
  }

  return { sent, skipped };
}
