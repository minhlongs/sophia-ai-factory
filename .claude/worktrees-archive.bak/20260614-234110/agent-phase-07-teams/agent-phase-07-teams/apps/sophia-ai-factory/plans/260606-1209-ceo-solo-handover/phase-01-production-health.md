---
title: "Phase 1: Production Health Verify"
description: "Verify production is 100/100 — SHA match, HTTP 200, checkout flow"
status: pending
priority: P1
effort: 2h
branch: master
tags: [verification, production, deploy]
created: 2026-06-06
---

# Phase 1: Production Health Verify

**Priority:** P1 — blocks all other phases
**Status:** pending
**Effort:** 2h

## Context Links
- Deploy verify rules: `.claude/rules/sophia-deploy-verify.md`
- Production URL: https://sophia.agencyos.network
- Version endpoint: `/api/version`
- Health endpoint: `/api/health`

## Requirements
1. SHA match: local HEAD shortSha == production `/api/version` shortSha
2. HTTP 200 on root and key pages
3. Checkout flow end-to-end (NOWPayments default path)
4. All 5775+ tests pass

## Implementation Steps

### Step 1: SHA Verify (10 min)
```bash
LOCAL_SHA=$(git rev-parse HEAD | cut -c1-8)
LIVE_SHA=$(curl -s https://sophia.agencyos.network/api/version | grep -o '"shortSha":"[^"]*"' | cut -d'"' -f4)
echo "Local: $LOCAL_SHA Live: $LIVE_SHA"
```
**Acceptance:** `$LOCAL_SHA == $LIVE_SHA`

### Step 2: HTTP Health Check (5 min)
```bash
curl -sI https://sophia.agencyos.network | head -3
curl -s https://sophia.agencyos.network/api/health
```
**Acceptance:** HTTP 200 on both

### Step 3: Test Suite (15 min)
```bash
cd apps/sophia-ai-factory && npm test
```
**Acceptance:** All 5775+ tests pass, 0 failures

### Step 4: Checkout Flow Test (30 min)
1. Open https://sophia.agencyos.network in browser
2. Navigate to pricing/checkout page
3. Select MASTER tier ($4,999)
4. Verify NOWPayments redirect happens
5. Complete test payment (sandbox if available)
**Acceptance:** NOWPayments invoice created, redirect succeeds

### Step 5: Code Review Fixes (60 min)
- Run existing code review report from `plans/260521-2342-go-live-100-audit/`
- Apply all remaining fixes
- Re-run tests after each fix batch

## Success Criteria
- [ ] SHA match confirmed
- [ ] HTTP 200 on production
- [ ] All tests pass (5775+)
- [ ] Checkout flow verified end-to-end
- [ ] No `:any` types in production code
- [ ] No `console.log` in production code

## Risk Assessment
| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| SHA mismatch (stale deploy) | Medium | High | Re-run `npm run deploy:full` |
| Checkout flow broken | Low | High | Verify NOWPayments IPN webhook config |
| Test failures from prior changes | Medium | Medium | Fix iteratively, one batch at a time |

## Rollback
```bash
cd apps/sophia-ai-factory
npx wrangler rollback --name sophia-ai-factory --message "Phase 1 rollback" --yes
```
