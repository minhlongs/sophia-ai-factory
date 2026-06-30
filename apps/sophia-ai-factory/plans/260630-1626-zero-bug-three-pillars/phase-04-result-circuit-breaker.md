# Phase 04 — Result<T,E> Pattern + Circuit Breaker Adoption

**Pillar:** B — Error Handling Contract
**Status:** pending
**Priority:** P1
**Wave:** 2 (depends on Phase 03)

## Context Links
- Parent: `plans/260630-1626-zero-bug-three-pillars/plan.md`
- Phase 03: `phase-03-replace-silent-catch.md`
- Existing circuit breaker: `src/seed/utils/circuit-breaker.ts`

## Overview

Sau khi mọi .catch() đã log, chuẩn hóa error handling pattern cao hơn:
1. `Result<T, E>` type cho function return — explicit success/failure
2. Circuit breaker adoption cho external API calls
3. Retry policy chuẩn cho transient errors

## 1. Result<T, E> Type

Tạo `src/seed/types/result.ts`:
```typescript
export type Result<T, E = Error> = 
  | { ok: true; value: T }
  | { ok: false; error: E };

export function success<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function failure<E>(error: E): Result<never, E> {
  return { ok: false, error };
}
```

Adopt pattern in payment pipeline functions first:
```typescript
// Before
async function processIPN(payload: IPNPayload): Promise<void> {
  // throws or silent-catches
}

// After  
async function processIPN(payload: IPNPayload): Promise<Result<void, IPNError>> {
  try {
    // process
    return success(undefined);
  } catch (err) {
    logger.error('IPN processing failed', { error: String(err) });
    return failure(new IPNError('PROCESSING_FAILED', err));
  }
}
```

## 2. Circuit Breaker Expansion

Circuit breaker hiện có (`src/seed/utils/circuit-breaker.ts`) imports slack alert từ land — cần fix trước (Phase 01).

Sau khi fix, áp dụng cho:
- `src/land/billing/nowpayments-ipn-subscription.ts` — NOWPayments API calls
- `src/land/video/publishing/providers/*.ts` — social media API calls
- `src/tree/clients/nowpayments-client.ts` — client HTTP calls
- `src/land/hunter/hunter-client.ts` — email verification API

Pattern:
```typescript
const cb = createCircuitBreaker('nowpayments-api', {
  failureThreshold: 5,
  cooldownMs: 30_000,
  onOpen: () => logger.error('NOWPayments circuit OPEN'),
});

const result = await cb.call(() => nowpaymentsApi.getPaymentStatus(paymentId));
```

## 3. Retry Policy

Thêm `src/seed/utils/retry.ts`:
```typescript
export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: { maxRetries?: number; backoffMs?: number } = {}
): Promise<T> {
  const { maxRetries = 3, backoffMs = 1000 } = opts;
  for (let i = 0; i <= maxRetries; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === maxRetries) throw err;
      logger.warn(`Retry ${i + 1}/${maxRetries}`, { error: String(err) });
      await new Promise(r => setTimeout(r, backoffMs * Math.pow(2, i)));
    }
  }
  throw new Error('unreachable');
}
```

## Implementation Steps

1. Create `src/seed/types/result.ts` (Result<T,E> type + helpers)
2. Create `src/seed/utils/retry.ts` (withRetry)
3. Fix circuit breaker import violation (move to seed, use callback injection)
4. Apply Result<T,E> to payment pipeline (4 files)
5. Apply circuit breaker to external API calls (6+ files)
6. Apply withRetry to transient-prone calls
7. Run `npm test` + `npm run build`

## Success Criteria
- [x] `src/seed/types/result.ts` created with Result<T,E>
- [x] `src/seed/utils/retry.ts` created with withRetry()
- [x] Circuit breaker no longer imports from land (uses callback injection)
- [x] Payment pipeline functions return Result<T,E>
- [ ] External API calls use circuit breaker (carried to future phase)
- [x] `npm run type-check` → 0 errors
- [x] `npm test` → all pass (6525 passed)
