#!/usr/bin/env node
// Self-validation tripwire (capabilities) — CLI front-end for the pure evaluator.
//
// The loop must never merge a capability it cannot itself VALIDATE in CI. This script reads the
// capabilities manifest + the real repo facts (which files exist, what the CI e2e job runs/sets, which
// secrets are wired, which OWNER_ACTIONS are open) and fails (exit 1) when any active capability isn't
// genuinely proven keyless in CI — or when its owner-secret gap isn't both wired-or-surfaced AND blocking.
//
// Pure file reads (no DB, no build, no network) so it runs as plain `node` and is fast + deterministic.
// The decision logic lives in packages/core/src/self-validation/evaluate.mjs (unit-tested); this file
// only gathers facts. Run: `node scripts/check-self-validation.mjs`.

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { evaluateSelfValidation } from "../packages/core/src/self-validation/evaluate.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const rel = (...p) => join(ROOT, ...p);
const read = (p) => readFileSync(rel(p), "utf8");

// ── manifest ───────────────────────────────────────────────────────────────
const manifest = JSON.parse(read("packages/config/capabilities.json"));
const capabilities = manifest.capabilities ?? [];

// ── CI workflow facts ────────────────────────────────────────────────────────
const CI_YML = read(".github/workflows/ci.yml");

// Slice out the `e2e:` job block (2-space-indented key → up to the next 2-space-indented key) so env /
// run-command checks are scoped to that job, not the whole file.
function jobBlock(name) {
  const re = new RegExp(`\\n  ${name}:\\n`);
  const m = CI_YML.match(re);
  if (!m) return "";
  const start = m.index + 1;
  const rest = CI_YML.slice(start + m[0].length - 1);
  const next = rest.match(/\n  [A-Za-z][\w-]*:\n/);
  return rest.slice(0, next ? next.index : undefined);
}
const E2E_BLOCK = jobBlock("e2e");

// Does the CI e2e job actually RUN this spec? The run command is `pnpm --filter @gm/web e2e <token>`
// where <token> is the spec basename without `.spec.ts` (playwright filters by filename substring).
const ciE2eRunsSpec = (specPath) => {
  const token = basename(specPath).replace(/\.spec\.ts$/, "");
  return E2E_BLOCK.includes(`e2e ${token}`);
};
// Is this env declared on the e2e job (as a `NAME:` env key)?
const ciE2eHasEnv = (envName) => new RegExp(`\\n\\s+${envName}:`).test(E2E_BLOCK);
// Is this secret wired anywhere in CI as ${{ secrets.NAME }}?
const ciSecretWired = (name) => new RegExp(`secrets\\.${name}\\b`).test(CI_YML);

// ── PENDING_OPS OWNER_ACTIONS (surfaced validation gaps) ─────────────────────
const PENDING = existsSync(rel("PENDING_OPS.md")) ? read("PENDING_OPS.md") : "";
function openValidationOwnerActions() {
  const ids = new Set();
  // Split the OWNER_ACTIONS items on `- id:` and inspect each chunk's status + blocks.
  const chunks = PENDING.split(/\n\s*-\s*id:\s*/).slice(1);
  for (const chunk of chunks) {
    const id = (chunk.match(/^([A-Za-z0-9_-]+)/) || [])[1];
    if (!id) continue;
    const body = chunk.split(/\n\s*-\s*id:/)[0];
    const status = (body.match(/\bstatus:\s*([a-z_]+)/) || [])[1];
    const blocks = (body.match(/\bblocks:\s*([a-z_-]+)/) || [])[1];
    if ((status === "open" || status === "in_progress") && blocks === "validation") ids.add(id);
  }
  return ids;
}
const OPEN_VALIDATION_ACTIONS = openValidationOwnerActions();
const isOpenValidationOwnerAction = (actionId) => OPEN_VALIDATION_ACTIONS.has(actionId);

// ── e2e specs: detect env-gated test.skip (the silent-green hole) ─────────────
function e2eSkipEnvs() {
  const dir = rel("apps/web/e2e");
  const out = [];
  if (!existsSync(dir)) return out;
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".spec.ts"))) {
    const text = readFileSync(join(dir, file), "utf8");
    if (!/\.skip\(/.test(text) || !/process\.env/.test(text)) continue;
    // The spec has a conditional skip AND reads process.env — collect the UPPER_SNAKE env names it reads,
    // each of which must be DECLARED in the manifest so a missing one blocks instead of skipping.
    const envs = new Set();
    for (const m of text.matchAll(/process\.env\[?["']?([A-Z][A-Z0-9_]+)["']?\]?/g)) envs.add(m[1]);
    for (const env of envs) out.push({ spec: `apps/web/e2e/${file}`, env });
  }
  return out;
}

// ── evaluate ─────────────────────────────────────────────────────────────────
const result = evaluateSelfValidation({
  capabilities,
  fileExists: (p) => existsSync(rel(p)),
  ciE2eRunsSpec,
  ciE2eHasEnv,
  ciSecretWired,
  isOpenValidationOwnerAction,
  e2eSkipEnvs: e2eSkipEnvs(),
});

// ── report ───────────────────────────────────────────────────────────────────
console.log("── Self-validation tripwire (capabilities) ─────────────────────────");
const active = capabilities.filter((c) => c.status === "active").length;
console.log(`  manifest: ${capabilities.length} capabilities (${active} active)`);
for (const f of result.findings) {
  const tag = f.level === "error" ? "❌" : "✅";
  const who = f.capabilityId ? `[${f.capabilityId}] ` : "";
  console.log(`  ${tag} ${who}${f.message}`);
}
if (!result.ok) {
  console.error(
    "\n  RESULT: ❌ a capability cannot be self-validated in CI. Fix the manifest/CI wiring above, " +
      "or (for an owner-secret gap) wait for the owner to wire the key — this PR is blocked until then.",
  );
  process.exit(1);
}
console.log("\n  RESULT: ✅ every active capability is self-validated in CI.");
