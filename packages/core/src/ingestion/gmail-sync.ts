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
  withTenant,
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
import { createGeminiEmbedder, getGeminiClient } from "../llm/index.js";
import { createDbNormalizationPorts } from "./db-ports.js";
import { createLlmNormalizer } from "./llm-normalizer.js";
import { createLlmShelfLifeEstimator } from "../pantry/shelf-life-llm.js";
import { ingestReceipt } from "./ingest.js";
import { cleanReceiptText, extractReceipt } from "./receipt-parse.js";

/** A top-level DB handle (not a transaction) — syncGmailForUser opens its own per-message tx. */
type DbHandle = Parameters<typeof withTenant>[0];
type GoogleCredential = NonNullable<Awaited<ReturnType<typeof getGoogleCredential>>>;

/** Exchange/refresh an access token from an already-loaded credential (avoids a second fetch). */
async function accessTokenFromCred(
  db: Querier,
  env: Env,
  userId: string,
  cred: GoogleCredential,
): Promise<string> {
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

async function getValidAccessToken(db: Querier, env: Env, userId: string): Promise<string> {
  const cred = await getGoogleCredential(db, userId);
  if (!cred) throw new Error(`no google credential for user ${userId}`);
  return accessTokenFromCred(db, env, userId, cred);
}

/** Fetch the credential once → a ready Gmail client + the current sync cursor (avoids double reads). */
async function resolveGmailContext(
  db: Querier,
  env: Env,
  userId: string,
): Promise<{ client: GmailClient; historyId: string | null }> {
  const cred = await getGoogleCredential(db, userId);
  if (!cred) throw new Error(`no google credential for user ${userId}`);
  const token = await accessTokenFromCred(db, env, userId, cred);
  return { client: new GmailClient(token), historyId: cred.historyId ?? null };
}

/**
 * Discover new receipt message ids (history delta when we have a cursor, else a bounded search).
 * Pure of DB writes: it returns the delta's next historyId so the caller advances the cursor only
 * AFTER the batch is processed (otherwise a mid-batch failure would skip un-ingested receipts).
 * The whole history delta is returned (no slice) so large deltas aren't silently truncated; the
 * `maxSearch` bound applies only to the cursorless cold-start search.
 */
async function discoverMessageIds(
  client: GmailClient,
  historyId: string | null | undefined,
  maxSearch: number,
): Promise<{ ids: string[]; newHistoryId?: string }> {
  if (historyId) {
    const h = await client.historyMessageIds(historyId);
    return { ids: h.ids, newHistoryId: h.historyId };
  }
  const r = await client.listMessageIds({ q: RECEIPT_QUERY, maxResults: maxSearch });
  return { ids: r.ids };
}

/** Discover new receipt messages for a user and hand each off to receipt-parse (worker queue path). */
export async function pollGmailForUser(
  db: Querier,
  env: Env,
  userId: string,
  enqueue: (messageId: string) => Promise<void>,
): Promise<number> {
  const { client, historyId } = await resolveGmailContext(db, env, userId);
  const { ids, newHistoryId } = await discoverMessageIds(client, historyId, 25);
  for (const id of ids) await enqueue(id);
  // Safe to advance after enqueue: each id becomes a durable, retryable BullMQ job.
  if (newHistoryId) await setGmailHistoryId(db, userId, newHistoryId);
  return ids.length;
}

/**
 * Register/refresh the Gmail Pub/Sub watch for a user (PLAN §5.1 — must be renewed ≤7 days). Persists
 * the expiry and seeds the sync cursor only on the first watch — an existing historyId is preserved so
 * renewing never resets the cursor forward (which would make the fallback poll miss dropped pushes).
 */
export async function renewGmailWatch(
  db: Querier,
  env: Env,
  userId: string,
  topicName: string,
): Promise<{ historyId: string; watchExpiresAt: Date }> {
  const cred = await getGoogleCredential(db, userId);
  if (!cred) throw new Error(`no google credential for user ${userId}`);
  const token = await accessTokenFromCred(db, env, userId, cred);
  const res = await new GmailClient(token).watch(topicName);
  const watchExpiresAt = new Date(Number(res.expiration));
  const historyId = cred.historyId ?? res.historyId; // keep an existing cursor; seed on cold start
  await setGmailWatch(db, userId, { historyId, watchExpiresAt });
  return { historyId, watchExpiresAt };
}

const SOURCE_BY_RETAILER = {
  amazon: "gmail_amazon",
  whole_foods: "gmail_wfm",
  instacart: "gmail_instacart",
} as const;

export type ParseReceiptResult =
  | { skipped: true }
  | ({ skipped: false } & Awaited<ReturnType<typeof ingestReceipt>>);

/**
 * Fetch one message, classify, and (if a receipt) run the extract→normalize→pantry chain. Pass a
 * pre-resolved `client` to avoid re-reading the credential per message in a batch.
 */
export async function parseReceiptForUser(
  db: Querier,
  env: Env,
  userId: string,
  messageId: string,
  client?: GmailClient,
): Promise<ParseReceiptResult> {
  const gmailClient = client ?? new GmailClient(await getValidAccessToken(db, env, userId));
  const msg = await gmailClient.getMessage(messageId);

  const from = headerValue(msg.payload?.headers, "From");
  const subject = headerValue(msg.payload?.headers, "Subject");
  const { isReceipt, retailer } = isReceiptEmail({ from, subject });
  if (!isReceipt || !retailer || retailer === "other") return { skipped: true };

  const html = bodyText(msg.payload);
  if (!html) return { skipped: true };

  const geminiClient = getGeminiClient();
  // Full §5.4 cascade: trigram → embedding (gemini-embedding-001 semantic match) → LLM tiebreak/
  // create. Embedding + LLM only run for lines the cheaper stages miss, so cost stays bounded.
  const ports = createDbNormalizationPorts(db, userId, {
    embed: createGeminiEmbedder(geminiClient),
    llm: createLlmNormalizer(geminiClient),
    shelfLife: createLlmShelfLifeEstimator(geminiClient),
  });
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
  failed: number; // messages that errored (isolated — didn't abort the batch)
}

export function emptyGmailSyncSummary(): GmailSyncSummary {
  return {
    scanned: 0,
    receipts: 0,
    ingested: 0,
    deduped: 0,
    linesIngested: 0,
    needsReview: 0,
    failed: 0,
  };
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
 * Inline sync: discover + parse a batch immediately (no queue) and roll up a summary. Powers the web
 * "Sync receipts now" action so the loop runs with zero Redis/worker. Takes a top-level DB handle and
 * runs each message in its OWN tenant transaction, so one duplicate/parse error can't poison the rest
 * of the batch; the history cursor is advanced only after the batch is attempted (never before work).
 */
export async function syncGmailForUser(
  db: DbHandle,
  env: Env,
  userId: string,
  opts: { maxMessages?: number } = {},
): Promise<GmailSyncSummary> {
  const max = opts.maxMessages ?? 10;
  // Resolve the client + cursor in a short tx (no network held inside the transaction).
  const { client, historyId } = await withTenant(db, userId, (tx) =>
    resolveGmailContext(tx, env, userId),
  );
  const { ids, newHistoryId } = await discoverMessageIds(client, historyId, max);

  const summary = emptyGmailSyncSummary();
  for (const id of ids) {
    try {
      const r = await withTenant(db, userId, (tx) => parseReceiptForUser(tx, env, userId, id, client));
      accumulateParseResult(summary, r);
    } catch (e) {
      // Isolated per message — a bad/duplicate one is logged + counted, not fatal to the batch.
      summary.failed += 1;
      console.error(`[gmail-sync] message ${id} failed`, e);
    }
  }

  // Advance the cursor after attempting the batch (failures isolated above), mirroring the worker's
  // advance-then-best-effort durability so a poison message can't block the cursor forever.
  if (newHistoryId) await withTenant(db, userId, (tx) => setGmailHistoryId(tx, userId, newHistoryId));
  return summary;
}

/** Gmail search for receipts newer than `sinceDays` (e.g. "…from:(amazon…) after:2026/3/16"). */
export function receiptQuerySince(sinceDays: number, now = new Date()): string {
  const d = new Date(now.getTime() - sinceDays * 86_400_000);
  return `${RECEIPT_QUERY} after:${d.getUTCFullYear()}/${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
}

/** Page through a search query collecting up to `cap` message ids. Client is duck-typed for tests. */
export async function collectBackfillIds(
  client: Pick<GmailClient, "listMessageIds">,
  query: string,
  cap: number,
): Promise<string[]> {
  const ids: string[] = [];
  let pageToken: string | undefined;
  do {
    const remaining = cap - ids.length;
    const r = await client.listMessageIds({ q: query, pageToken, maxResults: Math.min(100, remaining) });
    ids.push(...r.ids);
    pageToken = r.nextPageToken;
  } while (pageToken && ids.length < cap);
  return ids.slice(0, cap);
}

/**
 * Seed the pantry from receipt history (PLAN §10 "fast onboarding backfill"). Paginated, date-bounded,
 * capped. Search-based, so it does NOT touch the incremental sync cursor; idempotent ingest dedups any
 * overlap. Bounded inline for the web; the worker script runs it with a high cap for full history.
 */
export async function backfillGmailForUser(
  db: DbHandle,
  env: Env,
  userId: string,
  opts: { sinceDays?: number; maxMessages?: number } = {},
): Promise<GmailSyncSummary> {
  const sinceDays = opts.sinceDays ?? 180;
  const cap = opts.maxMessages ?? 50;
  const { client } = await withTenant(db, userId, (tx) => resolveGmailContext(tx, env, userId));
  const ids = await collectBackfillIds(client, receiptQuerySince(sinceDays), cap);

  const summary = emptyGmailSyncSummary();
  for (const id of ids) {
    try {
      accumulateParseResult(
        summary,
        await withTenant(db, userId, (tx) => parseReceiptForUser(tx, env, userId, id, client)),
      );
    } catch (e) {
      summary.failed += 1;
      console.error(`[gmail-backfill] message ${id} failed`, e);
    }
  }
  return summary;
}
