/**
 * Gmail message parsing/classification (PLAN §5.1). Pure + testable: decide whether a message
 * is a receipt (sender + subject rules) and pull the HTML/text body out of the MIME payload.
 * The network client (client.ts) provides the raw message; this turns it into ingestible text.
 */
import type { Retailer } from "@gm/shared";

export interface GmailHeader {
  name: string;
  value: string;
}

export interface GmailPart {
  mimeType?: string;
  filename?: string;
  headers?: GmailHeader[];
  body?: { data?: string; size?: number };
  parts?: GmailPart[];
}

export function headerValue(headers: GmailHeader[] | undefined, name: string): string | null {
  const lower = name.toLowerCase();
  return headers?.find((h) => h.name.toLowerCase() === lower)?.value ?? null;
}

const RECEIPT_SENDERS: { domain: string; retailer: Retailer }[] = [
  { domain: "wholefoodsmarket.com", retailer: "whole_foods" },
  { domain: "instacart.com", retailer: "instacart" },
  { domain: "amazon.com", retailer: "amazon" }, // keep last (broadest)
];

export function detectRetailer(from: string | null): Retailer | null {
  if (!from) return null;
  const f = from.toLowerCase();
  for (const s of RECEIPT_SENDERS) if (f.includes(s.domain)) return s.retailer;
  return null;
}

const SUBJECT_HINTS = [/order/i, /receipt/i, /delivered/i, /your .*(order|delivery)/i, /shipped/i];

/** Classify by sender (must be a known retailer) + a receipt-y subject. Rules-first; an LLM
 *  fallback (Flash-Lite) can be layered for ambiguous senders later (PLAN §5.5). */
export function isReceiptEmail(input: { from: string | null; subject: string | null }): {
  isReceipt: boolean;
  retailer: Retailer | null;
} {
  const retailer = detectRetailer(input.from);
  if (!retailer) return { isReceipt: false, retailer: null };
  const subjectOk = input.subject ? SUBJECT_HINTS.some((re) => re.test(input.subject!)) : false;
  return { isReceipt: subjectOk, retailer };
}

function decodeB64Url(data: string): string {
  return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
}

/** Walk the MIME tree and return the first HTML and text bodies found. */
export function extractBody(payload: GmailPart | undefined): { html: string | null; text: string | null } {
  let html: string | null = null;
  let text: string | null = null;
  const walk = (p?: GmailPart) => {
    if (!p) return;
    if (p.mimeType === "text/html" && p.body?.data && html === null) html = decodeB64Url(p.body.data);
    else if (p.mimeType === "text/plain" && p.body?.data && text === null) text = decodeB64Url(p.body.data);
    for (const child of p.parts ?? []) walk(child);
  };
  walk(payload);
  return { html, text };
}

/** Best ingestible text from a message payload: HTML if present, else plain text. */
export function bodyText(payload: GmailPart | undefined): string | null {
  const { html, text } = extractBody(payload);
  return html ?? text;
}

export interface PubSubNotification {
  emailAddress: string;
  historyId: string;
}

/**
 * Decode a Gmail Pub/Sub push body → { emailAddress, historyId } (PLAN §5.1). The push delivers
 * `message.data` as base64-encoded JSON. Pure; returns null for a malformed/empty body.
 */
export function parsePubSubMessage(body: unknown): PubSubNotification | null {
  const data = (body as { message?: { data?: unknown } })?.message?.data;
  if (typeof data !== "string" || !data) return null;
  try {
    const decoded = JSON.parse(Buffer.from(data, "base64").toString("utf8")) as {
      emailAddress?: unknown;
      historyId?: unknown;
    };
    if (typeof decoded.emailAddress !== "string" || !decoded.emailAddress) return null;
    return { emailAddress: decoded.emailAddress, historyId: String(decoded.historyId ?? "") };
  } catch {
    return null;
  }
}
