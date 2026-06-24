import { createHmac, timingSafeEqual } from "crypto";

const SECRET = process.env.AUTH_SECRET ?? "";
const TOKEN_TTL = 60 * 60 * 24 * 7; // 7 days

export function signMobileToken(userId: string): string {
  if (!SECRET) throw new Error("AUTH_SECRET is not set");
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(
    JSON.stringify({ sub: userId, iat: now, exp: now + TOKEN_TTL }),
  ).toString("base64url");
  const sig = createHmac("sha256", SECRET).update(`${header}.${payload}`).digest("base64url");
  return `${header}.${payload}.${sig}`;
}

export function verifyMobileToken(token: string): string | null {
  if (!SECRET) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, payload, sig] = parts;
  const expected = createHmac("sha256", SECRET)
    .update(`${header}.${payload}`)
    .digest("base64url");
  try {
    const sigBuf = Buffer.from(sig, "base64url");
    const expBuf = Buffer.from(expected, "base64url");
    if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) return null;
  } catch {
    return null;
  }
  let data: { sub?: string; exp?: number };
  try {
    data = JSON.parse(Buffer.from(payload, "base64url").toString()) as {
      sub?: string;
      exp?: number;
    };
  } catch {
    return null;
  }
  if (!data.sub) return null;
  if (data.exp && Date.now() / 1000 > data.exp) return null;
  return data.sub;
}
