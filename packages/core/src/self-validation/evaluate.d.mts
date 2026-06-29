// Types for the pure self-validation evaluator (implementation in evaluate.mjs).

export interface CapabilityValidation {
  /** e2e spec files that prove this capability (must exist AND be run by the CI e2e job). */
  specs?: string[];
  /** unit/degrade test files that prove this capability keyless (run by the `verify` job). */
  tests?: string[];
  /** non-secret envs the CI e2e job MUST set (e.g. EMAIL_CAPTURE_DIR) — else the check would skip. */
  requiresCiEnv?: string[];
  /** OWNER SECRETS required to validate (loop can't supply) — if unwired in CI, that's a blocking gap. */
  requiresOwnerSecret?: string[];
}

export interface Capability {
  id: string;
  summary?: string;
  status: "active" | "planned" | "retired";
  /** OWNER_ACTION id that surfaces an owner-secret gap (required when requiresOwnerSecret is non-empty). */
  ownerActionId?: string | null;
  validation?: CapabilityValidation;
}

export interface SelfValidationFinding {
  level: "error" | "ok";
  capabilityId: string | null;
  message: string;
}

export interface SelfValidationInput {
  capabilities: Capability[];
  fileExists: (path: string) => boolean;
  /** does the CI e2e job actually RUN this spec file? */
  ciE2eRunsSpec: (specPath: string) => boolean;
  /** is this env set on the CI e2e job? */
  ciE2eHasEnv: (envName: string) => boolean;
  /** is this env wired as `${{ secrets.X }}` anywhere in CI? */
  ciSecretWired: (secretName: string) => boolean;
  /** is there an OPEN OWNER_ACTION with this id and blocks: validation? */
  isOpenValidationOwnerAction: (actionId: string) => boolean;
  /** env-gated test.skip occurrences detected in e2e specs. */
  e2eSkipEnvs: Array<{ spec: string; env: string }>;
}

export function evaluateSelfValidation(input: SelfValidationInput): {
  ok: boolean;
  findings: SelfValidationFinding[];
};
