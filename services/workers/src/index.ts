/**
 * Worker service — the async ingestion backbone (PLAN §2.4, §5). Separate always-on Node
 * process (not Vercel serverless). gmail-poll + receipt-parse run the real Gmail→pantry chain;
 * vision/predict/watch are skeletons pending their phases.
 */
import { Worker, type Job } from "bullmq";
import { loadEnv } from "@gm/config/env";
import { getAdminDb, getDb, listGoogleUserIds, withTenant } from "@gm/db";
import {
  QUEUES,
  RECEIPT_JOB_OPTS,
  connection,
  gmailPollQueue,
  predictRecomputeQueue,
  receiptParseQueue,
  watchRenewQueue,
} from "./queues.js";
import { parseReceiptForUser, pollGmailForUser, renewGmailWatch } from "./jobs/gmail.js";

const env = loadEnv();
const db = getDb();

function stub(name: string) {
  return async (job: Job) => {
    console.log(`[${name}] processing job ${job.id}`, job.data);
  };
}

const workers = [
  new Worker(
    QUEUES.gmailPoll,
    async () => {
      const userIds = await listGoogleUserIds(getAdminDb());
      for (const userId of userIds) {
        try {
          const n = await withTenant(db, userId, (tx) =>
            pollGmailForUser(tx, env, userId, async (messageId) => {
              await receiptParseQueue.add(
                "parse",
                { userId, messageId },
                { jobId: `rp-${userId}-${messageId}`, ...RECEIPT_JOB_OPTS },
              );
            }),
          );
          console.log(`[gmail-poll] user ${userId}: enqueued ${n}`);
        } catch (e) {
          console.error(`[gmail-poll] user ${userId} failed`, e);
        }
      }
    },
    { connection },
  ),

  new Worker(
    QUEUES.receiptParse,
    async (job) => {
      const { userId, messageId } = job.data as { userId: string; messageId: string };
      const res = await withTenant(db, userId, (tx) => parseReceiptForUser(tx, env, userId, messageId));
      console.log(`[receipt-parse] ${messageId}`, res);
    },
    { connection, concurrency: 4 },
  ),

  new Worker(QUEUES.visionScan, stub("vision-scan"), { connection, concurrency: 2 }),
  new Worker(QUEUES.predictRecompute, stub("predict-recompute"), { connection }),

  new Worker(
    QUEUES.watchRenew,
    async () => {
      if (!env.GMAIL_PUBSUB_TOPIC) {
        console.log("[watch-renew] GMAIL_PUBSUB_TOPIC unset — skipping (manual/poll sync still works)");
        return;
      }
      const userIds = await listGoogleUserIds(getAdminDb());
      for (const userId of userIds) {
        try {
          const r = await withTenant(db, userId, (tx) =>
            renewGmailWatch(tx, env, userId, env.GMAIL_PUBSUB_TOPIC!),
          );
          console.log(`[watch-renew] user ${userId}: expires ${r.watchExpiresAt.toISOString()}`);
        } catch (e) {
          console.error(`[watch-renew] user ${userId} failed`, e);
        }
      }
    },
    { connection },
  ),
];

async function registerCron() {
  await watchRenewQueue.add("renew", {}, { repeat: { pattern: "0 6 * * *" }, jobId: "watch-renew-daily" });
  await gmailPollQueue.add("poll", {}, { repeat: { pattern: "0 * * * *" }, jobId: "gmail-poll-hourly" });
  await predictRecomputeQueue.add("nightly", {}, { repeat: { pattern: "0 3 * * *" }, jobId: "predict-nightly" });
}

async function main() {
  await registerCron();
  console.log(`✓ workers up: ${workers.map((w) => w.name).join(", ")}`);
}

async function shutdown() {
  console.log("→ shutting down workers…");
  await Promise.all(workers.map((w) => w.close()));
  await connection.quit();
  process.exit(0);
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
