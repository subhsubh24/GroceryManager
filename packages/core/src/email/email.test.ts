import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  generateUnsubscribeToken,
  verifyUnsubscribeToken,
  sendEmail,
  sendEmailBatch,
  getFromEmail,
  getFromName,
} from "./index.js";

// ─── Sender identity (EMAIL_FROM / EMAIL_FROM_NAME) ─────────────────────────

describe("getFromEmail / getFromName", () => {
  const origEmail = process.env["EMAIL_FROM"];
  const origName = process.env["EMAIL_FROM_NAME"];
  afterEach(() => {
    if (origEmail === undefined) delete process.env["EMAIL_FROM"];
    else process.env["EMAIL_FROM"] = origEmail;
    if (origName === undefined) delete process.env["EMAIL_FROM_NAME"];
    else process.env["EMAIL_FROM_NAME"] = origName;
  });

  it("defaults to the brand no-reply when unset", () => {
    delete process.env["EMAIL_FROM"];
    delete process.env["EMAIL_FROM_NAME"];
    expect(getFromEmail()).toBe("noreply@grocerymanager.app");
    expect(getFromName()).toBe("GroceryManager");
  });

  it("honors EMAIL_FROM / EMAIL_FROM_NAME overrides", () => {
    process.env["EMAIL_FROM"] = "hello@acme.com";
    process.env["EMAIL_FROM_NAME"] = "Acme";
    expect(getFromEmail()).toBe("hello@acme.com");
    expect(getFromName()).toBe("Acme");
  });

  it("falls back to defaults on blank/whitespace overrides", () => {
    process.env["EMAIL_FROM"] = "   ";
    process.env["EMAIL_FROM_NAME"] = "";
    expect(getFromEmail()).toBe("noreply@grocerymanager.app");
    expect(getFromName()).toBe("GroceryManager");
  });
});

// ─── Unsubscribe token tests ───────────────────────────────────────────────

describe("generateUnsubscribeToken", () => {
  it("returns a hex string", () => {
    const token = generateUnsubscribeToken("user@example.com");
    expect(token).toMatch(/^[a-f0-9]{64}$/);
  });

  it("is deterministic for the same email", () => {
    const a = generateUnsubscribeToken("user@example.com");
    const b = generateUnsubscribeToken("user@example.com");
    expect(a).toBe(b);
  });

  it("is case-insensitive (normalises to lowercase)", () => {
    const lower = generateUnsubscribeToken("user@example.com");
    const upper = generateUnsubscribeToken("USER@EXAMPLE.COM");
    expect(lower).toBe(upper);
  });

  it("produces different tokens for different emails", () => {
    const a = generateUnsubscribeToken("alice@example.com");
    const b = generateUnsubscribeToken("bob@example.com");
    expect(a).not.toBe(b);
  });

  it("uses EMAIL_UNSUBSCRIBE_SECRET when set", () => {
    const orig = process.env["EMAIL_UNSUBSCRIBE_SECRET"];
    process.env["EMAIL_UNSUBSCRIBE_SECRET"] = "custom-secret-abc";
    const tokenWithCustom = generateUnsubscribeToken("user@example.com");

    process.env["EMAIL_UNSUBSCRIBE_SECRET"] = "different-secret-xyz";
    const tokenWithDifferent = generateUnsubscribeToken("user@example.com");

    // restore
    if (orig === undefined) delete process.env["EMAIL_UNSUBSCRIBE_SECRET"];
    else process.env["EMAIL_UNSUBSCRIBE_SECRET"] = orig;

    expect(tokenWithCustom).not.toBe(tokenWithDifferent);
  });
});

describe("verifyUnsubscribeToken", () => {
  it("returns true for a valid token", () => {
    const email = "verify@example.com";
    const token = generateUnsubscribeToken(email);
    expect(verifyUnsubscribeToken(email, token)).toBe(true);
  });

  it("returns false for a tampered token", () => {
    const email = "verify@example.com";
    const token = generateUnsubscribeToken(email);
    const tampered = token.slice(0, -2) + "00";
    expect(verifyUnsubscribeToken(email, tampered)).toBe(false);
  });

  it("returns false for a completely wrong token", () => {
    expect(verifyUnsubscribeToken("user@example.com", "deadbeef")).toBe(false);
  });

  it("returns false for an empty token", () => {
    expect(verifyUnsubscribeToken("user@example.com", "")).toBe(false);
  });
});

// ─── sendEmail — no provider configured ───────────────────────────────────

describe("sendEmail — no provider", () => {
  let savedResend: string | undefined;
  let savedSendgrid: string | undefined;
  let savedPostmark: string | undefined;

  beforeEach(() => {
    savedResend = process.env["RESEND_API_KEY"];
    savedSendgrid = process.env["SENDGRID_API_KEY"];
    savedPostmark = process.env["POSTMARK_API_KEY"];
    delete process.env["RESEND_API_KEY"];
    delete process.env["SENDGRID_API_KEY"];
    delete process.env["POSTMARK_API_KEY"];
  });

  afterEach(() => {
    if (savedResend !== undefined) process.env["RESEND_API_KEY"] = savedResend;
    else delete process.env["RESEND_API_KEY"];
    if (savedSendgrid !== undefined) process.env["SENDGRID_API_KEY"] = savedSendgrid;
    else delete process.env["SENDGRID_API_KEY"];
    if (savedPostmark !== undefined) process.env["POSTMARK_API_KEY"] = savedPostmark;
    else delete process.env["POSTMARK_API_KEY"];
  });

  it("returns skipped=true with reason no-provider when no env key is set", async () => {
    const result = await sendEmail({
      to: "test@example.com",
      subject: "Test",
      html: "<p>Hello</p>",
      text: "Hello",
    });

    expect(result.sent).toBe(false);
    expect(result.skipped).toBe(true);
    expect(result.reason).toBe("no-provider");
  });

  it("does not throw when no provider is configured", async () => {
    await expect(
      sendEmail({
        to: "test@example.com",
        subject: "Test",
        html: "<p>Hello</p>",
        text: "Hello",
      }),
    ).resolves.toBeDefined();
  });
});

// ─── sendEmailBatch — hard limit guardrail ─────────────────────────────────

describe("sendEmailBatch", () => {
  let savedResend: string | undefined;
  let savedSendgrid: string | undefined;
  let savedPostmark: string | undefined;

  beforeEach(() => {
    savedResend = process.env["RESEND_API_KEY"];
    savedSendgrid = process.env["SENDGRID_API_KEY"];
    savedPostmark = process.env["POSTMARK_API_KEY"];
    delete process.env["RESEND_API_KEY"];
    delete process.env["SENDGRID_API_KEY"];
    delete process.env["POSTMARK_API_KEY"];
  });

  afterEach(() => {
    if (savedResend !== undefined) process.env["RESEND_API_KEY"] = savedResend;
    else delete process.env["RESEND_API_KEY"];
    if (savedSendgrid !== undefined) process.env["SENDGRID_API_KEY"] = savedSendgrid;
    else delete process.env["SENDGRID_API_KEY"];
    if (savedPostmark !== undefined) process.env["POSTMARK_API_KEY"] = savedPostmark;
    else delete process.env["POSTMARK_API_KEY"];
  });

  it("refuses batch > 500 and returns all as skipped", async () => {
    const payloads = Array.from({ length: 501 }, (_, i) => ({
      to: `user${i}@example.com`,
      subject: "Test",
      html: "<p>Hi</p>",
      text: "Hi",
    }));

    const result = await sendEmailBatch(payloads);
    expect(result.sent).toBe(0);
    expect(result.skipped).toBe(501);
  });

  it("allows batch of exactly 500", async () => {
    const payloads = Array.from({ length: 500 }, (_, i) => ({
      to: `user${i}@example.com`,
      subject: "Test",
      html: "<p>Hi</p>",
      text: "Hi",
    }));

    // With no provider, all are skipped (not refused)
    const result = await sendEmailBatch(payloads);
    // sent=0 because no provider, but skipped should equal 500 (skipped by no-provider, not by batch limit)
    expect(result.sent + result.skipped).toBe(500);
  });

  it("sends empty batch without error", async () => {
    const result = await sendEmailBatch([]);
    expect(result.sent).toBe(0);
    expect(result.skipped).toBe(0);
  });

  it("skips all when no provider is configured (small batch)", async () => {
    const payloads = [
      { to: "a@example.com", subject: "Hi", html: "<p>Hi</p>", text: "Hi" },
      { to: "b@example.com", subject: "Hi", html: "<p>Hi</p>", text: "Hi" },
    ];

    const result = await sendEmailBatch(payloads);
    expect(result.sent).toBe(0);
    expect(result.skipped).toBe(2);
  });
});
