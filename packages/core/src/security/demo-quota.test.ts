import { beforeEach, describe, expect, it } from "vitest";
import {
  __resetDemoQuota,
  checkDemoQuota,
  demoQuotaLimits,
  type DemoQuotaLimits,
} from "./demo-quota.js";

const T0 = Date.UTC(2026, 6, 8, 12, 0, 0); // 2026-07-08T12:00:00Z
const NEXT_DAY = Date.UTC(2026, 6, 9, 0, 30, 0); // 2026-07-09T00:30:00Z

const smallLimits: DemoQuotaLimits = { perIpDaily: 2, globalDaily: 3 };

describe("demoQuotaLimits", () => {
  it("defaults are conservative and never unbounded", () => {
    const l = demoQuotaLimits({});
    expect(l.perIpDaily).toBe(5);
    expect(l.globalDaily).toBe(500);
  });

  it("reads positive overrides from the environment", () => {
    const l = demoQuotaLimits({ DEMO_PARSE_LIMIT_PER_IP: "3", DEMO_PARSE_LIMIT_GLOBAL: "50" });
    expect(l).toEqual({ perIpDaily: 3, globalDaily: 50 });
  });

  it("falls back to defaults for junk / zero / negative values (never unbounded)", () => {
    expect(demoQuotaLimits({ DEMO_PARSE_LIMIT_PER_IP: "0" }).perIpDaily).toBe(5);
    expect(demoQuotaLimits({ DEMO_PARSE_LIMIT_PER_IP: "-4" }).perIpDaily).toBe(5);
    expect(demoQuotaLimits({ DEMO_PARSE_LIMIT_GLOBAL: "abc" }).globalDaily).toBe(500);
  });
});

describe("checkDemoQuota", () => {
  beforeEach(() => __resetDemoQuota());

  it("allows up to the per-IP ceiling, then denies with reason 'ip'", () => {
    const opts = { now: T0, limits: smallLimits };
    expect(checkDemoQuota("1.1.1.1", opts)).toEqual({ allowed: true, reason: "ok" });
    expect(checkDemoQuota("1.1.1.1", opts)).toEqual({ allowed: true, reason: "ok" });
    // 3rd from the same IP exceeds perIpDaily=2.
    expect(checkDemoQuota("1.1.1.1", opts)).toEqual({ allowed: false, reason: "ip" });
  });

  it("enforces the GLOBAL ceiling across rotating IPs (the wallet-drain bound)", () => {
    const opts = { now: T0, limits: smallLimits }; // globalDaily=3
    expect(checkDemoQuota("a", opts).allowed).toBe(true);
    expect(checkDemoQuota("b", opts).allowed).toBe(true);
    expect(checkDemoQuota("c", opts).allowed).toBe(true);
    // 4th distinct IP is under its own per-IP cap but the global budget is spent.
    expect(checkDemoQuota("d", opts)).toEqual({ allowed: false, reason: "global" });
  });

  it("a denied call does NOT consume budget (no phantom increment)", () => {
    const opts = { now: T0, limits: { perIpDaily: 1, globalDaily: 10 } };
    expect(checkDemoQuota("x", opts).allowed).toBe(true);
    expect(checkDemoQuota("x", opts).allowed).toBe(false); // over per-IP
    expect(checkDemoQuota("x", opts).allowed).toBe(false); // still denied, global untouched
    // A different IP still has the full global budget available.
    expect(checkDemoQuota("y", opts).allowed).toBe(true);
  });

  it("resets both counters at the UTC day boundary", () => {
    const opts = { now: T0, limits: smallLimits };
    checkDemoQuota("1.1.1.1", opts);
    checkDemoQuota("1.1.1.1", opts);
    expect(checkDemoQuota("1.1.1.1", opts).allowed).toBe(false); // per-IP spent today
    // Next UTC day → fresh budget.
    const next = { now: NEXT_DAY, limits: smallLimits };
    expect(checkDemoQuota("1.1.1.1", next)).toEqual({ allowed: true, reason: "ok" });
  });
});
