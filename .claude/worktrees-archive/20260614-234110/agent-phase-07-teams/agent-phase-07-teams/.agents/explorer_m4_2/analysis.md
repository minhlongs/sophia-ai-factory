# Case 4.2 Analysis: D1 Usage Query JavaScript Rollup Performance

## 1. Executive Summary
In `apps/sophia-ai-factory/src/forest/quota/quota-checker-db.ts`, the `calculateCurrentUsage` function calculates quota usage across three rolling time windows (hourly, daily, monthly) by executing three separate SQL query chains and performing in-memory JavaScript `.reduce()` rollups. This design suffers from high network latency, severe data redundancy (overlapping time windows), and worker CPU blocking/memory pressure under high traffic. We propose replacing the three client select calls with a single SQLite-level aggregate query using conditional aggregation, reducing the operation to one database roundtrip, O(1) memory transfer, and zero JS event-loop CPU blockage.

---

## 2. Direct Code Observations
The current implementation of `calculateCurrentUsage` is found at `apps/sophia-ai-factory/src/forest/quota/quota-checker-db.ts` (lines 59–119):

```typescript
export async function calculateCurrentUsage(
  userId: string,
  licenseNonce: string
): Promise<CachedQuota> {
  const db = createServerClient();
  const now = Math.floor(Date.now() / 1000);

  const hourStart = Math.floor(now / 3600) * 3600;
  const dayStart = Math.floor(now / 86400) * 86400;
  const monthStart = Math.floor(new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime() / 1000);

  try {
    const [hourlyResult, dailyResult, monthlyResult] = await Promise.all([
      db
        .from('usage_events')
        .select('credits_used')
        .eq('user_id', userId)
        .eq('license_nonce', licenseNonce)
        .gte('created_at', hourStart)
        .lt('created_at', hourStart + 3600),

      db
        .from('usage_events')
        .select('credits_used')
        .eq('user_id', userId)
        .eq('license_nonce', licenseNonce)
        .gte('created_at', dayStart)
        .lt('created_at', dayStart + 86400),

      db
        .from('usage_events')
        .select('credits_used')
        .eq('user_id', userId)
        .eq('license_nonce', licenseNonce)
        .gte('created_at', monthStart),
    ]);

    const hourlyCredits = ((hourlyResult.data ?? []) as unknown as CreditsUsedRow[]).reduce(
      (sum, row) => sum + (row.credits_used ?? 0),
      0
    );
    const dailyCredits = ((dailyResult.data ?? []) as unknown as CreditsUsedRow[]).reduce(
      (sum, row) => sum + (row.credits_used ?? 0),
      0
    );
    const monthlyCredits = ((monthlyResult.data ?? []) as unknown as CreditsUsedRow[]).reduce(
      (sum, row) => sum + (row.credits_used ?? 0),
      0
    );

    return {
      hourly: hourlyCredits,
      daily: dailyCredits,
      monthly: monthlyCredits,
      requests: dailyResult.data?.length ?? 0,
    };
  } catch (error) {
    logger.error('[Quota Checker] Error calculating usage', toError(error));
    return { hourly: 0, daily: 0, monthly: 0, requests: 0 };
  }
}
```

---

## 3. Performance & Worker CPU Blocking Analysis

### 3.1 Multiple Connection / Query Roundtrips
The function uses `Promise.all` to query the same table (`usage_events`) three times. Even when executed concurrently, this spawns three network requests or connection checks against the D1 Database binding, contributing to unnecessary network overhead and connection pool exhaustion.

### 3.2 Data Redundancy & Bandwidth Satiation
Because the rolling windows are hierarchical (hour $\subseteq$ day $\subseteq$ month), they overlap completely. For example, if a user runs 50 requests in an hour and 1,000 requests in a month:
- The hourly query fetches 50 rows.
- The daily query fetches those same 50 rows plus others (e.g. 500 rows).
- The monthly query fetches all 1,000 rows (including the hourly and daily rows again).
Thus, the worker fetches **1,550 rows** from the database instead of **1,000 distinct rows**, increasing data payload transport sizes by **55%**.

### 3.3 Worker Memory Pressure & Garbage Collection
Cloudflare Workers execute within V8 isolates with strict memory boundaries (typically 128MB). Instantiating thousands of row objects as JavaScript arrays to hold raw data results (`CreditsUsedRow[]`) incurs heavy memory allocation overhead. Under high concurrency, this triggers aggressive garbage collection cycles and risks Out-of-Memory (OOM) process termination.

### 3.4 Worker CPU Blocking (Event Loop Starvation)
JavaScript on Cloudflare Workers is single-threaded. Calling `.reduce()` on large arrays blocks the main thread from executing other concurrent promises. While a CPU-intensive loop is running, the event loop cannot pick up network I/O, leading to severe latency spikes for parallel requests and potential CPU limit exceedances (which are metered per-request).

---

## 4. Proposed Fix: SQL-Level Aggregate Sum Query

Instead of transmitting thousands of raw rows and processing them in the application layer, the database should calculate the aggregates and return exactly one row.

### 4.1 Index Optimization
In `apps/sophia-ai-factory/migrations/0091-composite-indexes.sql`, we verified the existence of a high-performance composite index `idx_usage_events_user_nonce_ts`:
```sql
CREATE INDEX IF NOT EXISTS idx_usage_events_user_nonce_ts
  ON usage_events(user_id, license_nonce, created_at);
```
By adding `WHERE user_id = ? AND license_nonce = ? AND created_at >= monthStart` to our SQL query, SQLite can perform a high-speed range scan over index pages directly to find events within the current month, bypassing the need for a full table scan.

### 4.2 Proposed SQL Query (Conditional Aggregation)
We can combine all metrics into a single SELECT statement using SQL `SUM(CASE WHEN...)` and `COUNT(CASE WHEN...)`:

```sql
SELECT
  COALESCE(SUM(CASE WHEN created_at >= ?3 AND created_at < ?4 THEN credits_used ELSE 0 END), 0) AS hourly_credits,
  COALESCE(SUM(CASE WHEN created_at >= ?5 AND created_at < ?6 THEN credits_used ELSE 0 END), 0) AS daily_credits,
  COALESCE(SUM(CASE WHEN created_at >= ?7 THEN credits_used ELSE 0 END), 0) AS monthly_credits,
  COUNT(CASE WHEN created_at >= ?5 AND created_at < ?6 THEN 1 END) AS daily_requests
FROM usage_events
WHERE user_id = ?1
  AND license_nonce = ?2
  AND created_at >= ?7;
```

*Note: In SQLite, aggregates on empty rows return `NULL`. We use `COALESCE(SUM(...), 0)` to guarantee numeric outputs. `COUNT()` naturally returns `0` when no rows match.*

### 4.3 Proposed Code Modification in `quota-checker-db.ts`

```typescript
import { getD1Raw } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import { QUOTA_LIMITS } from '@/forest/usage-metering/aggregator';
import type { QuotaLimit } from '@/forest/usage-metering/types';
import type { CachedQuota } from './quota-checker-types';

// Existing imports, interfaces...

interface UsageRollupRow {
  hourly_credits: number;
  daily_credits: number;
  monthly_credits: number;
  daily_requests: number;
}

// ... getEffectiveQuotaLimits remains unchanged ...

/**
 * Calculate current usage from database.
 * Uses rolling time windows: current hour, current day, current month.
 */
export async function calculateCurrentUsage(
  userId: string,
  licenseNonce: string
): Promise<CachedQuota> {
  const db = await getD1Raw();
  const now = Math.floor(Date.now() / 1000);

  const hourStart = Math.floor(now / 3600) * 3600;
  const dayStart = Math.floor(now / 86400) * 86400;
  const monthStart = Math.floor(new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime() / 1000);

  try {
    const row = await db
      .prepare(
        `SELECT
          COALESCE(SUM(CASE WHEN created_at >= ?3 AND created_at < ?4 THEN credits_used ELSE 0 END), 0) AS hourly_credits,
          COALESCE(SUM(CASE WHEN created_at >= ?5 AND created_at < ?6 THEN credits_used ELSE 0 END), 0) AS daily_credits,
          COALESCE(SUM(CASE WHEN created_at >= ?7 THEN credits_used ELSE 0 END), 0) AS monthly_credits,
          COUNT(CASE WHEN created_at >= ?5 AND created_at < ?6 THEN 1 END) AS daily_requests
        FROM usage_events
        WHERE user_id = ?1
          AND license_nonce = ?2
          AND created_at >= ?7`
      )
      .bind(
        userId,
        licenseNonce,
        hourStart,
        hourStart + 3600,
        dayStart,
        dayStart + 86400,
        monthStart
      )
      .first<UsageRollupRow>();

    return {
      hourly: row?.hourly_credits ?? 0,
      daily: row?.daily_credits ?? 0,
      monthly: row?.monthly_credits ?? 0,
      requests: row?.daily_requests ?? 0,
    };
  } catch (error) {
    logger.error('[Quota Checker] Error calculating usage', toError(error));
    return { hourly: 0, daily: 0, monthly: 0, requests: 0 };
  }
}
```

---

## 5. Unit Test Mapping & Verification

### 5.1 Investigation of Test Coverage
We scanned the codebase for tests covering the quota modules:
- **Direct Coverage**: There are currently **no** unit tests targeting `quota-checker-db.ts` or the `calculateCurrentUsage` function specifically.
- **Related Tests**:
  - `apps/sophia-ai-factory/src/forest/quota/video-quota.test.ts` (Covers `video-quota.ts`)
  - `apps/sophia-ai-factory/src/forest/quota/__tests__/mission-quota.test.ts` (Covers `mission-quota.ts`)
  - `apps/sophia-ai-factory/src/seed/auth/enriched-jwt.test.ts` (Mocks `getEffectiveQuotaLimits` dependency via a test-double but does not invoke database queries)

### 5.2 Independent Verification Strategy
To safely implement the proposed change, the following verification suite should be run:
1. **TypeScript Type Verification**: Run type-checking command:
   ```bash
   npm run type-check
   ```
2. **Regression Testing**: Run the existing quota-related unit test files to ensure no regressions are introduced:
   ```bash
   npx vitest run src/forest/quota/
   ```
3. **Smoke/Integration Testing**: Run the smoke test scripts:
   ```bash
   npm run test:smoke
   ```
