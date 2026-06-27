/**
 * H1 Publishing/scheduling engine.
 * Pure utility functions — no DB access. Callers pass items from the DB.
 * Hard guardrail: only posts to configured OWNED channels. Never auto-creates accounts,
 * never posts to communities/forums, never sends on undisclosed channels.
 */

export interface ContentItem {
  id: string;
  channel: string;
  title: string;
  content: string;
  scheduledAt: Date;
  status: "draft" | "scheduled" | "published" | "skipped";
}

export interface PublishResult {
  published: boolean;
  skipped: boolean;
  reason?: string;
  channelPostId?: string;
}

// ─── Supported owned channels ──────────────────────────────────────────────
// Only these channels are permitted. Community channels (reddit, discord, etc.)
// are hard-blocked at the code level — not just warned about.

const OWNED_CHANNELS = new Set(["x", "twitter", "buffer", "typefully"]);

// ─── Pure utilities ────────────────────────────────────────────────────────

/**
 * Returns items that should be published now:
 * status='scheduled' AND scheduled_at <= now.
 * Pure utility — does not hit the DB.
 */
export function getDueItems(items: ContentItem[], now: Date): ContentItem[] {
  return items.filter(
    (item) => item.status === "scheduled" && item.scheduledAt <= now,
  );
}

// ─── Channel publishers ────────────────────────────────────────────────────

async function publishToX(item: ContentItem): Promise<PublishResult> {
  const apiKey = process.env["X_API_KEY"];
  const apiSecret = process.env["X_API_SECRET"];

  if (!apiKey || !apiSecret) {
    return { published: false, skipped: true, reason: "no-x-credentials" };
  }

  try {
    // X/Twitter v2 API - OAuth 1.0a (bearer or app-only)
    // Using OAuth 2.0 app-only for simplicity — caller must configure a valid bearer token via X_API_KEY
    const res = await fetch("https://api.twitter.com/2/tweets", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text: item.content }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => res.statusText);
      return { published: false, skipped: false, reason: `x:${res.status} ${errText}` };
    }

    const data = (await res.json()) as { data?: { id?: string } };
    return { published: true, skipped: false, channelPostId: data.data?.id };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    return { published: false, skipped: false, reason };
  }
}

async function publishToBuffer(item: ContentItem): Promise<PublishResult> {
  const accessToken = process.env["BUFFER_ACCESS_TOKEN"];

  if (!accessToken) {
    return { published: false, skipped: true, reason: "no-buffer-token" };
  }

  try {
    // Buffer API v1 - create an update (queued)
    const res = await fetch("https://api.bufferapp.com/1/updates/create.json", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        access_token: accessToken,
        text: item.content,
        // scheduled_at: item.scheduledAt.toISOString(), // optionally pass to Buffer
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => res.statusText);
      return { published: false, skipped: false, reason: `buffer:${res.status} ${errText}` };
    }

    const data = (await res.json()) as { updates?: Array<{ id?: string }> };
    const postId = data.updates?.[0]?.id;
    return { published: true, skipped: false, channelPostId: postId };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    return { published: false, skipped: false, reason };
  }
}

async function publishToTypefully(item: ContentItem): Promise<PublishResult> {
  const apiKey = process.env["TYPEFULLY_API_KEY"];

  if (!apiKey) {
    return { published: false, skipped: true, reason: "no-typefully-key" };
  }

  try {
    const res = await fetch("https://api.typefully.com/v1/drafts/", {
      method: "POST",
      headers: {
        "X-API-KEY": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        content: item.content,
        "schedule-date": item.scheduledAt.toISOString(),
        threadify: false,
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => res.statusText);
      return { published: false, skipped: false, reason: `typefully:${res.status} ${errText}` };
    }

    const data = (await res.json()) as { id?: string };
    return { published: true, skipped: false, channelPostId: data.id };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    return { published: false, skipped: false, reason };
  }
}

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * Attempts to publish a single content item to its channel via the owner's authorized API.
 *
 * HARD GUARDRAIL: Only posts to configured OWNED channels (x, twitter, buffer, typefully).
 * Never auto-creates accounts, never posts to communities/forums (reddit, discord, slack, etc.),
 * never sends on undisclosed channels. Blocked channels are refused at code level, not just warned.
 */
export async function publishItem(item: ContentItem): Promise<PublishResult> {
  const channel = item.channel.toLowerCase().trim();

  // Hard block: community/forum/social channels we must never auto-post to
  if (!OWNED_CHANNELS.has(channel)) {
    return {
      published: false,
      skipped: true,
      reason: `channel-not-permitted:${channel} — only owned channels (${[...OWNED_CHANNELS].join(", ")}) are allowed`,
    };
  }

  switch (channel) {
    case "x":
    case "twitter":
      return publishToX(item);

    case "buffer":
      return publishToBuffer(item);

    case "typefully":
      return publishToTypefully(item);

    default:
      // This should never be reached given the OWNED_CHANNELS check above
      return { published: false, skipped: true, reason: `unknown-channel:${channel}` };
  }
}
