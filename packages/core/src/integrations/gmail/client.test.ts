import { afterEach, describe, expect, it, vi } from "vitest";
import { GmailClient, RECEIPT_QUERY } from "./client.js";

/**
 * Capture every fetch call (url + init) and return a canned response. Lets us assert both the
 * parsed result AND that each call carries an AbortSignal (the timeout wiring — a hung Gmail API
 * must fail fast inside the serverless budget, not hang until the platform 504s it).
 */
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
  // `call(i)` narrows away the `undefined` from index access and asserts the call happened.
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

const TOKEN = "ya29.test-access-token";

describe("GmailClient.listMessageIds", () => {
  it("maps the messages array to ids, threads the query + maxResults, and passes a timeout signal", async () => {
    const { call } = stubFetch({ messages: [{ id: "a" }, { id: "b" }], nextPageToken: "next" });
    const res = await new GmailClient(TOKEN).listMessageIds({ q: RECEIPT_QUERY, maxResults: 10 });
    expect(res).toEqual({ ids: ["a", "b"], nextPageToken: "next" });
    expect(call().url).toContain("/messages?");
    const params = new URL(call().url).searchParams;
    expect(params.get("q")).toBe(RECEIPT_QUERY); // round-trips through URLSearchParams encoding
    expect(params.get("maxResults")).toBe("10");
    expect((call().init?.headers as Record<string, string>).Authorization).toBe(`Bearer ${TOKEN}`);
    expect(call().init?.signal).toBeInstanceOf(AbortSignal);
  });

  it("defaults maxResults to 25 and returns an empty list when the API omits messages", async () => {
    const { call } = stubFetch({});
    const res = await new GmailClient(TOKEN).listMessageIds();
    expect(res).toEqual({ ids: [], nextPageToken: undefined });
    expect(call().url).toContain("maxResults=25");
  });

  it("throws on a non-ok response (so the caller can degrade), including the status", async () => {
    stubFetch(null, { ok: false, status: 401, text: "Unauthorized" });
    await expect(new GmailClient(TOKEN).listMessageIds()).rejects.toThrow(/Gmail messages.list 401/);
  });
});

describe("GmailClient.getMessage", () => {
  it("fetches the full message by id with a timeout signal", async () => {
    const { call } = stubFetch({ id: "m1", threadId: "t1", internalDate: "123" });
    const msg = await new GmailClient(TOKEN).getMessage("m1");
    expect(msg.id).toBe("m1");
    expect(call().url).toContain("/messages/m1?format=full");
    expect(call().init?.signal).toBeInstanceOf(AbortSignal);
  });

  it("throws on a non-ok response", async () => {
    stubFetch(null, { ok: false, status: 404, text: "Not Found" });
    await expect(new GmailClient(TOKEN).getMessage("nope")).rejects.toThrow(/Gmail messages.get 404/);
  });
});

describe("GmailClient.historyMessageIds", () => {
  it("flattens + dedupes messagesAdded ids and returns the new historyId", async () => {
    const { call } = stubFetch({
      history: [
        { messagesAdded: [{ message: { id: "x" } }, { message: { id: "y" } }] },
        { messagesAdded: [{ message: { id: "x" } }] }, // duplicate across pages
      ],
      historyId: "999",
    });
    const res = await new GmailClient(TOKEN).historyMessageIds("100");
    expect(res.ids).toEqual(["x", "y"]);
    expect(res.historyId).toBe("999");
    expect(call().url).toContain("startHistoryId=100");
    expect(call().init?.signal).toBeInstanceOf(AbortSignal);
  });

  it("returns an empty id list when there is no history", async () => {
    stubFetch({ historyId: "100" });
    const res = await new GmailClient(TOKEN).historyMessageIds("100");
    expect(res.ids).toEqual([]);
  });
});

describe("GmailClient.watch", () => {
  it("POSTs the topic + INBOX label and returns the watch result with a timeout signal", async () => {
    const { call } = stubFetch({ historyId: "5", expiration: "1700000000000" });
    const res = await new GmailClient(TOKEN).watch("projects/p/topics/t");
    expect(res).toEqual({ historyId: "5", expiration: "1700000000000" });
    expect(call().init?.method).toBe("POST");
    expect(JSON.parse(String(call().init?.body))).toEqual({
      topicName: "projects/p/topics/t",
      labelIds: ["INBOX"],
    });
    expect(call().init?.signal).toBeInstanceOf(AbortSignal);
  });

  it("throws on a non-ok response", async () => {
    stubFetch(null, { ok: false, status: 403, text: "Forbidden" });
    await expect(new GmailClient(TOKEN).watch("t")).rejects.toThrow(/Gmail watch 403/);
  });
});
