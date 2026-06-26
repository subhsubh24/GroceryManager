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
