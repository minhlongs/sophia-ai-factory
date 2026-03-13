# SOPHIA Integration Test Plan

**Date:** 2026-03-12 | **Priority:** P0 | **Status:** In Progress

## Overview

End-to-end integration testing for SOPHIA webhook → license → metering pipeline.

## Test Pipeline Flow

```
Polar Webhook → License Service → Usage Metering → Overage Alert
     ↓              ↓                    ↓              ↓
  webhook       create/            track usage    trigger alert
  handler    update license
```

## Test Scenarios

### Scenario 1: New Subscription Flow
1. `subscription.created` → License created
2. `subscription.active` → License activated
3. Usage tracked → Metering updated
4. Over limit → Overage alert triggered

### Scenario 2: Cancellation Flow
1. `subscription.cancelled` → License revoked
2. Usage tracking blocked
3. Access denied on revoked license

### Scenario 3: Uncancellation Flow
1. `subscription.uncancelled` → License reactivated
2. Usage tracking resumes

## Implementation Phases

### Phase 1: Webhook Integration Tests (Parallel)
**Files:** Create `app/lib/polar-webhook-handler.test.ts`
**Tests:** All 4 event types + error cases

### Phase 2: License Service Tests (Parallel)
**Files:** Update `app/lib/license-service.test.ts`
**Tests:** CRUD + subscription sync + usage integration

### Phase 3: Usage Metering Tests (Parallel)
**Files:** Update `app/lib/usage-metering.test.ts`
**Tests:** Track usage + limits + overage detection

### Phase 4: Overage Alert Tests (Parallel)
**Files:** Create `app/lib/overage-alert-engine.test.ts`
**Tests:** Alert triggers + thresholds

### Phase 5: Run vitest + Git Push (Sequential)
**Files:** Run full test suite, git push, verify CI/CD

## File Ownership Matrix

| Phase | Files | Owner |
|-------|-------|-------|
| 1 | `polar-webhook-handler.test.ts` (NEW) | Test Agent A |
| 2 | `license-service.test.ts` (UPDATE) | Test Agent B |
| 3 | `usage-metering.test.ts` (UPDATE) | Test Agent C |
| 4 | `overage-alert-engine.test.ts` (NEW) | Test Agent D |
| 5 | All tests + git | Release Agent |

## Dependency Graph

```
Phase 1 (Webhook) ──┐
Phase 2 (License) ──┼──→ Phase 5 (Test + Push)
Phase 3 (Metering) ─┤
Phase 4 (Overage) ──┘
```

**Parallel:** Phases 1-4 can run simultaneously
**Sequential:** Phase 5 after all tests complete

## Success Criteria

- [ ] All webhook events tested
- [ ] License CRUD + subscription sync tested
- [ ] Usage metering + limits tested
- [ ] Overage alerts tested
- [ ] 100% test pass rate
- [ ] No test failures
- [ ] CI/CD GREEN
- [ ] Production verified
