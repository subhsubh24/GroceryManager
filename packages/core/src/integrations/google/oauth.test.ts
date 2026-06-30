import { afterEach, describe, expect, it, vi } from "vitest";
import { refreshGoogleAccessToken } from "./oauth.js";

function stubFetch(json: unknown, init?: { ok?: boolean; status?: number; text?: string }) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fn = vi.fn(async (url: string, reqInit?: RequestInit) => {
    calls.push({ url: String(url), init: reqInit });
    return {
      ok: init?.ok ?? true,
      status: init?.status ?? 200,
      json: async () => json,
      text: async () => init?.text ?? "",
    } as Response;
  });
  vi.stubGlobal("fetch", fn);
  const call = (i = 0) => {
    const c = calls[i];
    if (!c) throw new Error(`expected fetch call #${i} but it was not made`);
    return c;
  };
  return { call };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("refreshGoogleAccessToken", () => {
  it("exchanges the refresh token and computes expiresAt from expires_in", async () => {
    const before = Date.now();
    const { call } = stubFetch({ access_token: "fresh-token", expires_in: 3600 });
    const res = await refreshGoogleAccessToken("refresh-abc", "client-id", "client-secret");

    expect(res.accessToken).toBe("fresh-token");
    // expiresAt ≈ now + 3600s (allow a small window for execution time).
    const deltaMs = res.expiresAt.getTime() - before;
    expect(deltaMs).toBeGreaterThanOrEqual(3600 * 1000 - 50);
    expect(deltaMs).toBeLessThanOrEqual(3600 * 1000 + 5_000);

    // POSTs the OAuth token endpoint with the grant body + a timeout signal.
    expect(call().url).toBe("https://oauth2.googleapis.com/token");
    expect(call().init?.method).toBe("POST");
    const body = String(call().init?.body);
    expect(body).toContain("grant_type=refresh_token");
    expect(body).toContain("refresh_token=refresh-abc");
    expect(body).toContain("client_id=client-id");
    expect(call().init?.signal).toBeInstanceOf(AbortSignal);
  });

  it("throws (so the sync can degrade) on a non-ok token response, including the status", async () => {
    stubFetch(null, { ok: false, status: 400, text: "invalid_grant" });
    await expect(
      refreshGoogleAccessToken("bad", "id", "secret"),
    ).rejects.toThrow(/Google token refresh 400/);
  });
});
