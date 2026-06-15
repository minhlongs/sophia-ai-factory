# Handoff Report: Case 4.1 Redis Non-Atomic Read-Modify-Write in Real-Time Tracker

## 1. Observation
* **Vulnerable Code Location**: `apps/sophia-ai-factory/src/forest/usage-metering/realtime-tracker.ts` lines 40-48:
  ```typescript
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
* **KV Operations Location**: `apps/sophia-ai-factory/src/forest/usage-metering/realtime-tracker-kv-ops.ts` lines 18 and 33:
  * Read: `const cached = await kv.get(\`usage:\${userId}:\${licenseNonce}\`)`
  * Write: `await kv.set(\`usage:\${usage.userId}:\${usage.licenseNonce}\`, usage, { ex: ttlSeconds })`
* **Invalidation Location**: `apps/sophia-ai-factory/src/forest/usage-metering/tracker-db-helpers.ts` line 137:
  * Invalidate: `invalidateRealTimeCache(event.userId, event.licenseNonce).catch(() => {});`
* **Test Coverage**: Listed all files in `/apps/sophia-ai-factory/src/forest/usage-metering` and grep-searched for references to `realtime-tracker` and `trackWithCircuitBreaker`. No unit test files cover `realtime-tracker.ts` directly.

---

## 2. Logic Chain
1. **Observation 1 (Vulnerable Code)** shows that the real-time tracker uses an asynchronous sequence: `getRealTimeUsage` (read from Redis), followed by local logic in JS to modify `current.currentCredits`, followed by `updateRealTimeUsage` (write to Redis).
2. Because these read, modify, and write steps are distinct non-atomic asynchronous operations, two concurrent requests that overlap in execution will both read the same initial state of `currentCredits`.
3. Consequently, both requests will compute their increments locally and overwrite the same Redis key sequentially, resulting in the usage tracked by the earlier request being lost (overwritten by the later request).
4. **Observation 2 (KV Operations)** indicates the storage is currently a flat JSON object under `usage:${userId}:${licenseNonce}`.
5. To eliminate the race condition, we must perform the read, increment, and write atomically inside the Redis engine.
6. The window start stamp (`windowStart`) must be incorporated into the structured Redis key (or Hash field) so that each time-based window aggregates usage independently.
7. Using an atomic command such as `INCRBY` (for String keys) or `HINCRBY` (for Hash keys) combined with `EXPIRE` via a pipeline ensures atomicity and limits memory usage.
8. Compare Approaches:
   * **Approach A (Redis Hash)**: Using `HINCRBY` on key `usage:${userId}:${licenseNonce}` with field `windowStart` allows simple `O(1)` deletion of the entire user/license cache in `invalidateRealTimeCache` (Observation 3).
   * **Approach B (Redis String)**: Using `INCRBY` on key `usage:${userId}:${licenseNonce}:${windowStart}` requires `keys` or `scan` for cache invalidation, which runs in `O(N)` and blocks standard Redis execution.
9. Therefore, Approach A (Redis Hash via `hincrby`) is the recommended design because it maintains `O(1)` invalidation efficiency.

---

## 3. Caveats
* **Assumptions**: We assume the Upstash Redis serverless connection configured in `lib/redis.ts` has pipelining support enabled (which the standard `@upstash/redis` library does).
* **Scope**: We have not investigated the production performance overhead of storing multiple historical fields under the same Redis Hash. However, given the short window limits and the overall key TTL, the field accumulation is bounded and highly unlikely to cause performance degradation.

---

## 4. Conclusion
The current non-atomic read-modify-write pattern introduces race conditions under concurrent requests. We propose transitioning to a Redis Hash-based storage structure using `HINCRBY` and `EXPIRE` in a pipeline (Approach A), which preserves atomic accumulation while retaining `O(1)` cache invalidation capability.

---

## 5. Verification Method
The implementer can verify the proposed fix using the following steps:
1. Create a unit test file `realtime-tracker.test.ts` in `apps/sophia-ai-factory/src/forest/usage-metering/` that uses `vi.mock` for `@/lib/redis` and tests:
   * Single-request flow: increments credit counter correctly.
   * Multi-request concurrent flow: calls `trackWithCircuitBreaker` multiple times concurrently, asserting that the final value equals the sum of all increments.
2. Run the unit test suite:
   ```bash
   npx vitest run apps/sophia-ai-factory/src/forest/usage-metering/realtime-tracker.test.ts
   ```
3. Run the existing usage metering integration tests to verify no regressions:
   ```bash
   npx vitest run apps/sophia-ai-factory/src/forest/usage-metering/usage-metering-integration.test.ts
   ```
