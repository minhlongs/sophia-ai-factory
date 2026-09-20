# Executive BI Metrics Aggregator & Analytical Models — Technical Blueprint & Handoff Report

**Role:** `teamwork_preview_explorer_m3_1`  
**Working Directory:** `/Users/macbook/sophia-ai-factory/.agents/teamwork_preview_explorer_m3_1/`  
**Parent Agent:** `78b5382f-0b81-4402-ad59-b06284d61c09`  
**Milestone:** Milestone 3 (Executive BI & Automated Reporting Engine)  
**Date:** 2026-09-20  
**Handoff Type:** Hard (Complete, self-contained implementation blueprint)

---

## 1. Observation

### 1.1 Test Suite Audit & Verbatim Contracts
Direct inspection of `apps/sophia-ai-factory/src/__tests__/e2e/enterprise/executive-bi.e2e.test.ts` (lines 69–156, 348–436, 441–501, 506–570) reveals the exact functional and adversarial contract for the Executive BI Metrics Aggregator:

1. **Feature F1-1 (Unified Metric Aggregation):**
   ```typescript
   // Lines 74-81
   INSERT INTO executive_bi_metrics
   (id, org_id, period_start, period_end, mrr_cents, throughput_count, viral_score, affiliate_revenue_cents, marketing_spend_cents, created_at)
   VALUES
   ('bi_1', ?1, ?2, ?3, 250000, 45, 84.5, 300000, 100000, ?4),
   ('bi_2', ?1, ?2, ?3, 300000, 55, 91.0, 450000, 150000, ?4)
   
   // Assertions lines 85-91:
   expect(metrics.orgId).toBe(testOrgId);
   expect(metrics.mrrCents).toBe(300000); // Peak MRR: max(250000, 300000)
   expect(metrics.throughputCount).toBe(100); // 45 + 55 = 100
   expect(metrics.viralScore).toBe(87.75); // (84.5 + 91.0) / 2
   expect(metrics.affiliateRevenueCents).toBe(750000); // 300000 + 450000
   expect(metrics.marketingSpendCents).toBe(250000); // 100000 + 150000
   expect(metrics.roiRatio).toBe(3.0); // 750000 / 250000 = 3.0x
   ```

2. **Feature F1-2 (Zeroed Fallback on Empty Range):**
   ```typescript
   // Lines 94-106
   const metrics = await aggregateExecutiveBIMetrics(db, testOrgId, { start: 1000, end: 2000 });
   expect(metrics.mrrCents).toBe(0);
   expect(metrics.throughputCount).toBe(0);
   expect(metrics.viralScore).toBe(0);
   expect(metrics.affiliateRevenueCents).toBe(0);
   expect(metrics.marketingSpendCents).toBe(0);
   expect(metrics.roiRatio).toBe(0);
   ```

3. **Feature F1-4 (Decimal Rounding of ROI Ratio):**
   ```typescript
   // Lines 124-137
   // Revenue 357890, Spend 123450 -> 357890 / 123450 = 2.89906... -> 2.9
   expect(metrics.roiRatio).toBe(2.9);
   ```

4. **Feature F1-5 (Arithmetic Mean of Viral Scores):**
   ```typescript
   // Lines 139-155
   // Scores [70, 80, 90, 85, 95] -> sum 420 / 5 = 84.00
   expect(metrics.viralScore).toBe(84);
   ```

5. **Boundary B1 (Division by Zero Protection):**
   ```typescript
   // Lines 350-362: Spend is 0, Affiliate revenue is 50000
   const metrics = await aggregateExecutiveBIMetrics(db, testOrgId, rangeJune);
   expect(Number.isFinite(metrics.roiRatio)).toBe(true);
   expect(metrics.roiRatio).toBe(99.0); // Safe max multiplier when spend is 0 but revenue exists
   ```

6. **Boundary B2 (Dual Zero Invariant):**
   ```typescript
   // Lines 364-377: Both revenue and spend are 0
   expect(metrics.roiRatio).toBe(0);
   expect(metrics.viralScore).toBe(0);
   ```

7. **Boundary B3 (Extreme Financial Numbers / $10M+ Scale):**
   ```typescript
   // Lines 379-393: MRR 1,000,000,000 cents ($10M), Spend 200,000,000 cents ($2M)
   expect(metrics.mrrCents).toBe(1_000_000_000);
   expect(metrics.roiRatio).toBe(5.0);
   ```

8. **Boundary B5 (Strict Date Range Exclusion):**
   ```typescript
   // Lines 411-435: Record from May (start 1000, end 2000) is excluded from June query
   expect(metrics.throughputCount).toBe(10); // Excludes May's 500 videos
   ```

9. **Combination P1 (Multi-Tenant Isolation):**
   ```typescript
   // Lines 442-471: Querying Org A does not include Org B's metrics
   expect(metricsA.throughputCount).toBe(50);
   expect(metricsB.throughputCount).toBe(500);
   ```

10. **Real-World Scenario S1 (Multi-Channel Closeout):**
    ```typescript
    // Lines 507-530: TikTok, Shorts, Reels multi-channel inputs
    expect(summary.mrrCents).toBe(450000); // Peak $4,500.00
    expect(summary.throughputCount).toBe(260); // 120 + 80 + 60
    expect(summary.viralScore).toBe(88.67); // (92.5 + 88.0 + 85.5) / 3
    expect(summary.affiliateRevenueCents).toBe(2000000); // $20,000.00
    expect(summary.marketingSpendCents).toBe(500000); // $5,000.00
    expect(summary.roiRatio).toBe(4.0); // 2,000,000 / 500,000 = 4.0x
    ```

### 1.2 Verification Command Baseline
Execution of the test suite against the reference test harness passes with 100% success rate:
```bash
PATH="/opt/homebrew/bin:$PATH" npx vitest run src/__tests__/e2e/enterprise/executive-bi.e2e.test.ts
# Result: 33 passed (33) in 24ms
```

### 1.3 Database Migration Gap
Inspection of `apps/sophia-ai-factory/migrations/`:
- `0276_enterprise_scale_foundations.sql` defines `custom_domains`.
- `0277_enterprise_org_invitations.sql` defines `org_invitations`.
- Table `executive_bi_metrics` is defined only inside `enterprise-test-harness.ts` (lines 115-126). It does not yet exist as an applied D1 migration.
- Milestone 3 requires `migrations/0278_enterprise_executive_bi.sql`.

---

## 2. Logic Chain

1. **From Observation 1.1 (`F1-1`, `S1`) to Peak MRR Formula:**
   Monthly Recurring Revenue across multiple runs or channels represents the highest point capacity reached by the organization. Therefore:
   $$\text{mrrCents} = \max_{r \in \text{results}} (r.\text{mrr\_cents})$$
   Using `Math.max` over the result set (defaulting to `0` if empty) guarantees exact conformity with assertions in `F1-1` (`300000`) and `S1` (`450000`).

2. **From Observation 1.1 (`F1-1`, `F1-3`, `S1`) to Throughput Sum:**
   Video throughput represents the total creative output count. Therefore:
   $$\text{throughputCount} = \sum_{r \in \text{results}} r.\text{throughput\_count}$$
   Iterative accumulation preserves accuracy across multiple batch runs (`F1-3: 5 * 20 = 100`) and multi-channel runs (`S1: 120 + 80 + 60 = 260`).

3. **From Observation 1.1 (`F1-1`, `F1-5`, `S1`) to Viral Score Average:**
   Viral score is an index from 0 to 100 representing content quality. Across multiple campaigns or channels, the aggregate must be the arithmetic mean of all non-empty batches rounded to 2 decimal places:
   $$\text{viralScore} = \text{Number}\left(\left(\frac{\sum r.\text{viral\_score}}{|\text{results}|}\right).\text{toFixed}(2)\right)$$
   For `F1-5`, `420 / 5 = 84` (in JS, `Number((84).toFixed(2))` evaluates to `84`). For `S1`, `266 / 3 = 88.6666...` rounds to `88.67`.

4. **From Observation 1.1 (`B1`, `B2`, `F1-4`, `S1`) to ROI Ratio & Zero Division:**
   Affiliate ROI is defined as $\frac{\text{Affiliate Revenue}}{\text{Marketing Spend}}$.
   - If $\text{Spend} > 0$: $\text{roiRatio} = \text{Number}\left(\left(\frac{\text{totalAffiliate}}{\text{totalSpend}}\right).\text{toFixed}(2)\right)$.
   - If $\text{Spend} == 0 \land \text{Revenue} > 0$: As proven by boundary test `B1`, a finite safe multiplier `99.0` must be returned to avoid division by zero or returning `Infinity`.
   - If $\text{Spend} == 0 \land \text{Revenue} == 0$: As proven by boundary test `B2`, `0` is returned.
   - If $|\text{results}| == 0$: As proven by `F1-2`, `0` is returned.

5. **From Observation 1.1 (`B5`, `P1`) to SQL Query Structure:**
   Strict tenant isolation and date windowing require:
   ```sql
   SELECT * FROM executive_bi_metrics
   WHERE org_id = ?1 AND period_start >= ?2 AND period_end <= ?3
   ```
   - Filtering on `org_id = ?1` strictly blocks cross-tenant data contamination (satisfying `P1`).
   - Filtering on `period_start >= ?2 AND period_end <= ?3` strictly excludes prior or subsequent periods (satisfying `B5`).
   - If no records match, an early return pattern guarantees zeroed metrics without crashing (satisfying `F1-2`).

6. **From Observation 1.3 to Schema Migration Necessity:**
   To graduate from test-harness emulation to production D1 execution, `migrations/0278_enterprise_executive_bi.sql` must create `executive_bi_metrics` with proper primary keys, foreign key cascading to `organizations(id)`, and a composite index on `(org_id, period_start, period_end)` for query acceleration.

---

## 3. Caveats

1. **In-Memory vs. SQL Aggregation:**
   SQLite supports `MAX(mrr_cents)`, `SUM(throughput_count)`, `AVG(viral_score)`, `SUM(affiliate_revenue_cents)`, and `SUM(marketing_spend_cents)`. However, `enterprise-test-harness.ts` uses row fetching (`SELECT *`) with JavaScript reduction. In Cloudflare Workers D1, periodic snapshots for an organization typically range between 1 and 100 rows per query, making in-memory reduction lightning fast (<5ms) while providing exact compatibility with the test harness. If high volume is expected (>10,000 rows per query), an optional SQL aggregate mode should be provided.
2. **Channel Breakdown Storage:**
   The `executive_bi_metrics` table does not currently include a `channel` column in the primary schema, though test `S1` identifies channel-specific batches by record ID (`bi_tiktok`, `bi_shorts`, `bi_reels`). Adding an optional nullable `channel TEXT` column in migration `0278` preserves backward compatibility with the test harness while allowing future channel-level reporting.
3. **Currency Invariants:**
   All monetary amounts (`mrr_cents`, `affiliate_revenue_cents`, `marketing_spend_cents`) are strictly stored in integer cents to prevent floating-point rounding errors. Currency display conversion ($/€) is delegated to presentation formatters (`formatTelegramDigest`, `wrapWithAgencyBranding`, `formatStreamingCsv`).

---

## 4. Conclusion & Implementation Blueprint

The technical blueprint is divided into three actionable implementation deliverables:
1. `apps/sophia-ai-factory/src/seed/types/executive-bi.ts`
2. `apps/sophia-ai-factory/src/tree/bi/metrics-aggregator.ts`
3. `apps/sophia-ai-factory/migrations/0278_enterprise_executive_bi.sql`
4. `apps/sophia-ai-factory/src/__tests__/unit/enterprise/metrics-aggregator.test.ts`

### 4.1 Deliverable 1: `apps/sophia-ai-factory/src/seed/types/executive-bi.ts`
*(Pure seed layer — foundational types, zero upper-layer imports)*

```typescript
/**
 * Executive Business Intelligence (BI) & Analytical Models — Seed Type Definitions
 *
 * Layer: seed/types (Foundational primitives)
 * Dependencies: None (zero internal framework dependencies)
 *
 * @module seed/types/executive-bi
 */

export interface DateRange {
  start: number; // epoch ms (inclusive)
  end: number;   // epoch ms (inclusive)
}

export interface ExecutiveBIMetricsSummary {
  orgId: string;
  periodStart: number;
  periodEnd: number;
  mrrCents: number;
  throughputCount: number;
  viralScore: number;
  affiliateRevenueCents: number;
  marketingSpendCents: number;
  roiRatio: number;
}

export interface ExecutiveBIMetricRow {
  id: string;
  org_id: string;
  period_start: number;
  period_end: number;
  mrr_cents: number;
  throughput_count: number;
  viral_score: number;
  affiliate_revenue_cents: number;
  marketing_spend_cents: number;
  channel?: string | null;
  created_at: number;
}

export interface ExecutiveBIMetricRecord {
  id: string;
  orgId: string;
  periodStart: number;
  periodEnd: number;
  mrrCents: number;
  throughputCount: number;
  viralScore: number;
  affiliateRevenueCents: number;
  marketingSpendCents: number;
  channel?: string | null;
  createdAt: number;
}

export interface CreateExecutiveBIMetricInput {
  id?: string;
  orgId: string;
  periodStart: number;
  periodEnd: number;
  mrrCents: number;
  throughputCount: number;
  viralScore: number;
  affiliateRevenueCents: number;
  marketingSpendCents: number;
  channel?: string;
  createdAt?: number;
}

export type ExecutiveBIExportFormat = 'csv' | 'json' | 'ndjson';

export interface ExecutiveBIExportOptions {
  format: ExecutiveBIExportFormat;
  dateRange: DateRange;
  channel?: string;
  filename?: string;
}

export type ExecutiveBIErrorCode =
  | 'INVALID_DATE_RANGE'
  | 'ORGANIZATION_REQUIRED'
  | 'CROSS_TENANT_VIOLATION'
  | 'DB_UNAVAILABLE'
  | 'RECORD_CREATION_FAILED'
  | 'QUERY_EXECUTION_FAILED';

export interface ExecutiveBIError {
  code: ExecutiveBIErrorCode;
  message: string;
  details?: unknown;
}
```

---

### 4.2 Deliverable 2: `apps/sophia-ai-factory/src/tree/bi/metrics-aggregator.ts`
*(Pure tree layer — domain logic, imports only from `@/seed`)*

```typescript
/**
 * Executive Business Intelligence (BI) Metrics Aggregator Service
 *
 * Implements core analytical aggregations across multi-track generation runs:
 * - Peak MRR tracking
 * - Total video throughput calculation
 * - Average viral engagement score calculation
 * - Affiliate conversion revenue & marketing spend sums
 * - Return on Investment (ROI) ratio with zero-division protection
 * - Strict multi-tenant data isolation and date range filtering
 *
 * Layer: tree/bi (Pure domain logic — imports only from @/seed)
 *
 * @module tree/bi/metrics-aggregator
 */

import type { D1Database } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import type {
  DateRange,
  ExecutiveBIMetricsSummary,
  ExecutiveBIMetricRow,
  ExecutiveBIMetricRecord,
  CreateExecutiveBIMetricInput,
} from '@/seed/types/executive-bi';

/**
 * Creates an empty, zero-initialized ExecutiveBIMetricsSummary.
 */
export function createEmptyBIMetricsSummary(
  orgId: string,
  dateRange: DateRange,
): ExecutiveBIMetricsSummary {
  return {
    orgId,
    periodStart: dateRange?.start ?? 0,
    periodEnd: dateRange?.end ?? 0,
    mrrCents: 0,
    throughputCount: 0,
    viralScore: 0,
    affiliateRevenueCents: 0,
    marketingSpendCents: 0,
    roiRatio: 0,
  };
}

/**
 * Computes ROI ratio with zero-division protection.
 * - When spend > 0: returns (revenue / spend) rounded to 2 decimal places.
 * - When spend == 0 and revenue > 0: returns safe maximum multiplier 99.0x.
 * - When spend == 0 and revenue == 0: returns 0.0x.
 */
export function calculateRoiRatio(
  affiliateRevenueCents: number,
  marketingSpendCents: number,
): number {
  if (marketingSpendCents > 0) {
    return Number((affiliateRevenueCents / marketingSpendCents).toFixed(2));
  }
  if (affiliateRevenueCents > 0) {
    return 99.0;
  }
  return 0;
}

/**
 * Computes arithmetic mean of viral scores rounded to 2 decimal places.
 */
export function calculateAverageViralScore(scores: number[]): number {
  if (scores.length === 0) return 0;
  const sum = scores.reduce((acc, score) => acc + score, 0);
  return Number((sum / scores.length).toFixed(2));
}

/**
 * Validates date range integrity.
 */
export function isValidDateRange(range: DateRange): boolean {
  return (
    typeof range === 'object' &&
    range !== null &&
    typeof range.start === 'number' &&
    typeof range.end === 'number' &&
    Number.isFinite(range.start) &&
    Number.isFinite(range.end) &&
    range.start <= range.end
  );
}

/**
 * Aggregates executive BI metrics for a specific organization across a specified date range.
 *
 * @param db - Cloudflare D1 database handle
 * @param orgId - Target organization ID (strict tenant isolation)
 * @param dateRange - Inclusive start and end epoch timestamps
 * @returns Unified ExecutiveBIMetricsSummary
 */
export async function aggregateExecutiveBIMetrics(
  db: D1Database,
  orgId: string,
  dateRange: DateRange,
): Promise<ExecutiveBIMetricsSummary> {
  const sanitizedOrgId = (orgId ?? '').trim();
  if (!sanitizedOrgId || !isValidDateRange(dateRange)) {
    logger.warn('[ExecutiveBIAggregator] Invalid orgId or dateRange provided', {
      orgId,
      dateRange,
    });
    return createEmptyBIMetricsSummary(sanitizedOrgId, dateRange ?? { start: 0, end: 0 });
  }

  try {
    const rows = await db
      .prepare(
        `SELECT
           id,
           org_id,
           period_start,
           period_end,
           mrr_cents,
           throughput_count,
           viral_score,
           affiliate_revenue_cents,
           marketing_spend_cents,
           channel,
           created_at
         FROM executive_bi_metrics
         WHERE org_id = ?1 AND period_start >= ?2 AND period_end <= ?3
         ORDER BY period_start ASC`,
      )
      .bind(sanitizedOrgId, dateRange.start, dateRange.end)
      .all<ExecutiveBIMetricRow>();

    const results = rows.results ?? [];
    if (results.length === 0) {
      return createEmptyBIMetricsSummary(sanitizedOrgId, dateRange);
    }

    let peakMrr = 0;
    let totalThroughput = 0;
    let sumViral = 0;
    let totalAffiliate = 0;
    let totalSpend = 0;

    for (const r of results) {
      const mrr = Number(r.mrr_cents) || 0;
      if (mrr > peakMrr) {
        peakMrr = mrr;
      }
      totalThroughput += Number(r.throughput_count) || 0;
      sumViral += Number(r.viral_score) || 0;
      totalAffiliate += Number(r.affiliate_revenue_cents) || 0;
      totalSpend += Number(r.marketing_spend_cents) || 0;
    }

    const avgViral = results.length > 0 ? Number((sumViral / results.length).toFixed(2)) : 0;
    const roiRatio = calculateRoiRatio(totalAffiliate, totalSpend);

    return {
      orgId: sanitizedOrgId,
      periodStart: dateRange.start,
      periodEnd: dateRange.end,
      mrrCents: peakMrr,
      throughputCount: totalThroughput,
      viralScore: avgViral,
      affiliateRevenueCents: totalAffiliate,
      marketingSpendCents: totalSpend,
      roiRatio,
    };
  } catch (error) {
    logger.error('[ExecutiveBIAggregator] Query execution failed', {
      error,
      orgId: sanitizedOrgId,
      dateRange,
    });
    throw error;
  }
}

/**
 * Records a single Executive BI metric snapshot into D1.
 */
export async function recordExecutiveBIMetric(
  db: D1Database,
  input: CreateExecutiveBIMetricInput,
): Promise<ExecutiveBIMetricRecord> {
  const sanitizedOrgId = (input.orgId ?? '').trim();
  if (!sanitizedOrgId) {
    throw new Error('ORGANIZATION_REQUIRED: Valid orgId is required to record BI metrics');
  }

  const id = input.id ?? `bi_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const createdAt = input.createdAt ?? Date.now();

  await db
    .prepare(
      `INSERT INTO executive_bi_metrics (
         id,
         org_id,
         period_start,
         period_end,
         mrr_cents,
         throughput_count,
         viral_score,
         affiliate_revenue_cents,
         marketing_spend_cents,
         channel,
         created_at
       ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)`,
    )
    .bind(
      id,
      sanitizedOrgId,
      input.periodStart,
      input.periodEnd,
      input.mrrCents,
      input.throughputCount,
      input.viralScore,
      input.affiliateRevenueCents,
      input.marketingSpendCents,
      input.channel ?? null,
      createdAt,
    )
    .run();

  return {
    id,
    orgId: sanitizedOrgId,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    mrrCents: input.mrrCents,
    throughputCount: input.throughputCount,
    viralScore: input.viralScore,
    affiliateRevenueCents: input.affiliateRevenueCents,
    marketingSpendCents: input.marketingSpendCents,
    channel: input.channel ?? null,
    createdAt,
  };
}

/**
 * Records multiple Executive BI metric snapshots in an atomic batch.
 */
export async function recordExecutiveBIMetricsBatch(
  db: D1Database,
  orgId: string,
  inputs: CreateExecutiveBIMetricInput[],
): Promise<{ count: number }> {
  const sanitizedOrgId = (orgId ?? '').trim();
  if (!sanitizedOrgId) {
    throw new Error('ORGANIZATION_REQUIRED: Valid orgId is required');
  }
  if (!inputs || inputs.length === 0) {
    return { count: 0 };
  }

  const statements = inputs.map((input) => {
    const id = input.id ?? `bi_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const createdAt = input.createdAt ?? Date.now();
    return db
      .prepare(
        `INSERT INTO executive_bi_metrics (
           id,
           org_id,
           period_start,
           period_end,
           mrr_cents,
           throughput_count,
           viral_score,
           affiliate_revenue_cents,
           marketing_spend_cents,
           channel,
           created_at
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)`,
      )
      .bind(
        id,
        sanitizedOrgId,
        input.periodStart,
        input.periodEnd,
        input.mrrCents,
        input.throughputCount,
        input.viralScore,
        input.affiliateRevenueCents,
        input.marketingSpendCents,
        input.channel ?? null,
        createdAt,
      );
  });

  await db.batch(statements);
  return { count: inputs.length };
}
```

---

### 4.3 Deliverable 3: `apps/sophia-ai-factory/migrations/0278_enterprise_executive_bi.sql`
*(Cloudflare D1 schema migration)*

```sql
-- Migration: 0278_enterprise_executive_bi
-- Phase 18–19: Enterprise Executive Business Intelligence & Automated Reporting
-- Sequentially follows 0277_enterprise_org_invitations.sql

-- ============================================================================
-- 1. PRE-FLIGHT PRAGMA IDEMPOTENCY CHECKS
-- ============================================================================

PRAGMA foreign_keys = ON;
PRAGMA defer_foreign_keys = ON;

-- ============================================================================
-- 2. TABLE: executive_bi_metrics
-- Description: Analytical rollups and periodic snapshots for enterprise organizations.
-- Supports peak MRR, generation throughput, viral scoring, and affiliate ROI.
-- ============================================================================

CREATE TABLE IF NOT EXISTS executive_bi_metrics (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  period_start INTEGER NOT NULL,
  period_end INTEGER NOT NULL,
  mrr_cents INTEGER NOT NULL DEFAULT 0,
  throughput_count INTEGER NOT NULL DEFAULT 0,
  viral_score REAL NOT NULL DEFAULT 0,
  affiliate_revenue_cents INTEGER NOT NULL DEFAULT 0,
  marketing_spend_cents INTEGER NOT NULL DEFAULT 0,
  channel TEXT DEFAULT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

-- ============================================================================
-- 3. INDEXES FOR PERFORMANCE & TENANT ISOLATION
-- ============================================================================

-- 1. Primary composite index for multi-tenant date range queries
CREATE INDEX IF NOT EXISTS idx_executive_bi_metrics_org_period 
  ON executive_bi_metrics(org_id, period_start, period_end);

-- 2. Recency index for chronological listing and audit
CREATE INDEX IF NOT EXISTS idx_executive_bi_metrics_org_created 
  ON executive_bi_metrics(org_id, created_at DESC);

-- 3. Start boundary index for period filtering
CREATE INDEX IF NOT EXISTS idx_executive_bi_metrics_period_start 
  ON executive_bi_metrics(period_start);

-- 4. End boundary index for period filtering
CREATE INDEX IF NOT EXISTS idx_executive_bi_metrics_period_end 
  ON executive_bi_metrics(period_end);
```

---

### 4.4 Deliverable 4: `apps/sophia-ai-factory/src/__tests__/unit/enterprise/metrics-aggregator.test.ts`
*(Direct unit test suite verifying the tree service against simulated D1)*

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import {
  aggregateExecutiveBIMetrics,
  calculateRoiRatio,
  calculateAverageViralScore,
  isValidDateRange,
  recordExecutiveBIMetric,
  recordExecutiveBIMetricsBatch,
  createEmptyBIMetricsSummary,
} from '@/tree/bi/metrics-aggregator';
import { makeD1 } from '@/__tests__/integration/shared-d1-shim';
import { createRequire } from 'node:module';

const req = createRequire(import.meta.url);
const { DatabaseSync } = req('node:sqlite') as {
  DatabaseSync: new (path: string) => {
    exec(sql: string): void;
    prepare(sql: string): unknown;
  };
};

describe('Unit Tests: Executive BI Metrics Aggregator Service', () => {
  let db: ReturnType<typeof makeD1>;
  const testOrgId = 'org_unit_test';
  const range = { start: 1700000000000, end: 1702592000000 };

  beforeEach(() => {
    const raw = new DatabaseSync(':memory:');
    raw.exec(`
      CREATE TABLE IF NOT EXISTS executive_bi_metrics (
        id TEXT PRIMARY KEY,
        org_id TEXT NOT NULL,
        period_start INTEGER NOT NULL,
        period_end INTEGER NOT NULL,
        mrr_cents INTEGER NOT NULL DEFAULT 0,
        throughput_count INTEGER NOT NULL DEFAULT 0,
        viral_score REAL NOT NULL DEFAULT 0,
        affiliate_revenue_cents INTEGER NOT NULL DEFAULT 0,
        marketing_spend_cents INTEGER NOT NULL DEFAULT 0,
        channel TEXT DEFAULT NULL,
        created_at INTEGER NOT NULL
      );
    `);
    db = makeD1(raw as unknown as InstanceType<typeof DatabaseSync>);
  });

  describe('Pure Calculation Functions', () => {
    it('calculates ROI ratio with 2 decimal rounding', () => {
      expect(calculateRoiRatio(300000, 100000)).toBe(3.0);
      expect(calculateRoiRatio(357890, 123450)).toBe(2.9);
    });

    it('returns safe fallback 99.0 when spend is 0 and revenue > 0', () => {
      expect(calculateRoiRatio(50000, 0)).toBe(99.0);
    });

    it('returns 0 when both revenue and spend are 0', () => {
      expect(calculateRoiRatio(0, 0)).toBe(0);
    });

    it('calculates average viral score correctly', () => {
      expect(calculateAverageViralScore([70, 80, 90, 85, 95])).toBe(84);
      expect(calculateAverageViralScore([92.5, 88.0, 85.5])).toBe(88.67);
      expect(calculateAverageViralScore([])).toBe(0);
    });

    it('validates date ranges accurately', () => {
      expect(isValidDateRange({ start: 1000, end: 2000 })).toBe(true);
      expect(isValidDateRange({ start: 2000, end: 1000 })).toBe(false);
      expect(isValidDateRange({ start: NaN, end: 2000 })).toBe(false);
    });
  });

  describe('D1 Aggregations & Mutations', () => {
    it('records and aggregates metrics across batches', async () => {
      await recordExecutiveBIMetric(db as unknown as D1Database, {
        orgId: testOrgId,
        periodStart: range.start,
        periodEnd: range.end,
        mrrCents: 200000,
        throughputCount: 50,
        viralScore: 85.0,
        affiliateRevenueCents: 400000,
        marketingSpendCents: 100000,
      });

      await recordExecutiveBIMetric(db as unknown as D1Database, {
        orgId: testOrgId,
        periodStart: range.start,
        periodEnd: range.end,
        mrrCents: 350000,
        throughputCount: 75,
        viralScore: 95.0,
        affiliateRevenueCents: 600000,
        marketingSpendCents: 150000,
      });

      const summary = await aggregateExecutiveBIMetrics(db as unknown as D1Database, testOrgId, range);

      expect(summary.mrrCents).toBe(350000); // Peak MRR
      expect(summary.throughputCount).toBe(125); // 50 + 75
      expect(summary.viralScore).toBe(90); // (85 + 95) / 2
      expect(summary.affiliateRevenueCents).toBe(1000000);
      expect(summary.marketingSpendCents).toBe(250000);
      expect(summary.roiRatio).toBe(4.0);
    });

    it('records batch metrics atomically via recordExecutiveBIMetricsBatch', async () => {
      const inputs = [
        {
          orgId: testOrgId,
          periodStart: range.start,
          periodEnd: range.end,
          mrrCents: 100000,
          throughputCount: 10,
          viralScore: 80,
          affiliateRevenueCents: 20000,
          marketingSpendCents: 10000,
        },
        {
          orgId: testOrgId,
          periodStart: range.start,
          periodEnd: range.end,
          mrrCents: 150000,
          throughputCount: 20,
          viralScore: 86,
          affiliateRevenueCents: 40000,
          marketingSpendCents: 15000,
        },
      ];

      const res = await recordExecutiveBIMetricsBatch(db as unknown as D1Database, testOrgId, inputs);
      expect(res.count).toBe(2);

      const summary = await aggregateExecutiveBIMetrics(db as unknown as D1Database, testOrgId, range);
      expect(summary.throughputCount).toBe(30);
      expect(summary.mrrCents).toBe(150000);
    });

    it('handles empty date range safely without throwing', async () => {
      const summary = await aggregateExecutiveBIMetrics(
        db as unknown as D1Database,
        testOrgId,
        { start: 100, end: 200 },
      );
      expect(summary.throughputCount).toBe(0);
      expect(summary.mrrCents).toBe(0);
      expect(summary.roiRatio).toBe(0);
    });
  });
});
```

---

## 5. Verification Method

Once implemented by the builder agent, verify through the following gates:

### Step 1: Run the Executive BI E2E Test Suite
```bash
cd apps/sophia-ai-factory
PATH="/opt/homebrew/bin:$PATH" npx vitest run src/__tests__/e2e/enterprise/executive-bi.e2e.test.ts
```
**Expected Result:**
```
✓ src/__tests__/e2e/enterprise/executive-bi.e2e.test.ts (33 tests)
Test Files  1 passed (1)
Tests       33 passed (33)
```

### Step 2: Run All Enterprise Scale Engine E2E Tests (137 tests)
```bash
cd apps/sophia-ai-factory
PATH="/opt/homebrew/bin:$PATH" npx vitest run src/__tests__/e2e/enterprise/
```
**Expected Result:**
```
✓ src/__tests__/e2e/enterprise/executive-bi.e2e.test.ts (33 tests)
✓ src/__tests__/e2e/enterprise/custom-domains-whitelabel.e2e.test.ts (33 tests)
✓ src/__tests__/e2e/enterprise/organizations-rbac.e2e.test.ts (38 tests)
✓ src/__tests__/e2e/enterprise/outbound-webhooks.e2e.test.ts (33 tests)
Test Files  4 passed (4)
Tests       137 passed (137)
```

### Step 3: Run TypeScript Type-Check
```bash
cd apps/sophia-ai-factory
PATH="/opt/homebrew/bin:$PATH" npm run type-check
```
**Expected Result:** Exit code 0 (0 errors).

### Step 4: Run Layer Architecture Boundary Check
```bash
cd apps/sophia-ai-factory
bash scripts/check-layer-boundaries.sh
```
**Expected Result:**
```
🔍 Checking layer boundaries...
✅ All layer boundaries clean
```

### Invalidation Conditions
- If `roiRatio` evaluates to `Infinity` or `NaN` when `marketing_spend_cents = 0` and `affiliate_revenue_cents > 0` (violates test `B1`).
- If `viral_score` is rounded using floating string concatenation instead of `Number(x.toFixed(2))` (violates test `F1-4`, `F1-5`, `S1`).
- If records from an unrelated organization appear in the aggregate result (violates test `P1`).
- If records outside `[dateRange.start, dateRange.end]` are included (violates test `B5`).
- If any upper layer (`@/forest/*` or `@/land/*`) is imported in `src/tree/bi/metrics-aggregator.ts` or `src/seed/types/executive-bi.ts` (violates layer boundary script).
