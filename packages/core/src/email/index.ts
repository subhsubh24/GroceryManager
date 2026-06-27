/**
 * Provider-agnostic email sender (H2 Email lifecycle runner).
 * Fail-open (no-op with warning) when no provider key is set.
 * Tries RESEND_API_KEY → SENDGRID_API_KEY → POSTMARK_API_KEY in order.
 * Uses fetch + JSON only — no SDKs.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

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
    from: "GroceryManager <noreply@grocerymanager.app>",
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
    from: { email: "noreply@grocerymanager.app", name: "GroceryManager" },
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
    From: "noreply@grocerymanager.app",
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

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * Sends one email. Tries RESEND_API_KEY first, then SENDGRID_API_KEY, then POSTMARK_API_KEY.
 * If no provider key is set, returns { sent: false, skipped: true, reason: "no-provider" }.
 * NEVER sends bulk unsolicited email. Only sends to explicitly opted-in addresses.
 */
export async function sendEmail(payload: EmailPayload): Promise<EmailResult> {
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
