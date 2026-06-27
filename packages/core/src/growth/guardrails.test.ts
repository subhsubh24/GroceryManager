import { describe, it, expect } from "vitest";
import { checkGuardrail, getGuardrailSummary, type GrowthAction } from "./guardrails.js";

// ─── Always-blocked actions ────────────────────────────────────────────────

describe("checkGuardrail — always blocked", () => {
  const alwaysBlocked: GrowthAction[] = [
    "post_to_community",
    "auto_create_account",
    "fake_engagement",
  ];

  for (const action of alwaysBlocked) {
    it(`blocks ${action} regardless of context (empty ctx)`, () => {
      const result = checkGuardrail(action, {});
      expect(result.allowed).toBe(false);
      expect(result.reason.length).toBeGreaterThan(0);
    });

    it(`blocks ${action} even with all authorizations present`, () => {
      const result = checkGuardrail(action, {
        channelKeyPresent: true,
        recipientOptedIn: true,
        ownerExplicitlyAuthorized: true,
        channel: "test-channel",
      });
      expect(result.allowed).toBe(false);
    });
  }
});

// ─── post_to_owned_channel ─────────────────────────────────────────────────

describe("checkGuardrail — post_to_owned_channel", () => {
  it("allows when channel key is present", () => {
    const result = checkGuardrail("post_to_owned_channel", {
      channel: "twitter",
      channelKeyPresent: true,
    });
    expect(result.allowed).toBe(true);
  });

  it("blocks when channel key is absent", () => {
    const result = checkGuardrail("post_to_owned_channel", {
      channel: "twitter",
      channelKeyPresent: false,
    });
    expect(result.allowed).toBe(false);
  });

  it("blocks when channelKeyPresent is undefined", () => {
    const result = checkGuardrail("post_to_owned_channel", {});
    expect(result.allowed).toBe(false);
  });
});

// ─── send_email_to_optin_list ──────────────────────────────────────────────

describe("checkGuardrail — send_email_to_optin_list", () => {
  it("allows when recipient has opted in", () => {
    const result = checkGuardrail("send_email_to_optin_list", {
      recipientOptedIn: true,
    });
    expect(result.allowed).toBe(true);
  });

  it("blocks when recipient has not opted in", () => {
    const result = checkGuardrail("send_email_to_optin_list", {
      recipientOptedIn: false,
    });
    expect(result.allowed).toBe(false);
  });

  it("blocks when recipientOptedIn is undefined", () => {
    const result = checkGuardrail("send_email_to_optin_list", {});
    expect(result.allowed).toBe(false);
  });
});

// ─── spend_ad_money ────────────────────────────────────────────────────────

describe("checkGuardrail — spend_ad_money", () => {
  it("allows when owner has explicitly authorized", () => {
    const result = checkGuardrail("spend_ad_money", {
      ownerExplicitlyAuthorized: true,
    });
    expect(result.allowed).toBe(true);
  });

  it("blocks when owner has not authorized", () => {
    const result = checkGuardrail("spend_ad_money", {
      ownerExplicitlyAuthorized: false,
    });
    expect(result.allowed).toBe(false);
  });

  it("blocks when ownerExplicitlyAuthorized is undefined", () => {
    const result = checkGuardrail("spend_ad_money", {});
    expect(result.allowed).toBe(false);
  });
});

// ─── post_under_owner_identity ─────────────────────────────────────────────

describe("checkGuardrail — post_under_owner_identity", () => {
  it("allows when channel key present AND owner authorized", () => {
    const result = checkGuardrail("post_under_owner_identity", {
      channel: "x",
      channelKeyPresent: true,
      ownerExplicitlyAuthorized: true,
    });
    expect(result.allowed).toBe(true);
  });

  it("blocks when channel key is missing even with owner authorization", () => {
    const result = checkGuardrail("post_under_owner_identity", {
      channel: "x",
      channelKeyPresent: false,
      ownerExplicitlyAuthorized: true,
    });
    expect(result.allowed).toBe(false);
  });

  it("blocks when owner not authorized even with channel key", () => {
    const result = checkGuardrail("post_under_owner_identity", {
      channel: "x",
      channelKeyPresent: true,
      ownerExplicitlyAuthorized: false,
    });
    expect(result.allowed).toBe(false);
  });

  it("blocks when both are missing", () => {
    const result = checkGuardrail("post_under_owner_identity", {});
    expect(result.allowed).toBe(false);
  });
});

// ─── Reason strings ────────────────────────────────────────────────────────

describe("checkGuardrail — reason strings", () => {
  it("always returns a non-empty reason", () => {
    const actions: GrowthAction[] = [
      "post_to_owned_channel",
      "send_email_to_optin_list",
      "post_to_community",
      "auto_create_account",
      "fake_engagement",
      "spend_ad_money",
      "post_under_owner_identity",
    ];

    for (const action of actions) {
      const result = checkGuardrail(action, {
        channelKeyPresent: true,
        recipientOptedIn: true,
        ownerExplicitlyAuthorized: true,
      });
      expect(result.reason.length, `${action} should have a reason`).toBeGreaterThan(0);
    }
  });
});

// ─── getGuardrailSummary ───────────────────────────────────────────────────

describe("getGuardrailSummary", () => {
  it("returns a non-empty string", () => {
    const summary = getGuardrailSummary();
    expect(typeof summary).toBe("string");
    expect(summary.length).toBeGreaterThan(50);
  });

  it("mentions the always-blocked actions", () => {
    const summary = getGuardrailSummary();
    expect(summary).toContain("post_to_community");
    expect(summary).toContain("auto_create_account");
    expect(summary).toContain("fake_engagement");
  });

  it("mentions conditionally allowed actions", () => {
    const summary = getGuardrailSummary();
    expect(summary).toContain("post_to_owned_channel");
    expect(summary).toContain("send_email_to_optin_list");
    expect(summary).toContain("spend_ad_money");
  });
});
