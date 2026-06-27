/**
 * H5 Growth guardrails — hard policy enforcement for growth actions.
 * Certain actions are ALWAYS blocked at the code level regardless of context.
 * Others require explicit owner authorization or specific conditions.
 *
 * This module is intentionally simple and policy-only — no IO, no state.
 * It is the last line of defense and must be called before any growth action is taken.
 */

export type GrowthAction =
  | "post_to_owned_channel"
  | "send_email_to_optin_list"
  | "post_to_community"       // ALWAYS BLOCKED
  | "auto_create_account"     // ALWAYS BLOCKED
  | "fake_engagement"         // ALWAYS BLOCKED
  | "spend_ad_money"          // ALWAYS BLOCKED without explicit owner authorization
  | "post_under_owner_identity"; // Only allowed if channel is authorized

export interface GuardrailContext {
  channel?: string;
  channelKeyPresent?: boolean;
  recipientOptedIn?: boolean;
  ownerExplicitlyAuthorized?: boolean;
}

export interface GuardrailResult {
  allowed: boolean;
  reason: string;
}

// ─── Hard-blocked actions ──────────────────────────────────────────────────

const ALWAYS_BLOCKED: Partial<Record<GrowthAction, string>> = {
  post_to_community:
    "Posting to communities/forums (Reddit, Discord, Slack, etc.) is permanently blocked — " +
    "unsolicited community posts violate platform rules and user trust.",
  auto_create_account:
    "Auto-creating accounts is permanently blocked — " +
    "this constitutes impersonation and violates every platform's ToS.",
  fake_engagement:
    "Fake engagement (bots, fake likes, purchased followers) is permanently blocked — " +
    "this is fraudulent and violates platform terms.",
};

// ─── Policy table ──────────────────────────────────────────────────────────

/**
 * Hard policy: certain actions are ALWAYS blocked regardless of context.
 * Others are allowed only when the required authorization/context is present.
 */
export function checkGuardrail(
  action: GrowthAction,
  ctx: GuardrailContext,
): GuardrailResult {
  // 1. Hard blocks — no escape hatch
  const hardBlock = ALWAYS_BLOCKED[action];
  if (hardBlock !== undefined) {
    return { allowed: false, reason: hardBlock };
  }

  // 2. Conditional rules
  switch (action) {
    case "post_to_owned_channel":
      if (!ctx.channelKeyPresent) {
        return {
          allowed: false,
          reason: `No API key configured for channel "${ctx.channel ?? "unknown"}" — cannot post to owned channel without authorization.`,
        };
      }
      return {
        allowed: true,
        reason: `Channel "${ctx.channel}" is authorized (key present) — posting to owned channel is permitted.`,
      };

    case "send_email_to_optin_list":
      if (!ctx.recipientOptedIn) {
        return {
          allowed: false,
          reason:
            "Recipient has not explicitly opted in — sending unsolicited email is blocked. " +
            "Only send to users who have confirmed opt-in.",
        };
      }
      return {
        allowed: true,
        reason: "Recipient is opted in — transactional/lifecycle email is permitted.",
      };

    case "spend_ad_money":
      if (!ctx.ownerExplicitlyAuthorized) {
        return {
          allowed: false,
          reason:
            "Spending ad money requires explicit owner authorization — " +
            "set ownerExplicitlyAuthorized=true after the owner confirms budget + campaign details.",
        };
      }
      return {
        allowed: true,
        reason: "Owner has explicitly authorized ad spend — proceeding.",
      };

    case "post_under_owner_identity":
      if (!ctx.channelKeyPresent) {
        return {
          allowed: false,
          reason:
            "Posting under owner identity requires an authorized channel key — " +
            "configure the channel API key first.",
        };
      }
      if (!ctx.ownerExplicitlyAuthorized) {
        return {
          allowed: false,
          reason:
            "Posting under owner identity requires explicit owner authorization — " +
            "the owner must confirm this action before proceeding.",
        };
      }
      return {
        allowed: true,
        reason:
          "Channel key present and owner has explicitly authorized — posting under owner identity is permitted.",
      };

    case "post_to_community":
    case "auto_create_account":
    case "fake_engagement": {
      // These should have been caught by ALWAYS_BLOCKED above, but TypeScript needs exhaustive coverage.
      // This path is unreachable in practice.
      return {
        allowed: false,
        reason: `${action} is permanently blocked and should have been caught earlier.`,
      };
    }
  }
}

// ─── Summary for reporting ─────────────────────────────────────────────────

/**
 * Human-readable summary of what's blocked and why — for the Growth Agent to report to the owner.
 */
export function getGuardrailSummary(): string {
  return [
    "=== Growth Guardrails Summary ===",
    "",
    "ALWAYS BLOCKED (no override possible):",
    "  • post_to_community — unsolicited community/forum posts are permanently forbidden.",
    "  • auto_create_account — automated account creation is permanently forbidden.",
    "  • fake_engagement — fake likes, bots, purchased followers are permanently forbidden.",
    "",
    "CONDITIONALLY ALLOWED (require authorization):",
    "  • post_to_owned_channel — requires channel API key to be configured.",
    "  • send_email_to_optin_list — requires recipient to have explicitly opted in.",
    "  • spend_ad_money — requires explicit owner authorization before each campaign.",
    "  • post_under_owner_identity — requires channel key AND explicit owner authorization.",
    "",
    "These guardrails are enforced at the code level and cannot be bypassed via configuration.",
  ].join("\n");
}
