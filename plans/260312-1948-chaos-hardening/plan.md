# SOPHIA Chaos Test & Hardening Plan

**Date:** 2026-03-12 | **Priority:** P0 | **Status:** In Progress

## Overview

Chaos testing and edge case hardening for SOPHIA webhook → license → metering pipeline.

## Test Scenarios

### Chaos Test Cases

#### 1. Webhook Handler - Invalid Inputs
- Malformed JSON payload
- Missing signature header
- Invalid signature format
- Missing event type header
- Unknown event types
- Empty payload
- Null customer_id
- Extremely long strings (>10KB)

#### 2. License Service - Edge Cases
- Create license with empty customerId
- Create license with invalid tier
- Update subscription with missing ID
- Revoke non-existent license
- Duplicate customer IDs
- Concurrent modifications

#### 3. Usage Metering - Boundary Tests
- Record negative usage
- Record zero usage
- Record MAX_SAFE_INTEGER usage
- Rapid-fire recording (1000 calls/sec)
- Usage for non-existent license

#### 4. Overage Alert - Edge Cases
- Alert at exactly 80%, 90%, 100%
- Multiple alerts same threshold
- Alert for revoked license
- Alert history overflow

### Error Handling Paths

1. **PolarConfig missing** → Return error, don't crash
2. **Invalid JSON** → 400 Bad Request
3. **Invalid signature** → 401 Unauthorized
4. **License not found** → Graceful handling
5. **Service unavailable** → Retry logic

## Implementation Phases

### Phase 1: Webhook Chaos Tests (Parallel)
**Files:** Update `app/lib/polar-webhook-handler.test.ts`
**Tests:** Invalid inputs, malformed payloads, missing headers

### Phase 2: License Service Hardening (Parallel)
**Files:** Update `app/lib/license-service.test.ts`
**Tests:** Edge cases, validation errors, concurrent access

### Phase 3: Usage Metering Chaos (Parallel)
**Files:** Update `app/lib/usage-metering.test.ts`
**Tests:** Boundary values, negative inputs, overflow

### Phase 4: Overage Alert Tests (Parallel)
**Files:** Update `app/lib/overage-alert-engine.test.ts`
**Tests:** Threshold edge cases, alert storms

### Phase 5: Fix Bugs Found (Sequential)
**Action:** Fix any bugs discovered during testing
**Files:** Various based on findings

### Phase 6: Run vitest + Git Push (Sequential)
**Action:** Run full test suite, git push, verify CI/CD

## Dependency Graph

```
Phase 1 (Webhook) ──┐
Phase 2 (License) ──┼──→ Phase 5 (Fix Bugs) ──→ Phase 6 (Test+Push)
Phase 3 (Metering) ─┤
Phase 4 (Overage) ──┘
```

## File Ownership Matrix

| Phase | Files | Owner |
|-------|-------|-------|
| 1 | `polar-webhook-handler.test.ts` | Test Agent A |
| 2 | `license-service.test.ts` | Test Agent B |
| 3 | `usage-metering.test.ts` | Test Agent C |
| 4 | `overage-alert-engine.test.ts` | Test Agent D |
| 5 | Various bug fixes | Fix Agent |
| 6 | All tests + git | Release Agent |

## Success Criteria

- [ ] All chaos tests written and passing
- [ ] Edge cases handled gracefully
- [ ] No crashes on invalid inputs
- [ ] Error messages are descriptive
- [ ] 100% test pass rate
- [ ] CI/CD GREEN
- [ ] Production verified
