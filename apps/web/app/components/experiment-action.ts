"use server";

import { trackExperimentConversion } from "@/app/lib/experiments";

/**
 * Server action wrapper for experiment conversion tracking — callable from client components.
 * Best-effort: swallows all errors, never blocks the caller.
 */
export async function trackConversion(experimentId: string, eventName: string): Promise<void> {
  await trackExperimentConversion(experimentId, eventName);
}
