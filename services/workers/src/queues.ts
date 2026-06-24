import { Queue } from "bullmq";
import IORedis from "ioredis";
import { loadEnv } from "@gm/config/env";

/** Shared Redis connection for all BullMQ queues/workers (PLAN §2.1 ingestion backbone). */
const env = loadEnv();
if (!env.REDIS_URL) throw new Error("REDIS_URL is required to run the worker service");
export const connection = new IORedis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
});

export const QUEUES = {
  gmailPoll: "gmail-poll",
  receiptParse: "receipt-parse",
  visionScan: "vision-scan",
  predictRecompute: "predict-recompute",
  watchRenew: "watch-renew",
} as const;

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];

/**
 * Retry + retention config for receipt-parse jobs.
 * 3 attempts with exponential backoff handles transient LLM timeouts and Gemini 429s.
 * removeOnFail caps Redis memory usage; removeOnComplete keeps a short audit trail.
 */
export const RECEIPT_JOB_OPTS = {
  attempts: 3,
  backoff: { type: "exponential" as const, delay: 5000 },
  removeOnComplete: 100,
  removeOnFail: 200,
} as const;

/** Retention-only defaults for fire-and-forget cron-style queues. */
const CRON_JOB_OPTS = {
  removeOnComplete: 10,
  removeOnFail: 50,
} as const;

export const gmailPollQueue = new Queue(QUEUES.gmailPoll, {
  connection,
  defaultJobOptions: CRON_JOB_OPTS,
});
export const receiptParseQueue = new Queue(QUEUES.receiptParse, {
  connection,
  defaultJobOptions: RECEIPT_JOB_OPTS,
});
export const visionScanQueue = new Queue(QUEUES.visionScan, { connection });
export const predictRecomputeQueue = new Queue(QUEUES.predictRecompute, {
  connection,
  defaultJobOptions: CRON_JOB_OPTS,
});
export const watchRenewQueue = new Queue(QUEUES.watchRenew, {
  connection,
  defaultJobOptions: CRON_JOB_OPTS,
});
