/**
 * Unit Tests for Executive BI Metrics Aggregator Service.
 *
 * Covers:
 * 1. Pure calculation functions (calculateRoiRatio, calculateAverageViralScore, isValidDateRange)
 * 2. Empty summary initialization (createEmptyBIMetricsSummary)
 * 3. D1 Aggregations & multi-tenant isolation (aggregateExecutiveBIMetrics)
 * 4. Record mutations & batch operations (recordExecutiveBIMetric, recordExecutiveBIMetricsBatch)
 *
 * @module __tests__/unit/enterprise/metrics-aggregator.test
 */

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
import type { D1Database } from '@/seed/db/client';
import { createRequire } from 'node:module';

const req = createRequire(import.meta.url);
const { DatabaseSync } = req('node:sqlite') as {
  DatabaseSync: new (path: string) => {
    exec(sql: string): void;
    prepare(sql: string): {
      get(...params: unknown[]): unknown;
      all(...params: unknown[]): unknown[];
      run(...params: unknown[]): { lastInsertRowid: bigint; changes: number };
    };
  };
};

describe('Unit Tests: Executive BI Metrics Aggregator Service', () => {
  let db: ReturnType<typeof makeD1>;
  const testOrgId = 'org_unit_test';
  const competitorOrgId = 'org_unit_competitor';
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

  describe('1. Pure Calculation Functions', () => {
    it('calculates ROI ratio with 2 decimal rounding', () => {
      expect(calculateRoiRatio(300000, 100000)).toBe(3.0);
      expect(calculateRoiRatio(357890, 123450)).toBe(2.9);
      expect(calculateRoiRatio(0, 100000)).toBe(0);
    });

    it('returns safe fallback 99.0 when spend is 0 and revenue > 0', () => {
      expect(calculateRoiRatio(50000, 0)).toBe(99.0);
    });

    it('returns 0 when both revenue and spend are 0', () => {
      expect(calculateRoiRatio(0, 0)).toBe(0);
    });

    it('calculates average viral score correctly with 2 decimal rounding', () => {
      expect(calculateAverageViralScore([70, 80, 90, 85, 95])).toBe(84);
      expect(calculateAverageViralScore([92.5, 88.0, 85.5])).toBe(88.67);
      expect(calculateAverageViralScore([87.5])).toBe(87.5);
      expect(calculateAverageViralScore([])).toBe(0);
    });

    it('validates date ranges accurately', () => {
      expect(isValidDateRange({ start: 1000, end: 2000 })).toBe(true);
      expect(isValidDateRange({ start: 2000, end: 1000 })).toBe(false);
      expect(isValidDateRange({ start: NaN, end: 2000 })).toBe(false);
      expect(isValidDateRange({ start: 1000, end: Infinity })).toBe(false);
      expect(isValidDateRange(null as unknown as { start: number; end: number })).toBe(false);
    });

    it('initializes empty summary correctly', () => {
      const empty = createEmptyBIMetricsSummary('org_x', { start: 100, end: 200 });
      expect(empty.orgId).toBe('org_x');
      expect(empty.periodStart).toBe(100);
      expect(empty.periodEnd).toBe(200);
      expect(empty.mrrCents).toBe(0);
      expect(empty.throughputCount).toBe(0);
      expect(empty.viralScore).toBe(0);
      expect(empty.affiliateRevenueCents).toBe(0);
      expect(empty.marketingSpendCents).toBe(0);
      expect(empty.roiRatio).toBe(0);
    });
  });

  describe('2. D1 Aggregations & Multi-Tenant Isolation', () => {
    it('aggregates peak MRR, throughput, viral score, and ROI across multiple records', async () => {
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
        mrrCents: 350000, // Peak MRR
        throughputCount: 75,
        viralScore: 95.0,
        affiliateRevenueCents: 600000,
        marketingSpendCents: 150000,
      });

      const summary = await aggregateExecutiveBIMetrics(db as unknown as D1Database, testOrgId, range);

      expect(summary.orgId).toBe(testOrgId);
      expect(summary.mrrCents).toBe(350000);
      expect(summary.throughputCount).toBe(125);
      expect(summary.viralScore).toBe(90);
      expect(summary.affiliateRevenueCents).toBe(1000000);
      expect(summary.marketingSpendCents).toBe(250000);
      expect(summary.roiRatio).toBe(4.0);
    });

    it('enforces multi-tenant isolation between different organizations', async () => {
      // Org A
      await recordExecutiveBIMetric(db as unknown as D1Database, {
        orgId: testOrgId,
        periodStart: range.start,
        periodEnd: range.end,
        mrrCents: 100000,
        throughputCount: 20,
        viralScore: 80,
        affiliateRevenueCents: 50000,
        marketingSpendCents: 25000,
      });

      // Org B
      await recordExecutiveBIMetric(db as unknown as D1Database, {
        orgId: competitorOrgId,
        periodStart: range.start,
        periodEnd: range.end,
        mrrCents: 900000,
        throughputCount: 800,
        viralScore: 99,
        affiliateRevenueCents: 5000000,
        marketingSpendCents: 500000,
      });

      const summaryA = await aggregateExecutiveBIMetrics(db as unknown as D1Database, testOrgId, range);
      expect(summaryA.throughputCount).toBe(20);
      expect(summaryA.mrrCents).toBe(100000);

      const summaryB = await aggregateExecutiveBIMetrics(db as unknown as D1Database, competitorOrgId, range);
      expect(summaryB.throughputCount).toBe(800);
      expect(summaryB.mrrCents).toBe(900000);
    });

    it('excludes records outside the specified date range window', async () => {
      // Out of bounds: prior month
      await recordExecutiveBIMetric(db as unknown as D1Database, {
        orgId: testOrgId,
        periodStart: range.start - 5000000,
        periodEnd: range.start - 1000,
        mrrCents: 500000,
        throughputCount: 999,
        viralScore: 90,
        affiliateRevenueCents: 100000,
        marketingSpendCents: 50000,
      });

      // Inside window
      await recordExecutiveBIMetric(db as unknown as D1Database, {
        orgId: testOrgId,
        periodStart: range.start + 100,
        periodEnd: range.end - 100,
        mrrCents: 150000,
        throughputCount: 15,
        viralScore: 88,
        affiliateRevenueCents: 45000,
        marketingSpendCents: 15000,
      });

      const summary = await aggregateExecutiveBIMetrics(db as unknown as D1Database, testOrgId, range);
      expect(summary.throughputCount).toBe(15);
      expect(summary.mrrCents).toBe(150000);
    });

    it('returns zeroed summary when no records match date window', async () => {
      const summary = await aggregateExecutiveBIMetrics(
        db as unknown as D1Database,
        testOrgId,
        { start: 1000, end: 2000 },
      );
      expect(summary.throughputCount).toBe(0);
      expect(summary.mrrCents).toBe(0);
      expect(summary.roiRatio).toBe(0);
    });

    it('handles invalid orgId or date range by returning empty summary without crashing', async () => {
      const summaryBadOrg = await aggregateExecutiveBIMetrics(
        db as unknown as D1Database,
        '',
        range,
      );
      expect(summaryBadOrg.throughputCount).toBe(0);

      const summaryBadRange = await aggregateExecutiveBIMetrics(
        db as unknown as D1Database,
        testOrgId,
        { start: 5000, end: 1000 },
      );
      expect(summaryBadRange.throughputCount).toBe(0);
    });
  });

  describe('3. Record Creation & Atomic Batch Operations', () => {
    it('records a single metric snapshot and validates orgId requirement', async () => {
      const rec = await recordExecutiveBIMetric(db as unknown as D1Database, {
        orgId: testOrgId,
        periodStart: range.start,
        periodEnd: range.end,
        mrrCents: 50000,
        throughputCount: 10,
        viralScore: 75,
        affiliateRevenueCents: 100000,
        marketingSpendCents: 20000,
        channel: 'tiktok',
      });

      expect(rec.id).toBeDefined();
      expect(rec.orgId).toBe(testOrgId);
      expect(rec.channel).toBe('tiktok');

      await expect(
        recordExecutiveBIMetric(db as unknown as D1Database, {
          orgId: '',
          periodStart: range.start,
          periodEnd: range.end,
          mrrCents: 10,
          throughputCount: 1,
          viralScore: 10,
          affiliateRevenueCents: 10,
          marketingSpendCents: 10,
        }),
      ).rejects.toThrow(/ORGANIZATION_REQUIRED/);
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
          channel: 'shorts',
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
          channel: 'reels',
        },
      ];

      const res = await recordExecutiveBIMetricsBatch(db as unknown as D1Database, testOrgId, inputs);
      expect(res.count).toBe(2);

      const summary = await aggregateExecutiveBIMetrics(db as unknown as D1Database, testOrgId, range);
      expect(summary.throughputCount).toBe(30);
      expect(summary.mrrCents).toBe(150000);

      // Overloaded signature with only (db, inputs)
      const emptyRes = await recordExecutiveBIMetricsBatch(db as unknown as D1Database, []);
      expect(emptyRes.count).toBe(0);
    });
  });
});
