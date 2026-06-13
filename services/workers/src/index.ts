/**
 * Worker service — the async ingestion backbone (PLAN §2.4, §5).
 * Runs as a separate always-on Node process (NOT on Vercel serverless).
 *
 * Phase 0: queues + processor skeletons + repeatable cron registration. The processor
 * bodies (Gmail poll/parse, vision scan, prediction recompute, watch renew) land in Phase 1.
 */
import { Worker, type Job } from "bullmq";
import {
  QUEUES,
  connection,
  gmailPollQueue,
  predictRecomputeQueue,
  watchRenewQueue,
} from "./queues.js";

function processor(name: string) {
  return async (job: Job) => {
    // TODO(Phase 1): implement per PLAN §5/§6/§7. Skeleton logs for now.
    console.log(`[${name}] processing job ${job.id}`, job.data);
  };
}

const workers = [
  new Worker(QUEUES.gmailPoll, processor("gmail-poll"), { connection }),
  new Worker(QUEUES.receiptParse, processor("receipt-parse"), { connection, concurrency: 4 }),
  new Worker(QUEUES.visionScan, processor("vision-scan"), { connection, concurrency: 2 }),
  new Worker(QUEUES.predictRecompute, processor("predict-recompute"), { connection }),
  new Worker(QUEUES.watchRenew, processor("watch-renew"), { connection }),
];

async function registerCron() {
  // Gmail watch must be renewed ≤7 days → renew daily (PLAN §5.1).
  await watchRenewQueue.add("renew", {}, { repeat: { pattern: "0 6 * * *" }, jobId: "watch-renew-daily" });
  // Hourly history.list fallback in case Pub/Sub push is dropped (PLAN §5.1).
  await gmailPollQueue.add("poll", {}, { repeat: { pattern: "0 * * * *" }, jobId: "gmail-poll-hourly" });
  // Nightly reorder/prediction recompute (PLAN §7.1).
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
