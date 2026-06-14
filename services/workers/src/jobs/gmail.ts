/**
 * Gmail ingestion jobs (PLAN §5.1). Drop-in: runs once GOOGLE_CLIENT_ID/SECRET, TOKEN_ENC_KEY,
 * and GEMINI_API_KEY are set and a user has connected Gmail. Token is refreshed + re-persisted.
 */
import type { Env } from "@gm/config/env";
import {
  getGoogleCredential,
  setGmailHistoryId,
  updateGoogleTokens,
  type Querier,
} from "@gm/db";
import { decryptSecret, encryptSecret } from "@gm/core/crypto";
import { gmail, google } from "@gm/core/integrations";
import {
  cleanReceiptText,
  createDbNormalizationPorts,
  createLlmNormalizer,
  extractReceipt,
  ingestReceipt,
} from "@gm/core/ingestion";
import { getGeminiClient } from "@gm/core/llm";

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
    const t = await google.refreshGoogleAccessToken(refresh, env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET);
    await updateGoogleTokens(db, userId, {
      accessTokenEnc: encryptSecret(t.accessToken, key),
      expiresAt: t.expiresAt,
    });
    return t.accessToken;
  }
  throw new Error("no valid google token (need GOOGLE_CLIENT_ID/SECRET + a stored refresh token)");
}

/** Discover new receipt messages for a user and hand each off to receipt-parse. */
export async function pollGmailForUser(
  db: Querier,
  env: Env,
  userId: string,
  enqueue: (messageId: string) => Promise<void>,
): Promise<number> {
  const token = await getValidAccessToken(db, env, userId);
  const client = new gmail.GmailClient(token);
  const cred = await getGoogleCredential(db, userId);

  let ids: string[];
  if (cred?.historyId) {
    const h = await client.historyMessageIds(cred.historyId);
    ids = h.ids;
    if (h.historyId) await setGmailHistoryId(db, userId, h.historyId);
  } else {
    const r = await client.listMessageIds({ q: gmail.RECEIPT_QUERY, maxResults: 25 });
    ids = r.ids;
  }
  for (const id of ids) await enqueue(id);
  return ids.length;
}

const SOURCE_BY_RETAILER = {
  amazon: "gmail_amazon",
  whole_foods: "gmail_wfm",
  instacart: "gmail_instacart",
} as const;

/** Fetch one message, classify, and (if a receipt) run the extract→normalize→pantry chain. */
export async function parseReceiptForUser(db: Querier, env: Env, userId: string, messageId: string) {
  const token = await getValidAccessToken(db, env, userId);
  const client = new gmail.GmailClient(token);
  const msg = await client.getMessage(messageId);

  const from = gmail.headerValue(msg.payload?.headers, "From");
  const subject = gmail.headerValue(msg.payload?.headers, "Subject");
  const { isReceipt, retailer } = gmail.isReceiptEmail({ from, subject });
  if (!isReceipt || !retailer || retailer === "other") return { skipped: true as const };

  const html = gmail.bodyText(msg.payload);
  if (!html) return { skipped: true as const };

  const geminiClient = getGeminiClient();
  // Light up the §5.4 cascade's LLM tiebreak/create stage (was deferring everything below the
  // trigram/embedding thresholds straight to the Review inbox).
  const ports = createDbNormalizationPorts(db, userId, { llm: createLlmNormalizer(geminiClient) });
  const result = await ingestReceipt(
    {
      db,
      ports,
      extract: async (text) => (await extractReceipt(geminiClient, text, { retailerHint: retailer })).value,
    },
    {
      userId,
      source: SOURCE_BY_RETAILER[retailer],
      gmailMessageId: messageId,
      cleanedText: cleanReceiptText(html),
    },
  );
  return { skipped: false as const, ...result };
}
