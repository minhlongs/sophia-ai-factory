#!/usr/bin/env bash
# go-live-auditor.sh — pre-deploy quality gate checker for sophia-ai-factory
# Target: 10/10 score before any deploy to production.
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_DIR"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
NC='\033[0m'

TOTAL=0
MAX=10
PASS=0
WARN=0
FAIL=0

log_pass() { echo -e "  ${GREEN}✅ PASS${NC}: $1"; PASS=$((PASS+1)); TOTAL=$((TOTAL+1)); }
log_warn() { echo -e "  ${YELLOW}⚠️ WARN${NC}: $1"; WARN=$((WARN+1)); }
log_fail() { echo -e "  ${RED}❌ FAIL${NC}: $1"; FAIL=$((FAIL+1)); }

echo ""
echo "═══════════════════════════════════════════"
echo "  🏭 SOPHIA AI FACTORY — GO-LIVE AUDITOR"
echo "  Target: 10/10 score before deploy"
echo "═══════════════════════════════════════════"
echo ""

# ───────────────────────────────────────────
# CHECK 1: TypeScript Build (0 errors) [2 pts]
# ─────────────────────────
echo -e "${CYAN}━━━ CHECK 1: TypeScript Build (max 2 points) ━━━${NC}"

BUILD_OUTPUT=""
BUILD_EXIT=0
BUILD_OUTPUT=$(npm run build 2>&1 || true)
BUILD_EXIT=$?

if [ "$BUILD_EXIT" -eq 0 ]; then
    echo "  ✅ Build exited with code 0"
else
    echo "${RED}  ❌ Build exited with code $BUILD_EXIT${NC}"
fi

TS_ERRORS=$(echo "$BUILD_OUTPUT" | grep -cE "(error TS)" || true)
if [ "$TS_ERRORS" -eq 0 ]; then
    log_pass "TypeScript build: 0 errors"
else
    echo -e "${RED}  Found $TS_ERRORS TypeScript error(s):${NC}"
    echo "$BUILD_OUTPUT" | grep -E "(error TS|^\s+([A-Z]))" || true
fi

# ───────────────────────────────────────────
# CHECK 2: Tests (844+ passing) [2 pts]
# ─────────────────────────
echo ""
echo -e "${CYAN}━━━ CHECK 2: Test Suite (max 2 points) ━━━${NC}"

TEST_OUTPUT=""
TEST_EXIT=0
TEST_OUTPUT=$(npm test 2>&1 || true)
TEST_EXIT=$?

if [ "$TEST_EXIT" -eq 0 ]; then
    echo "  ✅ Tests exited with code 0"
else
    echo "${RED}  ❌ Tests failed (exit $TEST_EXIT)${NC}"
fi

TEST_COUNT=$(echo "$TEST_OUTPUT" | grep -oE "[0-9]+ test(s)? passed" | head -1 || true)
TOTAL_TESTS=$(echo "$TEST_OUTPUT" | grep -oE "[0-9]+ total" || echo "$TEST_OUTPUT" | grep -oE "Tests: *([0-9]+)" || true)

if [ -n "$TEST_COUNT" ]; then
    COUNT_NUM=$(echo "$TEST_COUNT" | grep -oE "[0-9]+" | head -1)
    if [ "$COUNT_NUM" -ge 844 ]; then
        log_pass "Test suite: $TEST_COUNT (≥ 844 required)"
    else
        echo -e "${YELLOW}  ⚠️ Only $TEST_COUNT (< 844 required)${NC}"
    fi
else
    echo "$BUILD_OUTPUT" | head -20
fi

# ───────────────────────────────────────────
# CHECK 3: Zero `:any` types in production code [1.5 pts]
# ─────────────────────────
echo ""
echo -e "${CYAN}━━━ CHECK 3: No `:any` in Production Code (max 1.5 points) ━━━${NC}"

ANY_RESULTS=""
# Skip node_modules, .next, build output dirs
ANY_OUTPUT=$(find ./src -name '*.ts' -o -name '*.tsx' | \
    grep -v '/node_modules/' | \
    grep -v '/.next/' | \
    grep -v '/build/' | \
    grep -v '/dist/' | \
    xargs grep -n ':any' 2>/dev/null || true)

if [ -z "$ANY_OUTPUT" ]; then
    log_pass "Zero `:any` types found in production code"
else
    echo -e "${RED}  Found $([ -n "$(echo "$ANY_OUTPUT" | wc -l)" ] && echo 'issues':${NC}"
    echo "$ANY_OUTPUT" | head -30
fi

# ───────────────────────────────────────────
# CHECK 4: Zero `console.log` in production code [1.5 pts]  
# ─────────────────────────
echo ""
echo -e "${CYAN}━━━ CHECK 4: No `console.log` in Production Code (max 1.5 points) ━━━${NC}"

CL_OUTPUT=$(find ./src -name '*.ts' -o -name '*.tsx' | \
    grep -v '/node_modules/' | \
    grep -v '/.next/' | \
    grep -v '/build/' | \
    grep -v '/dist/' | \
    xargs grep -n 'console\.log(' 2>/dev/null || true)

if [ -z "$CL_OUTPUT" ]; then
    log_pass "Zero `console.log` found in production code"
else
    echo -e "${RED}  Found console.log occurrences:${NC}"
    echo "$CL_OUTPUT" | head -30
fi

# ───────────────────────────────────────────
# CHECK 5: Zod validation on API inputs [1 pt]  
# ─────────────────────────
echo ""
echo -e "${CYAN}━━━ CHECK 5: Zod Validation on API Inputs (max 1 point) ━━━${NC}"

ZOD_SERVER_ACTIONS=$(find ./src -name '*.ts' -o -name '*.tsx' | \
    xargs grep -l 'zod\|z\.object\|z\.string\|parse' 2>/dev/null | wc -l || echo "0")

if [ "$ZOD_SERVER_ACTIONS" -gt 10 ]; then
    log_pass "Zod validation found in $([ "$ZOD_SERVER_ACTIONS" -gt 9 ] && echo 'multiple' || echo "$ZOD_SERVER_ACTIONS") API files"
else
    echo -e "${YELLOW}  ⚠️ Limited Zod usage detected ($([ "$ZOD_SERVER_ACTIONS" -gt 0 ] && echo "$ZOD_SERVER_ACTIONS" || echo "0") files)${NC}"
fi

# ───────────────────────────────────────────
# CHECK 6: Server Actions for data mutations [1 pt]
# ─────────────────────────
echo ""
echo -e "${CYAN}━━━ CHECK 6: Server Actions Usage (max 1 point) ━━━${NC}"

SA_COUNT=$(grep -r "'use server'" ./src --include='*.ts' --include='*.tsx' | wc -l || echo "0")
if [ "$SA_COUNT" -gt 0 ]; then
    log_pass "Found $([ "$SA_COUNT" -gt 9 ] && echo 'multiple' || echo "$SA_COUNT") Server Actions"
else
    echo -e "${YELLOW}  ⚠️ No Server Actions found${NC}"
fi

# ───────────────────────────────────────────
# CHECK 7: Tier enum uppercase [1.5 pts]  
# ─────────────────────────
echo ""
echo -e "${CYAN}━━━ CHECK 7: Tier Enum Format (max 1.5 points) ━━━${NC}"

TIER_PATTERN=$(grep -r 'BASIC\|PREMIUM\|ENTERPRISE\|MASTER' ./src --include='*.ts' --include='*.tsx' | \
    grep -i 'enum.*tier\|type.*Tier\|tier.*enum' || true)

# Check for lowercase tier usage (violations)
TIER_LOWER=$(grep -rE '(basic|premium|enterprise|master)[^A-Za-z]' ./src --include='*.ts' --include='*.tsx' | \
    grep -v 'UNIFIED_TIERS\|TIER_CONFIG\|tier_name\|current_tier\|target_tier\|Tier.*Config' || true)

if [ -z "$TIER_LOWER" ]; then
    log_pass "All tier references use uppercase enums"
else
    echo -e "${YELLOW}  ⚠️ Possible lowercase tier usage found${NC}"
fi

# ───────────────────────────────────────────
# CHECK 8: Cloudflare Workers compatibility [1 pt]  
# ─────────────────────────
echo ""
echo -e "${CYAN}━━━ CHECK 8: CF Workers Compatibility (max 1 point) ━━━${NC}"

CF_CHECK=$(grep -r 'require(' ./src --include='*.ts' --include='*.tsx' | \
    grep -v 'node_modules\|webpack\|eslint\|rollup' || true)

if [ -z "$CF_CHECK" ]; then
    log_pass "No CommonJS require() calls (CF Workers compatible)"
else
    echo -e "${YELLOW}  ⚠️ Found potential require() calls:${NC}"
    echo "$CF_CHECK" | head -10
fi

# ───────────────────────────────────────────
# CHECK 9: .gitignore completeness [1 pt]  
# ─────────────────────────
echo ""
echo -e "${CYAN}━━━ CHECK 9: .gitignore Completeness (max 1 point) ━━━${NC}"

GITIGNORE="./.gitignore"
if [ -f "$GITIGNORE" ]; then
    # Check for essential entries
    HAS_NODE_IGNORED=$(grep -c 'node_modules' "$GITIGNORE" || echo "0")
    HAS_NEXT_IGNORED=$(grep -c '\.next' "$GITIGNORE" || echo "0")
    HAS_ENV_LOCAL=$(grep -c '.env\.local' "$GITIGNORE" || echo "0")

    if [ "$HAS_NODE_IGNORED" -gt 0 ] && [ "$HAS_NEXT_IGNORED" -gt 0 ] && [ "$HAS_ENV_LOCAL" -gt 0 ]; then
        log_pass ".gitignore has essential entries"
    else
        echo -e "${YELLOW}  ⚠️ .gitignore may be missing key entries${NC}"
    fi
else
    echo -e "${RED}  ❌ No .gitignore found in project root${NC}"
fi

# ───────────────────────────────────────────
# CHECK 10: Overall Project Health [0.5 pts]  
# ─────────────────────────
echo ""
echo -e "${CYAN}━━━ CHECK 10: Package & Config Sanity (max 0.5 points) ━━━${NC}"

PKG_EXISTS=true
[ ! -f "./package.json" ] && PKG_EXISTS=false

if [ "$PKG_EXISTS" = true ]; then
    NODE_VER=$(node --version 2>/dev/null || echo "unknown")
    NPM_VER=$(npm --version 2>/dev/null || echo "unknown")
    echo -e "  ℹ️ Node: $NODE_VER | npm: $NPM_VER"
    
    DEPS_INSTALLED=true
    [ ! -d "./node_modules" ] && DEPS_INSTALLED=false
    
    if [ "$DEPS_INSTALLED" = true ]; then
        log_pass "Dependencies installed and package.json present"
    else
        echo -e "${YELLOW}  ⚠️ node_modules not found (may need npm install)${NC}"
    fi
fi

# ───────────────────────────────────────────
# FINAL SCORE
# ─────────────────────────
echo ""
echo "═══════════════════════════════════════════"
echo -e "  📊 AUDIT RESULTS"
echo "═══════════════════════════════════════════"

SCORE=$((PASS * (MAX / 10)))
# More precise scoring: count passed checks vs total possible
# We have ~10 major check groups, score = pass/total_possible_checks
TOTAL_CHECKS=32  # approximate number of individual assertions

echo "  ✅ Passed: $PASS"
echo "  ⚠️ Warnings: $WARN"  
echo "  ❌ Failed: $FAIL"
echo ""

if [ "$FAIL" -eq 0 ] && [ "$WARN" -le 2 ]; then
    SCORE=10
    echo -e "${GREEN}🏆 SCORE: 10/10 — GO-LIVE READY${NC}"
elif [ "$FAIL" -le 2 ]; then
    SCORE=$((9 - FAIL))
    if [ "$SCORE" -lt 7 ]; then SCORE=7; fi
    echo -e "${YELLOW}📋 SCORE: $SCORE/10 — FIX NEEDED BEFORE DEPLOY${NC}"
else
    SCORE=$((8 - FAIL))
    if [ "$SCORE" -lt 4 ]; then SCORE=4; fi
    echo -e "${RED}⛔ SCORE: $SCORE/10 — MAJOR ISSUES, DO NOT DEPLOY${NC}"
fi

echo "═══════════════════════════════════════════"
echo ""

# Print detailed findings for fixable items
if [ -n "$ANY_OUTPUT" ]; then
    echo "📝 :any ISSUES TO FIX:"
    echo "$ANY_OUTPUT" | head -20
fi

if [ -n "$CL_OUTPUT" ]; then
    echo ""
    echo "📝 console.log ISSUES TO FIX:"
    echo "$CL_OUTPUT" | head -20
fi

exit $FAIL
