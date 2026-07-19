# Analysis: Case 4.1 Redis Non-Atomic Read-Modify-Write in Real-Time Tracker

## Executive Summary
This report analyzes the non-atomic read-modify-write pattern inside `apps/sophia-ai-factory/src/forest/usage-metering/realtime-tracker.ts` and proposes a complete migration strategy. We demonstrate how concurrent requests cause race conditions that result in untracked API credit usage. Two atomic replacement designs are provided: a **Redis Hash-based approach** (recommended) and a **Redis String-key-based approach**.

---

## 1. Problem Investigation & Call Chain

### File Under Investigation
- `apps/sophia-ai-factory/src/forest/usage-metering/realtime-tracker.ts` (lines 40-48)

### Current Implementation (Vulnerable Code)
```typescript
// From realtime-tracker.ts
let current = await getRealTimeUsage(userId, licenseNonce)
const now = Date.now()
const windowStart = Math.floor(now / windowMs) * windowMs
if (!current || current.windowStart !== windowStart) {
  current = { licenseNonce, userId, tier, currentCredits: creditsUsed, windowStart, windowMs }
} else {
  current.currentCredits += creditsUsed
}
await updateRealTimeUsage(current)
```

And the KV operations in `realtime-tracker-kv-ops.ts` are defined as:
```typescript
export async function getRealTimeUsage(userId: string, licenseNonce: string): Promise<RealTimeUsage | null> {
  const kv = getKvClient()
  if (!kv) return null
  try {
    const cached = await kv.get(`usage:${userId}:${licenseNonce}`)
    return cached ? (cached as RealTimeUsage) : null
  } catch (error) { ... }
}

export async function updateRealTimeUsage(usage: RealTimeUsage, ttlSeconds: number = 3600): Promise<void> {
  const kv = getKvClient()
  if (!kv) return
  try {
    await kv.set(`usage:${usage.userId}:${usage.licenseNonce}`, usage, { ex: ttlSeconds })
  } catch (error) { ... }
}
```

### Explored Paths & Verification
- Checked if `getRealTimeUsage` and `updateRealTimeUsage` are called outside `realtime-tracker.ts`. Ripgrep searches confirmed they are **only** used internally in `realtime-tracker.ts` (defining and updating the local variable `current`).
- The cache invalidation function `invalidateRealTimeCache` is called in `apps/sophia-ai-factory/src/forest/usage-metering/tracker-db-helpers.ts` (line 137) after a usage event is successfully written to D1.

---

## 2. Race Condition Analysis (Read-Modify-Write)

Because the fetch (`getRealTimeUsage`), local calculation, and save (`updateRealTimeUsage`) are split into distinct, non-atomic asynchronous operations, concurrent requests for the same user/license within the same window will experience a race condition:

```
Request A (Thread 1)                          Request B (Thread 2)
  |                                             |
  |--- 1. getRealTimeUsage() ------------------>| (Returns currentCredits: 10)
  |                                             |--- 1. getRealTimeUsage() -------------> (Returns currentCredits: 10)
  |--- 2. Add credits (10 + 5 = 15)             |
  |                                             |--- 2. Add credits (10 + 5 = 15)
  |--- 3. updateRealTimeUsage(15) ------------>| (Redis key updated to 15)
  |                                             |--- 3. updateRealTimeUsage(15) --------> (Redis key overwritten to 15)
  v                                             v
```

* **Outcome**: The final value stored in Redis is `15`. The correct value should be `20` (10 + 5 + 5). 5 credits are completely lost from the real-time tracker, leading to quota leakage.

---

## 3. Unit Test Coverage Findings

We searched for unit tests covering `realtime-tracker.ts` or its sub-modules under `apps/sophia-ai-factory/src/forest/usage-metering/`.
* **Findings**: There are **no unit test files** covering `realtime-tracker.ts`, `realtime-tracker-kv-ops.ts`, or `realtime-tracker-circuit-breaker.ts` directly.
* Existing unit test files in `usage-metering` are:
  - `usage-metering-integration.test.ts` (tests `idempotency.ts` and `tracker.ts`)
  - `usage-kv-sync-batching.test.ts` (tests `usage-kv-sync.ts` batching)
  - `aggregator.test.ts` (tests `aggregator.ts`)

---

## 4. Proposed Fixes

We present two alternative solutions. **Approach A (Redis Hash)** is the recommended path due to its performance characteristics and ease of cache invalidation.

### Approach A: Redis Hash with `HINCRBY` (Recommended)

In this approach, the Redis key remains `usage:${userId}:${licenseNonce}` but transitions from holding a JSON object to holding a Redis Hash. The Hash fields are stringified window start timestamps (e.g., `"1717160000000"`), and their values are numeric credit counters.

#### Pros:
1. **O(1) Invalidation**: Cache invalidation (`invalidateRealTimeCache`) remains a simple `del(key)` command, which is `O(1)` and does not require expensive `keys` or `scan` operations.
2. **Atomicity**: Increments are atomic via `HINCRBY`.
3. **No Key Proliferation**: Only one Redis key is allocated per user/license.

#### Cons:
- Fields for older windows inside the Hash do not expire individually; the entire Hash expires according to the TTL set on the key. Since sub-second/1-second windows are tiny, the number of fields generated within a 1-hour TTL is negligible.

#### Concrete Code Changes:

**1. Update `apps/sophia-ai-factory/src/forest/usage-metering/realtime-tracker-kv-ops.ts`**
```typescript
import { logger } from '@/seed/utils/logger-utility'
import { toError } from '@/seed/utils/to-error'
import { getKvClient } from '@/lib/redis'

/**
 * Atomically increment the credit counter for the specified window start.
 * Uses HINCRBY and resets the overall Hash key TTL.
 */
export async function incrementRealTimeUsage(
  userId: string,
  licenseNonce: string,
  windowStart: number,
  creditsUsed: number,
  ttlSeconds: number = 3600
): Promise<number> {
  const kv = getKvClient()
  if (!kv) {
    throw new Error('Redis client not available')
  }
  const key = `usage:${userId}:${licenseNonce}`
  const field = String(windowStart)

  const p = kv.pipeline()
  p.hincrby(key, field, creditsUsed)
  p.expire(key, ttlSeconds)
  const results = await p.exec()
  
  if (!results || results.length === 0) {
    throw new Error('Pipeline execution failed')
  }
  
  return Number(results[0])
}

/**
 * Keep original signature but update to read from the Hash current window.
 */
export async function getRealTimeUsage(userId: string, licenseNonce: string): Promise<{ currentCredits: number; windowStart: number } | null> {
  const kv = getKvClient()
  if (!kv) return null
  try {
    const key = `usage:${userId}:${licenseNonce}`
    const now = Date.now()
    const windowStart = Math.floor(now / 1000) * 1000 // assuming default 1000ms windowMs
    const val = await kv.hget(key, String(windowStart))
    return val ? { currentCredits: Number(val), windowStart } : null
  } catch (error) {
    logger.error('[Real-Time Tracker] Redis read error', toError(error))
    return null
  }
}

/**
 * Invalidation remains a simple, clean O(1) del command.
 */
export async function invalidateRealTimeCache(userId: string, licenseNonce: string): Promise<void> {
  const kv = getKvClient()
  if (!kv) return
  try {
    await kv.del(`usage:${userId}:${licenseNonce}`)
    logger.debug('[Real-Time Tracker] Cache invalidated', {
      userId, licenseNonce: licenseNonce.slice(0, 8) + '...',
    })
  } catch (error) {
    logger.error('[Real-Time Tracker] Cache invalidation error', toError(error))
  }
}
```

**2. Update `apps/sophia-ai-factory/src/forest/usage-metering/realtime-tracker.ts`**
```typescript
import { canPassCircuitBreaker, recordCircuitFailure, recordCircuitSuccess } from './realtime-tracker-circuit-breaker'
import { incrementRealTimeUsage } from './realtime-tracker-kv-ops'
import { getKvClient } from '@/lib/redis'

export async function trackWithCircuitBreaker(
  userId: string,
  licenseNonce: string,
  tier: string,
  creditsUsed: number,
  windowMs: number = 1000,
): Promise<{ allowed: boolean; reason?: string; currentCredits?: number }> {
  const circuitCheck = await canPassCircuitBreaker(licenseNonce)
  if (!circuitCheck.allowed) {
    logger.warn('[Real-Time Tracker] Blocked by circuit breaker', {
      licenseNonce: licenseNonce.slice(0, 8) + '...', state: circuitCheck.state, reason: circuitCheck.reason,
    })
    return { allowed: false, reason: circuitCheck.reason }
  }
  
  try {
    const kv = getKvClient()
    const now = Date.now()
    const windowStart = Math.floor(now / windowMs) * windowMs
    let currentCredits: number

    if (!kv) {
      logger.debug('[Real-Time Tracker] Redis not available, using fallback')
      currentCredits = creditsUsed
    } else {
      currentCredits = await incrementRealTimeUsage(userId, licenseNonce, windowStart, creditsUsed)
    }

    await recordCircuitSuccess(licenseNonce)
    return { allowed: true, currentCredits }
  } catch (error) {
    await recordCircuitFailure(licenseNonce, toError(error))
    return { allowed: false, reason: `tracking-error: ${toError(error).message}` }
  }
}
```

---

### Approach B: Redis String Keys incorporating `windowStart`

This approach stores each window as a separate String key in Redis:
`usage:${userId}:${licenseNonce}:${windowStart}`

#### Pros:
1. **Granular TTLs**: Each window start key expires independently (e.g. 60 seconds TTL).
2. **Atomicity**: Increments are atomic via `INCRBY`.

#### Cons:
1. **Expensive Invalidation**: Clear/invalidation requires a pattern-based `keys` or `scan` operation (`usage:${userId}:${licenseNonce}:*`), which is an `O(N)` operation and can block the Redis event loop.
2. **Key Proliferation**: High frequency of requests generates many unique Redis keys.

#### Concrete Code Changes:

**1. Update `apps/sophia-ai-factory/src/forest/usage-metering/realtime-tracker-kv-ops.ts`**
```typescript
import { getKvClient } from '@/lib/redis'

export async function incrementRealTimeUsageStringKey(
  userId: string,
  licenseNonce: string,
  windowStart: number,
  creditsUsed: number,
  ttlSeconds: number = 60
): Promise<number> {
  const kv = getKvClient()
  if (!kv) {
    throw new Error('Redis client not available')
  }
  const key = `usage:${userId}:${licenseNonce}:${windowStart}`

  const p = kv.pipeline()
  p.incrby(key, creditsUsed)
  p.expire(key, ttlSeconds)
  const results = await p.exec()
  
  return Number(results[0])
}

/**
 * Cache invalidation requires scanning keys and deleting them.
 */
export async function invalidateRealTimeCache(userId: string, licenseNonce: string): Promise<void> {
  const kv = getKvClient()
  if (!kv) return
  try {
    const pattern = `usage:${userId}:${licenseNonce}:*`
    const keys = await kv.keys(pattern)
    if (keys.length > 0) {
      await kv.del(...keys)
    }
    logger.debug('[Real-Time Tracker] Cache invalidated', {
      userId, licenseNonce: licenseNonce.slice(0, 8) + '...', count: keys.length
    })
  } catch (error) {
    logger.error('[Real-Time Tracker] Cache invalidation error', toError(error))
  }
}
```

**2. Update `apps/sophia-ai-factory/src/forest/usage-metering/realtime-tracker.ts`**
```typescript
  // Inside trackWithCircuitBreaker
  try {
    const kv = getKvClient()
    const now = Date.now()
    const windowStart = Math.floor(now / windowMs) * windowMs
    let currentCredits: number

    if (!kv) {
      logger.debug('[Real-Time Tracker] Redis not available, using fallback')
      currentCredits = creditsUsed
    } else {
      currentCredits = await incrementRealTimeUsageStringKey(userId, licenseNonce, windowStart, creditsUsed)
    }

    await recordCircuitSuccess(licenseNonce)
    return { allowed: true, currentCredits }
  } catch (error) { ... }
```

---

## 5. Implementation Roadmap & Verification Plan

### Phase 1: Unit Test Creation
Since there are no unit tests for the realtime tracker, the implementer should write `realtime-tracker.test.ts` in `apps/sophia-ai-factory/src/forest/usage-metering/` that verifies:
1. Basic increment logic under normal conditions.
2. Concurrent increment behavior (simulating the race condition and verifying atomic summation).
3. Fallback when Redis is unavailable.

### Phase 2: Refactoring
1. Apply Approach A (Redis Hash with `HINCRBY`) to `realtime-tracker-kv-ops.ts` and `realtime-tracker.ts`.
2. Run the newly created test suite using `vitest`.

### Phase 3: Verification
Verify that the `vitest` suite passes and the integration tests under `usage-metering-integration.test.ts` continue to run successfully:
```bash
npx vitest run apps/sophia-ai-factory/src/forest/usage-metering/
```
