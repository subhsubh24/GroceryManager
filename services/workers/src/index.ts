/**
 * Worker service — the async ingestion backbone (PLAN §2.4, §5). Separate always-on Node
 * process (not Vercel serverless). gmail-poll + receipt-parse run the real Gmail→pantry chain;
 * vision/predict/watch are skeletons pending their phases.
 */
import { Worker, type Job } from "bullmq";
import { loadEnv } from "@gm/config/env";
import { getDb, listGoogleUserIds } from "@gm/db";
import {
  QUEUES,
  connection,
  gmailPollQueue,
  predictRecomputeQueue,
  receiptParseQueue,
  watchRenewQueue,
} from "./queues.js";
import { parseReceiptForUser, pollGmailForUser } from "./jobs/gmail.js";

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
      const userIds = await listGoogleUserIds(db);
      for (const userId of userIds) {
        try {
          const n = await pollGmailForUser(db, env, userId, async (messageId) => {
            await receiptParseQueue.add(
              "parse",
              { userId, messageId },
              { jobId: `rp-${userId}-${messageId}` },
            );
          });
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
      const res = await parseReceiptForUser(db, env, userId, messageId);
      console.log(`[receipt-parse] ${messageId}`, res);
    },
    { connection, concurrency: 4 },
  ),

  new Worker(QUEUES.visionScan, stub("vision-scan"), { connection, concurrency: 2 }),
  new Worker(QUEUES.predictRecompute, stub("predict-recompute"), { connection }),
  new Worker(QUEUES.watchRenew, stub("watch-renew"), { connection }),
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
