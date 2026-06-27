/**
 * Security guard utilities for API route handlers.
 * G2: Server-side input validation (body size, field types, length limits).
 * G3: Error-message hygiene — log full context server-side, return generic messages to callers.
 */

const MAX_BODY_BYTES = 32_768; // 32 KB

/** Parse a JSON body with a content-length + actual-size guard. Returns parsed body or a 400 Response. */
export async function parseJsonBody<T = Record<string, unknown>>(req: Request): Promise<T | Response> {
  const cl = req.headers.get("content-length");
  if (cl && parseInt(cl, 10) > MAX_BODY_BYTES) {
    return Response.json({ error: "Request body too large." }, { status: 400 });
  }
  let text: string;
  try {
    text = await req.text();
  } catch {
    return Response.json({ error: "Failed to read request body." }, { status: 400 });
  }
  if (text.length > MAX_BODY_BYTES) {
    return Response.json({ error: "Request body too large." }, { status: 400 });
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }
}

/** Log error details server-side and return a generic 500 to the caller (G3). */
export function serverError(context: string, err: unknown): Response {
  console.error(`[${context}]`, err);
  return Response.json({ error: "Internal server error." }, { status: 500 });
}

/** Validate a required string field within a max length (G2). */
export function requireString(
  value: unknown,
  field: string,
  maxLength = 1_000,
): { ok: true; value: string } | { ok: false; response: Response } {
  if (typeof value !== "string") {
    return { ok: false, response: Response.json({ error: `${field} must be a string.` }, { status: 400 }) };
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return { ok: false, response: Response.json({ error: `${field} is required.` }, { status: 400 }) };
  }
  if (trimmed.length > maxLength) {
    return { ok: false, response: Response.json({ error: `${field} exceeds maximum length.` }, { status: 400 }) };
  }
  return { ok: true, value: trimmed };
}
