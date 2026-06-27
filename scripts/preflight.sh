#!/usr/bin/env bash
# GroceryManager — full pre-flight gate.
# Run before opening the 'FACTORY: ready for submission' issue.
# Exits non-zero when any factory-owned check fails; warns on Human Core items.
# Usage: bash scripts/preflight.sh
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT"

PASS=0
FAIL=0
WARN=0

pass() { echo "  ✅  $1"; PASS=$((PASS+1)); }
fail() { echo "  ❌  $1"; FAIL=$((FAIL+1)); }
warn() { echo "  ⚠️   $1"; WARN=$((WARN+1)); }
section() { echo ""; echo "── $1 ─────────────────────────────────────────────"; }

echo "======================================================"
echo " GroceryManager — Pre-flight gate  $(date -u '+%Y-%m-%d %H:%M UTC')"
echo "======================================================"

# ── 1. Monorepo typecheck ──────────────────────────────────
section "1. Typecheck (pnpm -r)"
if pnpm -r run typecheck 2>&1 | tee /tmp/gm-typecheck.log | grep -q "error TS"; then
  fail "typecheck: TypeScript errors found (see /tmp/gm-typecheck.log)"
else
  pass "typecheck: all packages pass tsc --noEmit"
fi

# ── 2. Core unit tests ────────────────────────────────────
section "2. Core tests"
set +e
TEST_OUT=$(pnpm --filter @gm/core test 2>&1)
TEST_EXIT=$?
set -e
echo "$TEST_OUT" | tail -5
if [ $TEST_EXIT -ne 0 ]; then
  fail "core tests: exited $TEST_EXIT"
elif echo "$TEST_OUT" | grep -q "Test Files.*failed\|Tests.*failed"; then
  fail "core tests: failures detected"
elif echo "$TEST_OUT" | grep -q "passed"; then
  PASS_LINE=$(echo "$TEST_OUT" | grep "Tests.*passed" | tail -1)
  pass "core tests: $PASS_LINE"
else
  fail "core tests: unexpected output"
fi

# ── 3. Production next build ──────────────────────────────
section "3. Production build (apps/web)"
set +e
BUILD_LOG=$(NODE_ENV=production DATABASE_URL=postgres://u:p@localhost:5432/db pnpm --filter web build 2>&1)
BUILD_EXIT=$?
set -e
echo "$BUILD_LOG" | tail -8
if [ $BUILD_EXIT -ne 0 ]; then
  fail "next build: exited $BUILD_EXIT"
else
  pass "next build: exit 0"
fi

# Missing-export grep (next build exits 0 even on broken re-exports)
if echo "$BUILD_LOG" | grep -qE "Attempted import|is not exported from|was not found"; then
  fail "next build: missing-export warning detected"
else
  pass "next build: no missing-export warnings"
fi

# ── 4. Mobile typecheck ───────────────────────────────────
section "4. Mobile typecheck (apps/mobile)"
set +e
MOBILE_OUT=$(cd "$ROOT/apps/mobile" && npm ci 2>&1 && npm run typecheck 2>&1)
MOBILE_EXIT=$?
set -e
echo "$MOBILE_OUT" | tail -5
if [ $MOBILE_EXIT -ne 0 ] || echo "$MOBILE_OUT" | grep -qE "^.*error TS[0-9]+"; then
  fail "mobile typecheck: TypeScript errors (exit $MOBILE_EXIT)"
else
  pass "mobile typecheck: tsc --noEmit clean"
fi

# ── 5. Required doc artifacts ─────────────────────────────
section "5. Required documents"
for f in \
  "docs/LAUNCH.md" \
  "docs/BUSINESS_CASE.md" \
  "docs/OPERATIONS.md" \
  "docs/store/ACCEPTANCE_AUDIT.md" \
  "docs/store/ASO_READY.md" \
  "docs/store/store-assets-spec.md" \
  "docs/store/privacy-disclosures.md" \
  "docs/brand/BRAND_KIT.md" \
  "docs/brand/EMAIL_LIFECYCLE.md" \
  "docs/brand/LAUNCH_PLAN.md" \
  "docs/brand/PRESS_KIT.md" \
; do
  if [ -f "$ROOT/$f" ]; then
    pass "doc: $f"
  else
    fail "doc missing: $f"
  fi
done

# ── 6. ACCEPTANCE_AUDIT: no open FAILs ───────────────────
section "6. Acceptance audit — no FAILs"
AUDIT="$ROOT/docs/store/ACCEPTANCE_AUDIT.md"
if grep -q "^.*Verdict:.*❌\|^.*FAIL\b" "$AUDIT" 2>/dev/null; then
  fail "ACCEPTANCE_AUDIT.md contains open FAILs — fix before submission"
else
  pass "ACCEPTANCE_AUDIT.md: zero open FAILs (HIGH CONFIDENCE verdict)"
fi

# ── 7. BUSINESS_CASE: required sections ──────────────────
section "7. Business case — required sections"
BC="$ROOT/docs/BUSINESS_CASE.md"
for section_name in "Pricing" "Unit economics" "revenue" "100 K\|100K"; do
  if grep -qi "$section_name" "$BC" 2>/dev/null; then
    pass "BUSINESS_CASE.md: section '$section_name' present"
  else
    fail "BUSINESS_CASE.md: section '$section_name' missing"
  fi
done
# Verify ≥$100K/yr claim is substantiated
if grep -qE '\$1[0-9][0-9],?[0-9]00|\$[0-9]+K.*(yr|year)|100.*(K|k).*yr' "$BC" 2>/dev/null; then
  pass "BUSINESS_CASE.md: ≥\$100K/yr revenue path cited"
else
  warn "BUSINESS_CASE.md: ≥\$100K/yr number not found — verify document"
fi
# The machine-readable BUSINESS_CASE_SUMMARY block MUST parse as valid YAML (the dashboard reads it).
# A malformed block (e.g. a bad escape) → dashboard degrades to "unparseable → link", never a number.
if python3 - "$BC" <<'PY'
import sys, re, yaml
txt = open(sys.argv[1]).read()
m = re.search(r"```ya?ml\s*\n(.*?BUSINESS_CASE_SUMMARY.*?)\n```", txt, re.S)
if not m:
    print("no BUSINESS_CASE_SUMMARY fenced block found"); sys.exit(1)
try:
    d = yaml.safe_load(m.group(1))
except Exception as e:
    print("block is UNPARSEABLE YAML:", e); sys.exit(1)
if not isinstance(d.get("arr_year1"), dict) or "base" not in d["arr_year1"]:
    print("block missing arr_year1.base"); sys.exit(1)
print("ok base =", d["arr_year1"]["base"])
PY
then
  pass "BUSINESS_CASE_SUMMARY: valid, parseable YAML block (dashboard-readable)"
else
  fail "BUSINESS_CASE_SUMMARY: block is missing or UNPARSEABLE — dashboard can't read it (fix the YAML)"
fi

# ── Business case STRENGTH: the honest median floor MUST be met (WEAK-CASE LOOP-BACK gate) ──
# Honesty isn't sufficient. A below-floor honest case must NOT reach 'ready' — it re-opens building the
# revenue levers. This mechanically blocks readiness while the median base ARR is under the floor.
if python3 - "$BC" <<'PY'
import sys, re, yaml
d = yaml.safe_load(re.search(r"```ya?ml\s*\n(.*?BUSINESS_CASE_SUMMARY.*?)\n```", open(sys.argv[1]).read(), re.S).group(1))
floor = d.get("floor_usd", 100000)
base = (d.get("arr_year1") or {}).get("base")
if base is None:
    print("no arr_year1.base"); sys.exit(1)
if not d.get("floor_met_year1") or base < floor:
    print(f"median base ARR {base} does NOT meet the {floor} floor (floor_met_year1={d.get('floor_met_year1')})"); sys.exit(1)
print(f"floor met: base {base} >= {floor}")
PY
then
  pass "Business case STRENGTH: honest median base ARR meets the \$100K floor"
else
  fail "Business case STRENGTH: median base ARR is BELOW the \$100K floor — readiness BLOCKED. Re-open building the revenue levers (WEAK-CASE LOOP-BACK: pricing/tiers, free→paid conversion, retention/referral, margin, reach); do NOT FYI-and-stop while buildable levers remain"
fi

# The GROWTH_STATUS block (Growth Agent's growth/marketing telemetry) MUST parse — same dashboard contract.
GS="$ROOT/docs/growth/GROWTH_STATUS.md"
if python3 - "$GS" <<'PY'
import sys, re, yaml, os
gs = sys.argv[1]
try:
    txt = open(gs).read()
except OSError:
    print("docs/growth/GROWTH_STATUS.md missing"); sys.exit(1)
m = re.search(r"```ya?ml\s*\n(.*?GROWTH_STATUS.*?)\n```", txt, re.S)
if not m:
    print("no GROWTH_STATUS fenced block found"); sys.exit(1)
try:
    d = yaml.safe_load(m.group(1)).get("GROWTH_STATUS") or {}
except Exception as e:
    print("block is UNPARSEABLE YAML:", e); sys.exit(1)
if d.get("phase") not in ("pre_launch", "launching", "post_launch"):
    print("phase must be pre_launch|launching|post_launch"); sys.exit(1)
if not isinstance(d.get("funnel"), dict):
    print("missing funnel"); sys.exit(1)

# ── ANTI-DRIFT: engine_built / engine_pct are PINNED to real code, never a vibe. ──
# Each growth-execution-engine piece maps to ONE anchor file; engine_pct is DERIVED from which
# files physically exist, and engine_built MUST equal (engine_pct == 100). This stops the loop from
# flipping engine_built true ahead of the code (lesson: a sister product flipped it ~6h early by
# conflating staged marketing content with the live execution engine — a hollow true misleads the
# dashboard + the Growth Agent into thinking they can move to execute mode).
ROOT = os.path.abspath(os.path.join(os.path.dirname(gs), "..", ".."))
ANCHORS = [
    ("waitlist double-opt-in confirm route", "apps/web/app/api/waitlist/confirm/route.ts"),
    ("email-send provider abstraction",      "packages/core/src/email/index.ts"),
    ("social publishing queue",              "packages/core/src/content/scheduler.ts"),
    ("growth-metrics read API",              "apps/web/app/api/growth/snapshot/route.ts"),
    ("owner connect runbook",                "docs/growth/CONNECT.md"),
]
present = [(n, p) for n, p in ANCHORS if os.path.isfile(os.path.join(ROOT, p))]
missing = [(n, p) for n, p in ANCHORS if not os.path.isfile(os.path.join(ROOT, p))]
computed_pct = round(len(present) / len(ANCHORS) * 100)

ep = d.get("engine_pct")
if isinstance(ep, bool) or not isinstance(ep, int):
    print("engine_pct missing or not an integer (0-100)"); sys.exit(1)
if ep != computed_pct:
    print(f"engine_pct={ep} but anchor files on disk imply {computed_pct} ({len(present)}/{len(ANCHORS)})")
    for n, p in missing:
        print(f"  MISSING anchor: {p}  ({n})")
    sys.exit(1)
eb = d.get("engine_built")
if not isinstance(eb, bool):
    print("engine_built must be a boolean"); sys.exit(1)
if eb != (computed_pct == 100):
    print(f"engine_built={eb} but engine_pct={computed_pct} — engine_built MUST equal (engine_pct == 100)")
    for n, p in missing:
        print(f"  MISSING anchor: {p}  ({n})")
    sys.exit(1)
print(f"ok phase={d['phase']} engine_pct={ep} ({len(present)}/{len(ANCHORS)} anchors) engine_built={eb}")
PY
then
  pass "GROWTH_STATUS: valid YAML; engine_pct matches anchor files on disk (anti-drift), engine_built pinned to code"
else
  fail "GROWTH_STATUS: block is missing or UNPARSEABLE — dashboard can't read growth progress (fix the YAML)"
fi

# The OWNER_ACTIONS block (dashboard-readable owner to-do list) MUST parse.
if python3 - "$ROOT/PENDING_OPS.md" <<'PY'
import sys, re, yaml
txt = open(sys.argv[1]).read()
m = re.search(r"```ya?ml\s*\n(.*?OWNER_ACTIONS.*?)\n```", txt, re.S)
if not m:
    print("no OWNER_ACTIONS fenced block found"); sys.exit(1)
try:
    d = yaml.safe_load(m.group(1)).get("OWNER_ACTIONS") or {}
except Exception as e:
    print("block is UNPARSEABLE YAML:", e); sys.exit(1)
if not isinstance(d.get("items"), list):
    print("OWNER_ACTIONS.items must be a list"); sys.exit(1)
for it in d["items"]:
    if it.get("status") not in ("open", "in_progress", "done"):
        print("bad status on", it.get("id")); sys.exit(1)
    if it.get("priority") not in ("urgent", "high", "normal"):
        print("bad priority on", it.get("id")); sys.exit(1)
print("ok", len(d["items"]), "owner actions")
PY
then
  pass "OWNER_ACTIONS: valid, parseable YAML block (dashboard-readable)"
else
  fail "OWNER_ACTIONS: block is missing or UNPARSEABLE — dashboard can't read owner action items (fix the YAML)"
fi

# ── 8. Track E: marketing routes in build ────────────────
section "8. Track E — marketing routes"
for route in "/blog" "/help" "/privacy" "/terms" "/sitemap.xml" "/invite" "/discover"; do
  if echo "$BUILD_LOG" | grep -qE "(ƒ|○|●) $route($| )"; then
    pass "route: $route (in build)"
  else
    # Fall back to source-file check
    case "$route" in
      /sitemap.xml) SRC="$ROOT/apps/web/app/sitemap.ts" ;;
      /blog)        SRC="$ROOT/apps/web/app/blog/page.tsx" ;;
      /help)        SRC="$ROOT/apps/web/app/help/page.tsx" ;;
      /privacy)     SRC="$ROOT/apps/web/app/privacy/page.tsx" ;;
      /terms)       SRC="$ROOT/apps/web/app/terms/page.tsx" ;;
      /invite)      SRC="$ROOT/apps/web/app/invite/page.tsx" ;;
      /discover)    SRC="$ROOT/apps/web/app/discover/page.tsx" ;;
      *)            SRC="" ;;
    esac
    if [ -n "$SRC" ] && [ -f "$SRC" ]; then
      pass "route: $route (source: ${SRC##$ROOT/})"
    else
      warn "route: $route — source not found"
    fi
  fi
done

# ── 9. Rendered store-asset images ───────────────────────
section "9. Store-asset images"
for f in \
  "apps/web/public/icons/icon-1024.png" \
  "apps/web/public/icons/icon-512.png" \
  "apps/web/public/icons/icon-192.png" \
  "apps/mobile/assets/icon.png" \
  "apps/mobile/assets/adaptive-icon.png" \
  "docs/store/assets/feature-graphic.png" \
; do
  if [ -f "$ROOT/$f" ] && [ -s "$ROOT/$f" ]; then
    SIZE=$(du -h "$ROOT/$f" | cut -f1)
    pass "store asset: $f ($SIZE)"
  else
    fail "store asset missing or empty: $f  ← run: PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node scripts/generate-store-assets.mjs"
  fi
done

# Device screenshots are Human Core — warn, not fail
warn "HUMAN CORE: App Store screenshots (5 × iPhone 15 Pro at 1320×2868 px) not committed — must be taken on real device (see docs/store/store-assets-spec.md)"
warn "HUMAN CORE: Google Play phone screenshots not committed — take after EAS build"

# ── Distribution/release config is REAL (not a placeholder) — BUILDS ≠ WORKS for the build/submit path ──
# A "build-ready" box must be backed by a buildable artifact: eas.json prod build+submit profiles, app config
# with bundle id + version/build + icon + permission strings, and projectId READ FROM ENV (no committed
# OWNER_* placeholder). Human-Core creds (Apple/Play submit, the real projectId value) stay in PENDING_OPS.
section "Distribution/release config (EAS build+submit REAL, not placeholder)"
MOBILE="$ROOT/apps/mobile"
if python3 - "$MOBILE" <<'PY'
import sys, os, json
m = sys.argv[1]
# eas.json: production build + submit profiles present
eas_p = os.path.join(m, "eas.json")
if not os.path.isfile(eas_p): print("apps/mobile/eas.json missing"); sys.exit(1)
try: eas = json.load(open(eas_p))
except Exception as e: print("eas.json invalid JSON:", e); sys.exit(1)
if "production" not in (eas.get("build") or {}): print("eas.json: no build.production profile"); sys.exit(1)
if "production" not in (eas.get("submit") or {}): print("eas.json: no submit.production profile"); sys.exit(1)
# app config: prefer app.config.ts (env-driven) over a static app.json with a hardcoded projectId placeholder
cfg_ts = os.path.exists(os.path.join(m, "app.config.ts")) or os.path.exists(os.path.join(m, "app.config.js"))
appjson_p = os.path.join(m, "app.json")
raw = open(appjson_p).read() if os.path.isfile(appjson_p) else ""
# the loop-owned config must NOT ship a hardcoded EAS projectId placeholder — it must come from env
if "OWNER_EAS_PROJECT_ID" in raw or "OWNER_EAS_PROJECT_ID" in (open(os.path.join(m,"app.config.ts")).read() if os.path.exists(os.path.join(m,"app.config.ts")) else ""):
    print("EAS projectId is a hardcoded OWNER_* placeholder — make it env-driven (app.config.ts reading process.env)"); sys.exit(1)
# loop-owned identity fields must be real (from app.json or app.config — check app.json when present)
if raw:
    try: exp = (json.loads(raw).get("expo") or {})
    except Exception as e: print("app.json invalid JSON:", e); sys.exit(1)
    ios, andr = exp.get("ios") or {}, exp.get("android") or {}
    missing = [k for k,v in {
        "version": exp.get("version"), "icon": exp.get("icon"),
        "ios.bundleIdentifier": ios.get("bundleIdentifier"), "ios.buildNumber": ios.get("buildNumber"),
        "android.package": andr.get("package"), "android.versionCode": andr.get("versionCode"),
    }.items() if not v]
    if missing: print("app.json missing loop-owned fields:", ", ".join(missing)); sys.exit(1)
elif not cfg_ts:
    print("no app.json or app.config.* found"); sys.exit(1)
print("ok: eas prod build+submit present; identity fields real; projectId env-driven")
PY
then
  pass "Distribution/release config: REAL (eas prod build+submit, identity fields backed, projectId env-driven)"
else
  fail "Distribution/release config NOT backed — un-tick any build-ready box (see ROADMAP 'Distribution/release config is REAL'); Human-Core creds stay in PENDING_OPS"
fi

# ── 10. PENDING_OPS: human steps documented ───────────────
section "10. PENDING_OPS — human steps documented"
if [ -f "$ROOT/PENDING_OPS.md" ] && [ -s "$ROOT/PENDING_OPS.md" ]; then
  STEPS=$(grep -c "^[0-9]\." "$ROOT/PENDING_OPS.md" 2>/dev/null || echo "?")
  pass "PENDING_OPS.md: $STEPS human-core steps documented"
else
  fail "PENDING_OPS.md: missing or empty"
fi

# ── Billing actually wired (subscription must be able to charge) ──
section "Billing — Stripe Checkout wired (not a stub)"
if grep -rq "checkout\.sessions\.create" "$ROOT/apps/web" "$ROOT/packages/core" 2>/dev/null; then
  pass "billing: Stripe Checkout session creation is wired"
else
  fail "billing: Stripe Checkout is a STUB — checkout.sessions.create not found; the app cannot charge anyone (Track C not done)"
fi

# ── Track G: pre-launch security & abuse hardening (critical mechanisms present) ──
section "Track G — security & abuse hardening (critical)"
WEB="$ROOT/apps/web"
# G1: rate limiting must exist somewhere (a limiter util / middleware / lib).
if grep -rqiE "ratelimit|rate-limit|rate_limit|@upstash/ratelimit|tooManyRequests|429" "$WEB" "$ROOT/packages" 2>/dev/null; then
  pass "G1: rate-limiting mechanism present"
else
  fail "G1: NO rate limiting found — paid-API/auth endpoints are a wallet-drain/abuse risk"
fi
# G5: bot protection on public forms (captcha / Turnstile / hCaptcha).
if grep -rqiE "turnstile|hcaptcha|recaptcha|captcha" "$WEB" 2>/dev/null; then
  pass "G5: captcha / bot-protection present"
else
  fail "G5: NO captcha/bot-protection on public forms (waitlist/signup) found"
fi
# G6: security headers + CORS (next.config headers() or middleware).
if grep -rqiE "Content-Security-Policy|Strict-Transport-Security|X-Content-Type-Options|headers\(\)|X-Frame-Options" "$WEB/next.config".* "$WEB/middleware".* 2>/dev/null; then
  pass "G6: security headers / CORS config present"
else
  fail "G6: NO security headers (CSP/HSTS/X-Content-Type-Options) / CORS lockdown found"
fi
# G7: per-user/day paid-API spend ceiling / circuit-breaker in code.
if grep -rqiE "spend.?(cap|ceiling|limit)|usage.?(cap|limit)|circuit.?breaker|dailyLimit|quota" "$WEB" "$ROOT/packages" 2>/dev/null; then
  pass "G7: API spend ceiling / circuit-breaker present"
else
  fail "G7: NO per-user/day API spend ceiling — a single abuser can run up the paid-API bill"
fi

# ── BUILDS ≠ WORKS: runtime functional journey suite (an ACTUAL RUN, not a code read) ──
section "Functional E2E — runtime journeys (BUILDS ≠ WORKS)"
JOURNEYS="$ROOT/apps/web/e2e/journeys.spec.ts"
INVENTORY="$ROOT/apps/web/e2e/ROUTE_INVENTORY.md"
# The suite must exist AND assert intended OUTCOMES (signup → working dashboard, never the error screen).
if [ -f "$JOURNEYS" ] && grep -qiE "not available|Couldn" "$JOURNEYS" && grep -qiE "signup|signUp|sign up" "$JOURNEYS"; then
  pass "functional suite present + outcome-asserting: apps/web/e2e/journeys.spec.ts"
else
  fail "functional suite MISSING/weak: apps/web/e2e/journeys.spec.ts must exercise the critical journeys at RUNTIME and assert intended OUTCOMES (signup → working dashboard, NOT the 'not available' error screen). BUILDS ≠ WORKS"
fi
if [ -f "$INVENTORY" ]; then
  pass "route/flow inventory present (provable coverage): apps/web/e2e/ROUTE_INVENTORY.md"
else
  fail "route/flow inventory MISSING: apps/web/e2e/ROUTE_INVENTORY.md — coverage must be provably complete"
fi
# It must have ACTUALLY RUN green this readiness attempt. The runner (CI / the factory) stands up a
# built app + a seeded DB, runs `pnpm --filter @gm/web e2e journeys`, and exports E2E_JOURNEYS_PASSED=1
# on success. A green build is not a working app — readiness REQUIRES the real run.
if [ "${E2E_JOURNEYS_PASSED:-}" = "1" ]; then
  pass "functional journeys RAN GREEN this attempt (E2E_JOURNEYS_PASSED=1)"
else
  fail "functional journeys NOT run this attempt — start a built app against a seeded DB, run \`pnpm --filter @gm/web e2e journeys\`, and export E2E_JOURNEYS_PASSED=1. Readiness requires an ACTUAL green run, not just a green build"
fi

# ── Definition-of-Done checkboxes all ticked (the source of truth) ──
section "Definition of Done — every box ticked"
DOD_SECTION="$(awk '/^## DEFINITION OF DONE/{f=1;next} /^## /{if(f)f=0} f' ROADMAP.md)"
DOD_UNCHECKED="$(printf '%s\n' "$DOD_SECTION" | grep -cE '^- \[ \]' || true)"
if [ "${DOD_UNCHECKED:-0}" -gt 0 ]; then
  fail "Definition of Done: $DOD_UNCHECKED box(es) UNCHECKED in ROADMAP.md — NOT ready; do not open the 'ready' issue"
  printf '%s\n' "$DOD_SECTION" | grep -E '^- \[ \]' | sed 's/^/        /'
else
  pass "Definition of Done: every box ticked"
fi

# ── Summary ───────────────────────────────────────────────
echo ""
echo "======================================================"
echo " SUMMARY"
echo "======================================================"
echo "  PASS: $PASS"
echo "  WARN: $WARN  (Human Core items — owner must complete)"
echo "  FAIL: $FAIL"
echo ""
if [ "$FAIL" -gt 0 ]; then
  echo "  ❌  PREFLIGHT FAILED — $FAIL factory gap(s) must be fixed before submission."
  exit 1
else
  echo "  ✅  PREFLIGHT PASSED — all factory-owned gates are green."
  echo "      Human Core items (warnings) require owner action — see docs/LAUNCH.md."
fi
