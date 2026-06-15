/**
 * Gmail → pantry sync orchestration (PLAN §5.1). Shared by the background worker (gmail-poll +
 * receipt-parse cron) AND the web app's manual "Sync receipts now" action — so the same
 * extract → normalize → ledger → pantry chain runs whether triggered by cron or a tap. The web
 * path lets the loop run with no Redis/worker (the inline `syncGmailForUser`).
 *
 * Network + token-gated (runs once Google OAuth + a connected user exist). The pure summary
 * accumulator (`accumulateParseResult`) is unit-tested; the network glue is thin.
 */
import type { Env } from "@gm/config/env";
import {
  getGoogleCredential,
  setGmailHistoryId,
  setGmailWatch,
  updateGoogleTokens,
  type Querier,
} from "@gm/db";
import { decryptSecret, encryptSecret } from "../crypto/index.js";
import {
  GmailClient,
  RECEIPT_QUERY,
  bodyText,
  headerValue,
  isReceiptEmail,
} from "../integrations/gmail/index.js";
import { refreshGoogleAccessToken } from "../integrations/google/oauth.js";
import { getGeminiClient } from "../llm/index.js";
import { createDbNormalizationPorts } from "./db-ports.js";
import { createLlmNormalizer } from "./llm-normalizer.js";
import { ingestReceipt } from "./ingest.js";
import { cleanReceiptText, extractReceipt } from "./receipt-parse.js";

async function getValidAccessToken(db: Querier, env: Env, userId: string): Promise<string> {
  const cred = await getGoogleCredential(db, userId);
  if (!cred) throw new Error(`no google credential for user ${userId}`);
  const key = env.TOKEN_ENC_KEY;
  if (!key) throw new Error("TOKEN_ENC_KEY not set");

  if (cred.accessTokenEnc && cred.expiresAt && cred.expiresAt.getTime() > Date.now() + 60_000) {
    return decryptSecret(cred.accessTokenEnc, key);
  }
  if (cred.refreshTokenEnc && env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
    const refresh = decryptSecret(cred.refreshTokenEnc, key);
    const t = await refreshGoogleAccessToken(refresh, env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET);
    await updateGoogleTokens(db, userId, {
      accessTokenEnc: encryptSecret(t.accessToken, key),
      expiresAt: t.expiresAt,
    });
    return t.accessToken;
  }
  throw new Error("no valid google token (need GOOGLE_CLIENT_ID/SECRET + a stored refresh token)");
}

/** Discover new receipt message ids for a user (history delta when known, else a bounded search). */
async function discoverMessageIds(
  db: Querier,
  client: GmailClient,
  userId: string,
  historyId: string | null | undefined,
  max: number,
): Promise<string[]> {
  if (historyId) {
    const h = await client.historyMessageIds(historyId);
    if (h.historyId) await setGmailHistoryId(db, userId, h.historyId);
    return h.ids.slice(0, max);
  }
  const r = await client.listMessageIds({ q: RECEIPT_QUERY, maxResults: max });
  return r.ids;
}

/** Discover new receipt messages for a user and hand each off to receipt-parse (worker queue path). */
export async function pollGmailForUser(
  db: Querier,
  env: Env,
  userId: string,
  enqueue: (messageId: string) => Promise<void>,
): Promise<number> {
  const token = await getValidAccessToken(db, env, userId);
  const client = new GmailClient(token);
  const cred = await getGoogleCredential(db, userId);
  const ids = await discoverMessageIds(db, client, userId, cred?.historyId, 25);
  for (const id of ids) await enqueue(id);
  return ids.length;
}

/**
 * Register/refresh the Gmail Pub/Sub watch for a user (PLAN §5.1 — must be renewed ≤7 days). Persists
 * the returned historyId + expiry so the webhook + poll have a sync cursor. Run daily (worker cron or
 * the /api/cron/gmail route). No-op-safe: throws are caught by the caller per user.
 */
export async function renewGmailWatch(
  db: Querier,
  env: Env,
  userId: string,
  topicName: string,
): Promise<{ historyId: string; watchExpiresAt: Date }> {
  const token = await getValidAccessToken(db, env, userId);
  const client = new GmailClient(token);
  const res = await client.watch(topicName);
  const watchExpiresAt = new Date(Number(res.expiration));
  await setGmailWatch(db, userId, { historyId: res.historyId, watchExpiresAt });
  return { historyId: res.historyId, watchExpiresAt };
}

const SOURCE_BY_RETAILER = {
  amazon: "gmail_amazon",
  whole_foods: "gmail_wfm",
  instacart: "gmail_instacart",
} as const;

export type ParseReceiptResult =
  | { skipped: true }
  | ({ skipped: false } & Awaited<ReturnType<typeof ingestReceipt>>);

/** Fetch one message, classify, and (if a receipt) run the extract→normalize→pantry chain. */
export async function parseReceiptForUser(
  db: Querier,
  env: Env,
  userId: string,
  messageId: string,
): Promise<ParseReceiptResult> {
  const token = await getValidAccessToken(db, env, userId);
  const client = new GmailClient(token);
  const msg = await client.getMessage(messageId);

  const from = headerValue(msg.payload?.headers, "From");
  const subject = headerValue(msg.payload?.headers, "Subject");
  const { isReceipt, retailer } = isReceiptEmail({ from, subject });
  if (!isReceipt || !retailer || retailer === "other") return { skipped: true };

  const html = bodyText(msg.payload);
  if (!html) return { skipped: true };

  const geminiClient = getGeminiClient();
  // Light up the §5.4 cascade's LLM tiebreak/create stage (otherwise everything below the
  // trigram/embedding thresholds defers straight to the Review inbox).
  const ports = createDbNormalizationPorts(db, userId, { llm: createLlmNormalizer(geminiClient) });
  const result = await ingestReceipt(
    {
      db,
      ports,
      extract: async (text) =>
        (await extractReceipt(geminiClient, text, { retailerHint: retailer })).value,
    },
    {
      userId,
      source: SOURCE_BY_RETAILER[retailer],
      gmailMessageId: messageId,
      cleanedText: cleanReceiptText(html),
    },
  );
  return { skipped: false, ...result };
}

export interface GmailSyncSummary {
  scanned: number; // messages fetched + considered
  receipts: number; // classified as receipts from a known retailer
  ingested: number; // new purchases written (not already seen)
  deduped: number; // receipts already ingested before (idempotent skip)
  linesIngested: number; // line items written across all receipts
  needsReview: number; // line items that couldn't be confidently resolved
}

export function emptyGmailSyncSummary(): GmailSyncSummary {
  return { scanned: 0, receipts: 0, ingested: 0, deduped: 0, linesIngested: 0, needsReview: 0 };
}

/** Pure: fold one parse result into the running summary (the worth-testing rollup logic). */
export function accumulateParseResult(s: GmailSyncSummary, r: ParseReceiptResult): GmailSyncSummary {
  s.scanned += 1;
  if (r.skipped) return s;
  s.receipts += 1;
  if (r.deduped) s.deduped += 1;
  else s.ingested += 1;
  s.linesIngested += r.linesIngested;
  s.needsReview += r.needsReview;
  return s;
}

/**
 * Inline sync: poll + parse a bounded batch immediately (no queue) and roll up a summary. Powers the
 * web "Sync receipts now" action so the auto-fill loop runs with zero Redis/worker. The background
 * worker uses `pollGmailForUser` + `parseReceiptForUser` for unbounded volume.
 */
export async function syncGmailForUser(
  db: Querier,
  env: Env,
  userId: string,
  opts: { maxMessages?: number } = {},
): Promise<GmailSyncSummary> {
  const max = opts.maxMessages ?? 10;
  const token = await getValidAccessToken(db, env, userId);
  const client = new GmailClient(token);
  const cred = await getGoogleCredential(db, userId);
  const ids = await discoverMessageIds(db, client, userId, cred?.historyId, max);

  const summary = emptyGmailSyncSummary();
  for (const id of ids) {
    accumulateParseResult(summary, await parseReceiptForUser(db, env, userId, id));
  }
  return summary;
}
