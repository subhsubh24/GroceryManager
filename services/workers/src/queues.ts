import { Queue } from "bullmq";
import IORedis from "ioredis";
import { loadEnv } from "@gm/config/env";

/** Shared Redis connection for all BullMQ queues/workers (PLAN §2.1 ingestion backbone). */
export const connection = new IORedis(loadEnv().REDIS_URL, {
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

export const gmailPollQueue = new Queue(QUEUES.gmailPoll, { connection });
export const receiptParseQueue = new Queue(QUEUES.receiptParse, { connection });
export const visionScanQueue = new Queue(QUEUES.visionScan, { connection });
export const predictRecomputeQueue = new Queue(QUEUES.predictRecompute, { connection });
export const watchRenewQueue = new Queue(QUEUES.watchRenew, { connection });
