import { loadEnv } from "@gm/config/env";
import { getDb, getUserPhone, withTenant } from "@gm/db";

/**
 * SMS delivery via the Twilio REST API (no SDK — a single authenticated fetch, mirroring our other
 * lightweight integration clients). Best-effort + degrading: no Twilio keys → "no-twilio"; no phone on
 * file → "no-phone"; a send error is logged and swallowed. Never throws to the caller (the cron).
 */
export interface SmsResult {
  sent: number;
  skipped?: "no-twilio" | "no-phone" | "error";
}

export async function sendSmsToUser(userId: string, body: string): Promise<SmsResult> {
  const env = loadEnv();
  if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN || !env.TWILIO_FROM_NUMBER) {
    return { sent: 0, skipped: "no-twilio" };
  }
  // The user's own row, RLS-scoped.
  const phone = await withTenant(getDb(), userId, (tx) => getUserPhone(tx, userId));
  if (!phone) return { sent: 0, skipped: "no-phone" };

  try {
    const auth = Buffer.from(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`).toString("base64");
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ To: phone, From: env.TWILIO_FROM_NUMBER, Body: body }),
      },
    );
    if (!res.ok) {
      console.error("[sms] Twilio send failed", res.status, await res.text().catch(() => ""));
      return { sent: 0, skipped: "error" };
    }
    return { sent: 1 };
  } catch (e) {
    console.error("[sms] Twilio send error", e);
    return { sent: 0, skipped: "error" };
  }
}
