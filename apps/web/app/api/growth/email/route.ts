import { auth } from "@/auth";
import { parseJsonBody, serverError } from "../../_lib/guard";
import { sendEmailBatch } from "@gm/core/email";
import type { EmailPayload } from "@gm/core/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Admin-only endpoint to send a batch of lifecycle drip emails.
 * Requires the authenticated user's email to match ADMIN_EMAIL.
 *
 * POST /api/growth/email
 * Body: { payloads: Array<{ to, subject, html, text }> }
 */
export async function POST(req: Request) {
  // 1. Check admin auth
  const session = await auth();
  const userEmail = (session?.user as { email?: string } | undefined)?.email;
  const adminEmail = process.env["ADMIN_EMAIL"];

  if (!userEmail || !adminEmail || userEmail !== adminEmail) {
    return Response.json({ error: "Forbidden." }, { status: 403 });
  }

  // 2. Parse and validate body
  const body = await parseJsonBody<{ payloads?: unknown }>(req);
  if (body instanceof Response) return body;

  const { payloads } = body;
  if (!Array.isArray(payloads)) {
    return Response.json({ error: "payloads must be an array." }, { status: 400 });
  }

  for (let i = 0; i < payloads.length; i++) {
    const item = payloads[i] as Record<string, unknown>;
    if (
      typeof item?.to !== "string" ||
      typeof item?.subject !== "string" ||
      typeof item?.html !== "string" ||
      typeof item?.text !== "string"
    ) {
      return Response.json(
        { error: `payloads[${i}] must have string fields: to, subject, html, text.` },
        { status: 400 },
      );
    }
  }

  // 3. Send the batch
  try {
    const emailPayloads: EmailPayload[] = (payloads as Array<{ to: string; subject: string; html: string; text: string; replyTo?: string }>).map(
      ({ to, subject, html, text, replyTo }) => ({ to, subject, html, text, replyTo }),
    );
    const result = await sendEmailBatch(emailPayloads);
    return Response.json(result);
  } catch (err) {
    return serverError("growth/email", err);
  }
}
