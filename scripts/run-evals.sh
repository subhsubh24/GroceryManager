#!/usr/bin/env bash
# Run the gated LLM eval suite for @gm/core.
#
# Usage:
#   ./scripts/run-evals.sh              # run all evals (requires GEMINI_API_KEY)
#   EVAL_STAGE=recipe-import ./scripts/run-evals.sh  # run a single stage
#
# Evals are in packages/core/src/llm/evals/*.eval.test.ts and are guarded by
# the RUN_EVALS=1 env var so normal CI skips them (no API key cost).  This
# script sets that flag and runs the suite; it is the canonical entrypoint for
# the scheduled eval run (see ROADMAP Track F3).
#
# Exit code: 0 = all evals passed, non-zero = at least one failure.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

if [[ -z "${GEMINI_API_KEY:-}" ]]; then
  echo "ERROR: GEMINI_API_KEY is not set — evals require a live Gemini key." >&2
  exit 1
fi

echo "=== GroceryManager LLM Eval Suite ==="
echo "Date : $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
echo "Stage: ${EVAL_STAGE:-all}"
echo ""

cd "$REPO_ROOT"

if [[ -n "${EVAL_STAGE:-}" ]]; then
  # Run a single stage (pattern match against the eval file name).
  RUN_EVALS=1 pnpm --filter @gm/core exec vitest run "src/llm/evals/${EVAL_STAGE}.eval.test.ts"
else
  # Run the full suite.
  RUN_EVALS=1 pnpm --filter @gm/core exec vitest run src/llm/evals
fi
