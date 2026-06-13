/**
 * Gmail API client (PLAN §5.1) — read-only message access for an access token. Network,
 * token-gated (runs once Auth provides a token). watch/history power push + the poll fallback.
 */
import type { GmailHeader, GmailPart } from "./parse.js";

const GMAIL = "https://gmail.googleapis.com/gmail/v1/users/me";

export interface GmailMessage {
  id: string;
  threadId: string;
  historyId?: string;
  internalDate?: string;
  payload?: GmailPart & { headers?: GmailHeader[] };
}

export class GmailClient {
  constructor(private readonly accessToken: string) {}

  private headers() {
    return { Authorization: `Bearer ${this.accessToken}` };
  }

  /** List message ids matching a Gmail search query (e.g. from known retailers). */
  async listMessageIds(opts: { q?: string; pageToken?: string; maxResults?: number } = {}): Promise<{
    ids: string[];
    nextPageToken?: string;
  }> {
    const p = new URLSearchParams();
    if (opts.q) p.set("q", opts.q);
    if (opts.pageToken) p.set("pageToken", opts.pageToken);
    p.set("maxResults", String(opts.maxResults ?? 25));
    const res = await fetch(`${GMAIL}/messages?${p.toString()}`, { headers: this.headers() });
    if (!res.ok) throw new Error(`Gmail messages.list ${res.status}: ${await res.text()}`);
    const json = (await res.json()) as { messages?: { id: string }[]; nextPageToken?: string };
    return { ids: (json.messages ?? []).map((m) => m.id), nextPageToken: json.nextPageToken };
  }

  async getMessage(id: string): Promise<GmailMessage> {
    const res = await fetch(`${GMAIL}/messages/${id}?format=full`, { headers: this.headers() });
    if (!res.ok) throw new Error(`Gmail messages.get ${res.status}: ${await res.text()}`);
    return (await res.json()) as GmailMessage;
  }

  /** Pull changes since a historyId (the reliable, dedup-friendly sync path). */
  async historyMessageIds(startHistoryId: string): Promise<{ ids: string[]; historyId?: string }> {
    const p = new URLSearchParams({ startHistoryId, historyTypes: "messageAdded" });
    const res = await fetch(`${GMAIL}/history?${p.toString()}`, { headers: this.headers() });
    if (!res.ok) throw new Error(`Gmail history.list ${res.status}: ${await res.text()}`);
    const json = (await res.json()) as {
      history?: { messagesAdded?: { message: { id: string } }[] }[];
      historyId?: string;
    };
    const ids = (json.history ?? []).flatMap((h) => (h.messagesAdded ?? []).map((m) => m.message.id));
    return { ids: [...new Set(ids)], historyId: json.historyId };
  }

  /** Register a Pub/Sub watch (renew ≤7 days). */
  async watch(topicName: string): Promise<{ historyId: string; expiration: string }> {
    const res = await fetch(`${GMAIL}/watch`, {
      method: "POST",
      headers: { ...this.headers(), "Content-Type": "application/json" },
      body: JSON.stringify({ topicName, labelIds: ["INBOX"] }),
    });
    if (!res.ok) throw new Error(`Gmail watch ${res.status}: ${await res.text()}`);
    return (await res.json()) as { historyId: string; expiration: string };
  }
}

/** Gmail search query for known-retailer receipts (used by the poll worker). */
export const RECEIPT_QUERY =
  "from:(amazon.com OR wholefoodsmarket.com OR instacart.com) (order OR receipt OR delivered)";
