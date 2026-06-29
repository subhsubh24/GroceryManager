import { describe, it, expect } from "vitest";
import { evaluateSelfValidation } from "./evaluate.mjs";
import type { Capability, SelfValidationInput } from "./evaluate.d.mts";

/** Build an input with permissive defaults (everything present/wired) so each test perturbs ONE fact. */
function makeInput(capabilities: Capability[], over: Partial<SelfValidationInput> = {}): SelfValidationInput {
  return {
    capabilities,
    fileExists: () => true,
    ciE2eRunsSpec: () => true,
    ciE2eHasEnv: () => true,
    ciSecretWired: () => true,
    isOpenValidationOwnerAction: () => true,
    e2eSkipEnvs: [],
    ...over,
  };
}

const errorsFor = (r: ReturnType<typeof evaluateSelfValidation>, id: string | null) =>
  r.findings.filter((f) => f.level === "error" && f.capabilityId === id);
const firstErr = (r: ReturnType<typeof evaluateSelfValidation>, id: string | null) =>
  errorsFor(r, id)[0]?.message ?? "";

describe("evaluateSelfValidation", () => {
  it("passes when an active capability's spec exists and is run keyless in CI", () => {
    const r = evaluateSelfValidation(
      makeInput([
        { id: "core-journeys", status: "active", validation: { specs: ["apps/web/e2e/journeys.spec.ts"] } },
      ]),
    );
    expect(r.ok).toBe(true);
    expect(r.findings.some((f) => f.level === "ok")).toBe(true);
  });

  it("fails when an active capability declares NO validation evidence", () => {
    const r = evaluateSelfValidation(makeInput([{ id: "ghost", status: "active", validation: {} }]));
    expect(r.ok).toBe(false);
    expect(firstErr(r, "ghost")).toMatch(/NO validation evidence/);
  });

  it("fails when a declared spec file does not exist", () => {
    const r = evaluateSelfValidation(
      makeInput([{ id: "x", status: "active", validation: { specs: ["apps/web/e2e/missing.spec.ts"] } }], {
        fileExists: () => false,
      }),
    );
    expect(r.ok).toBe(false);
    expect(firstErr(r, "x")).toMatch(/does not exist/);
  });

  it("fails when a declared spec exists but the CI e2e job does not run it", () => {
    const r = evaluateSelfValidation(
      makeInput([{ id: "x", status: "active", validation: { specs: ["apps/web/e2e/orphan.spec.ts"] } }], {
        ciE2eRunsSpec: () => false,
      }),
    );
    expect(r.ok).toBe(false);
    expect(firstErr(r, "x")).toMatch(/does not RUN it/);
  });

  it("fails when a required non-secret CI env is missing (the silent-skip hole)", () => {
    // This is exactly the email-roundtrip case: EMAIL_CAPTURE_DIR unset → the spec skips → green-but-unvalidated.
    const r = evaluateSelfValidation(
      makeInput(
        [
          {
            id: "email-roundtrip",
            status: "active",
            validation: { specs: ["apps/web/e2e/email-roundtrip.spec.ts"], requiresCiEnv: ["EMAIL_CAPTURE_DIR"] },
          },
        ],
        { ciE2eHasEnv: (e) => e !== "EMAIL_CAPTURE_DIR" },
      ),
    );
    expect(r.ok).toBe(false);
    expect(firstErr(r, "email-roundtrip")).toMatch(/would SKIP/);
  });

  it("BLOCKS and notes surfacing when an owner secret is unwired but surfaced as an open action", () => {
    const r = evaluateSelfValidation(
      makeInput(
        [
          {
            id: "stripe-sandbox",
            status: "active",
            ownerActionId: "stripe-sandbox-ci",
            validation: { tests: ["packages/core/src/billing/index.test.ts"], requiresOwnerSecret: ["STRIPE_TEST_SECRET_KEY"] },
          },
        ],
        { ciSecretWired: () => false, isOpenValidationOwnerAction: () => true },
      ),
    );
    expect(r.ok).toBe(false);
    const e = errorsFor(r, "stripe-sandbox");
    expect(e[0]?.message).toMatch(/BLOCKED until the owner wires it/);
    expect(e[0]?.message).toMatch(/surfaced as OWNER_ACTION/);
    // surfaced → exactly one error (no extra "not surfaced" finding)
    expect(e).toHaveLength(1);
  });

  it("adds a 'not surfaced' error when an owner-secret gap has no open owner action", () => {
    const r = evaluateSelfValidation(
      makeInput(
        [
          {
            id: "twilio",
            status: "active",
            ownerActionId: "twilio-ci",
            validation: { tests: ["packages/core/src/sms.test.ts"], requiresOwnerSecret: ["TWILIO_AUTH_TOKEN"] },
          },
        ],
        { ciSecretWired: () => false, isOpenValidationOwnerAction: () => false },
      ),
    );
    expect(r.ok).toBe(false);
    expect(errorsFor(r, "twilio").some((f) => /NOT surfaced/.test(f.message))).toBe(true);
  });

  it("flags an undeclared env-gated test.skip in an e2e spec", () => {
    const r = evaluateSelfValidation(
      makeInput([{ id: "core", status: "active", validation: { specs: ["apps/web/e2e/journeys.spec.ts"] } }], {
        e2eSkipEnvs: [{ spec: "apps/web/e2e/new.spec.ts", env: "SOME_NEW_KEY" }],
      }),
    );
    expect(r.ok).toBe(false);
    expect(errorsFor(r, null).some((f) => /undeclared env-gated test\.skip/.test(f.message))).toBe(true);
  });

  it("does not flag an env-gated skip when its env is declared in the manifest", () => {
    const r = evaluateSelfValidation(
      makeInput(
        [
          {
            id: "email-roundtrip",
            status: "active",
            validation: { specs: ["apps/web/e2e/email-roundtrip.spec.ts"], requiresCiEnv: ["EMAIL_CAPTURE_DIR"] },
          },
        ],
        { e2eSkipEnvs: [{ spec: "apps/web/e2e/email-roundtrip.spec.ts", env: "EMAIL_CAPTURE_DIR" }] },
      ),
    );
    expect(r.ok).toBe(true);
  });

  it("ignores planned capabilities entirely", () => {
    const r = evaluateSelfValidation(makeInput([{ id: "future", status: "planned", validation: {} }]));
    expect(r.ok).toBe(true);
  });
});
