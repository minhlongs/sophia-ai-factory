# Phase 05 — Contract Tests for API Boundaries + Payment Pipeline

**Pillar:** C — Test Safety Net
**Status:** completed
**Priority:** P1
**Wave:** 1 (parallel with 01, 03)

## Context Links
- Parent: `plans/260630-1626-zero-bug-three-pillars/plan.md`
- Test docs: `docs/testing.md`
- Existing test pattern: vitest + describe/it

## Overview

Contract tests verify API boundaries respect schemas và behavior contracts. Payment pipeline là critical path số 1 — cần contract test trước khi refactor.

## Contract Test Targets

### 1. IPN Payload Schema (NOWPayments)
- File: `src/land/billing/ipn-payload-schema.ts` (37 lines)
- Test: validate valid/invalid payloads, edge cases, missing fields
- Location: `src/land/billing/__tests__/ipn-payload-schema.contract.test.ts`

### 2. IPN Webhook Handler
- File: `src/app/api/webhooks/nowpayments/route.ts`
- Test: HTTP 200/400/401 responses, signature validation, idempotency
- Location: `src/app/api/webhooks/nowpayments/__tests__/route.contract.test.ts`

### 3. Tier Activation Flow
- Files: `src/land/billing/nowpayments-ipn-subscription.ts`
- Test: payment → tier activation, TOCTOU race condition, duplicate IPN
- Location: `src/land/billing/__tests__/tier-activation.contract.test.ts`

### 4. Dead Letter Queue
- File: `src/land/billing/nowpayments-ipn-dead-letter.ts` (241 lines)
- Test: DLQ overflow behavior, retry logic, max attempts
- Location: `src/land/billing/__tests__/dead-letter-queue.contract.test.ts`

### 5. Affiliate Commission Calculation
- File: `src/land/affiliates/` and `src/land/payouts/`
- Test: commission tiers, minimum payout threshold, multi-tier
- Location: `src/land/payouts/__tests__/commission-calculation.contract.test.ts`

## Test Pattern

Following existing project convention:
```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('IPN Payload Schema', () => {
  it('validates correct payment payload', () => {
    const payload = { /* valid NOWPayments IPN */ };
    const result = ipnPayloadSchema.safeParse(payload);
    expect(result.success).toBe(true);
  });

  it('rejects payload with missing payment_id', () => {
    const payload = { /* missing payment_id */ };
    const result = ipnPayloadSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it('rejects payload with negative amount', () => {
    // edge case
  });
});
```

## Implementation Steps

1. Read existing test patterns in `src/land/billing/__tests__/` (20 existing tests)
2. Write IPN schema contract tests (fastest, pure Zod)
3. Write webhook route contract tests (mock D1)
4. Write tier activation contract tests (TOCTOU + idempotency)
5. Write DLQ contract tests (overflow + retry)
6. Write commission calculation contract tests
7. Run `npm test` — all contract tests must pass

## Success Criteria
- [x] 5 contract test files created
- [x] IPN schema: valid/invalid/edge cases covered
- [x] Webhook route: auth + signature + idempotency
- [x] Tier activation: TOCTOU race condition + duplicate prevention
- [x] DLQ: overflow behavior defined + tested
- [x] `npm test` → all pass
- [x] `npm run type-check` → 0 errors
