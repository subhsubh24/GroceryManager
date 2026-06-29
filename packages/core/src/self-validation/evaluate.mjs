// Pure self-validation evaluator — the heart of the "capabilities tripwire".
//
// The loop must never merge a capability it cannot itself VALIDATE. This function takes already-gathered
// FACTS (which files exist, what the CI e2e job runs/sets, which secrets are wired, which owner actions
// are open) and returns errors when an active capability is not genuinely proven keyless in CI. It does
// NO IO of its own, so it is fully unit-testable; scripts/check-self-validation.mjs gathers the facts and
// passes them in. Types live in evaluate.d.mts.
//
// A capability is OK when, for the way it's validated:
//  - every declared spec/test file exists,
//  - every declared e2e spec is actually RUN by the CI e2e job (not just present on disk),
//  - every non-secret CI env it needs (e.g. EMAIL_CAPTURE_DIR) is wired into the e2e job — otherwise its
//    check would SKIP and go green-but-unvalidated,
//  - any OWNER SECRET it needs to validate is wired in CI; if not, that is a BLOCKING error AND must be
//    surfaced as an open OWNER_ACTION (blocks: validation) so the owner sees what to provide.
// Plus a global guard: every env-gated test.skip in an e2e spec must be DECLARED in the manifest, so a
// missing key surfaces here instead of skipping quietly (the exact silent-green hole this exists to kill).

export function evaluateSelfValidation(input) {
  const findings = [];
  const err = (capabilityId, message) => findings.push({ level: "error", capabilityId, message });
  const ok = (capabilityId, message) => findings.push({ level: "ok", capabilityId, message });

  const capabilities = input.capabilities ?? [];

  // Union of every non-secret CI env declared across the manifest — used by the anti-silent-skip guard.
  const declaredCiEnvs = new Set();
  for (const cap of capabilities) {
    for (const e of cap.validation?.requiresCiEnv ?? []) declaredCiEnvs.add(e);
  }

  for (const cap of capabilities) {
    if (cap.status !== "active") continue; // planned/retired capabilities are not gated
    const id = cap.id;
    const v = cap.validation ?? {};
    const specs = v.specs ?? [];
    const tests = v.tests ?? [];
    const requiresCiEnv = v.requiresCiEnv ?? [];
    const requiresOwnerSecret = v.requiresOwnerSecret ?? [];

    if (specs.length === 0 && tests.length === 0) {
      err(
        id,
        "active capability has NO validation evidence — declare an e2e spec or a unit/degrade test that proves it KEYLESS in CI.",
      );
    }
    for (const f of specs) {
      if (!input.fileExists(f)) {
        err(id, `declared e2e spec does not exist: ${f}`);
      } else if (!input.ciE2eRunsSpec(f)) {
        err(
          id,
          `e2e spec is declared but the CI e2e job does not RUN it: ${f} — add it to the e2e job, otherwise it never validates anything.`,
        );
      }
    }
    for (const f of tests) {
      if (!input.fileExists(f)) err(id, `declared unit/degrade test does not exist: ${f}`);
    }
    for (const e of requiresCiEnv) {
      if (!input.ciE2eHasEnv(e)) {
        err(
          id,
          `requires CI env ${e} on the e2e job, but it is NOT set — its check would SKIP and go green-but-unvalidated. Wire ${e} into the e2e job (no secret needed) or add a keyless test.`,
        );
      }
    }
    if (requiresOwnerSecret.length > 0 && !cap.ownerActionId) {
      err(
        id,
        "requiresOwnerSecret is set but ownerActionId is empty — link the surfaced OWNER_ACTION so the owner knows what to provide.",
      );
    }
    for (const s of requiresOwnerSecret) {
      if (input.ciSecretWired(s)) continue; // owner already wired it → this capability can self-validate
      const surfaced = !!cap.ownerActionId && input.isOpenValidationOwnerAction(cap.ownerActionId);
      err(
        id,
        `needs OWNER SECRET ${s} to self-validate, which is not wired in CI yet${
          surfaced ? ` (surfaced as OWNER_ACTION '${cap.ownerActionId}', blocks: validation)` : ""
        }. This PR is BLOCKED until the owner wires it (or the loop adds a keyless/degrade test).`,
      );
      if (!surfaced) {
        err(
          id,
          `the owner-secret gap for ${s} is NOT surfaced — add an urgent OWNER_ACTION '${
            cap.ownerActionId ?? "validation-capability-<service>"
          }' (priority: urgent, blocks: validation) in PENDING_OPS AND list this id in LOOP_HEALTH.validation.unmet. An unmet capability invisible to the owner is a bug — it must appear in BOTH places.`,
        );
      }
    }
  }

  // Anti-silent-skip: every env-gated test.skip in an e2e spec must be declared, so a missing key BLOCKS
  // here instead of the spec passing vacuously.
  for (const { spec, env } of input.e2eSkipEnvs ?? []) {
    if (!declaredCiEnvs.has(env)) {
      err(
        null,
        `undeclared env-gated test.skip in ${spec}: it skips when ${env} is unset, but ${env} is not declared in any capability's requiresCiEnv. Register the capability + ${env} so a missing key BLOCKS instead of silently passing.`,
      );
    }
  }

  const errors = findings.filter((f) => f.level === "error");
  if (errors.length === 0) {
    ok(
      null,
      "all active capabilities are self-validated keyless in CI (or their owner-secret gaps are wired, or surfaced + blocking).",
    );
  }
  return { ok: errors.length === 0, findings };
}
