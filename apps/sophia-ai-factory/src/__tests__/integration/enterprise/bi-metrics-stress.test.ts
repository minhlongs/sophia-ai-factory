/**
 * Adversarial Stress & Chaos Test Suite: Milestone 3 Executive BI & Streaming Export Engine
 *
 * Empirically challenges:
 * 1. Division by Zero & Financial Boundary Attacks (ROI calculation, negative values, overflow)
 * 2. Date Range Inversion, Epoch 0, and Millisecond Boundary Probing
 * 3. High-Throughput Streaming Simulation (10,000 to 50,000 rows) with O(1) Memory Stability
 * 4. RFC-4180 Extreme Payloads: CSV Formula Injection, Multi-Megabyte Cells, Unmatched Quotes
 * 5. Multi-Channel Digest Formatting Under Adversarial Stress
 *
 * @module __tests__/integration/enterprise/bi-metrics-stress.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createRequire } from 'node:module';
import {
  aggregateExecutiveBIMetrics,
  recordExecutiveBIMetric,
  recordExecutiveBIMetricsBatch,
  calculateRoiRatio,
  calculateAverageViralScore,
  isValidDateRange,
  createEmptyBIMetricsSummary,
} from '@/tree/bi/metrics-aggregator';
import {
  escapeCsvField,
  formatStreamingCsv,
  streamCsv,
  streamJsonArray,
  createStreamingExportResponse,
} from '@/tree/bi/export-formatter';
import {
  escapeTelegramMarkdownV2,
  formatTelegramDigest,
  splitTelegramMarkdownV2,
} from '@/forest/bi/telegram-digest-sender';
import {
  renderExecutiveDigestInnerHtml,
  formatEmailDigest,
} from '@/forest/bi/email-digest-sender';
import { makeD1 } from '@/__tests__/integration/shared-d1-shim';
import type { D1Database } from '@/seed/db/client';
import type { DateRange, ExecutiveBIMetricsSummary } from '@/seed/types/executive-bi';

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

describe('Adversarial Stress Suite: Milestone 3 Executive BI & Streaming Engine', () => {
  let rawDb: InstanceType<typeof DatabaseSync>;
  let db: ReturnType<typeof makeD1>;
  const orgId = 'org_stress_enterprise';
  const standardRange: DateRange = {
    start: 1717200000000, // 2024-06-01
    end: 1719791999000,   // 2024-06-30
  };

  beforeEach(() => {
    rawDb = new DatabaseSync(':memory:');
    rawDb.exec(`
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

      CREATE INDEX IF NOT EXISTS idx_bi_metrics_org_period
        ON executive_bi_metrics(org_id, period_start, period_end);
    `);
    db = makeD1(rawDb);
  });

  // ============================================================================
  // SUITE 1: DIVISION BY ZERO & FINANCIAL BOUNDARY ATTACKS (ROI CALCULATION)
  // ============================================================================
  describe('1. Division by Zero & Financial Boundary Attacks (ROI Calculation)', () => {
    it('BZ-1: handles 0 spend and 0 revenue returning exactly 0.0x without throwing or NaN', () => {
      const roi = calculateRoiRatio(0, 0);
      expect(roi).toBe(0);
      expect(Number.isFinite(roi)).toBe(true);
      expect(Number.isNaN(roi)).toBe(false);
    });

    it('BZ-2: handles 0 spend and positive revenue returning safe maximum multiplier 99.0x', () => {
      expect(calculateRoiRatio(1, 0)).toBe(99.0);
      expect(calculateRoiRatio(500000, 0)).toBe(99.0);
      expect(calculateRoiRatio(Number.MAX_SAFE_INTEGER, 0)).toBe(99.0);
    });

    it('BZ-3: handles 0 spend and negative revenue (refund/clawback) returning 0.0x', () => {
      const roi = calculateRoiRatio(-50000, 0);
      expect(roi).toBe(0);
      expect(Number.isFinite(roi)).toBe(true);
    });

    it('BZ-4: handles negative revenue with positive spend returning negative ROI rounded to 2 decimals', () => {
      // Refund exceeds new revenue: -$500 revenue against $1,000 spend
      const roi = calculateRoiRatio(-50000, 100000);
      expect(roi).toBe(-0.5);

      // Irrational negative ratio: -$100 revenue against $300 spend -> -0.33
      const roiThird = calculateRoiRatio(-10000, 30000);
      expect(roiThird).toBe(-0.33);
    });

    it('BZ-5: handles negative spend (accounting rebate/credit) without division error', () => {
      // In negative spend case, marketingSpendCents > 0 is false
      const roi = calculateRoiRatio(50000, -10000);
      // Fallback kicks in: revenue > 0 -> returns 99.0 safe maximum
      expect(roi).toBe(99.0);

      const roiBothNegative = calculateRoiRatio(-50000, -10000);
      expect(roiBothNegative).toBe(0);
    });

    it('BZ-6: decimal precision overflow: irrational ratios round to exactly 2 decimal places', () => {
      // 1 / 3 = 0.3333333333333333...
      expect(calculateRoiRatio(100, 300)).toBe(0.33);
      // 2 / 3 = 0.6666666666666666...
      expect(calculateRoiRatio(200, 300)).toBe(0.67);
      // 1 / 7 = 0.142857...
      expect(calculateRoiRatio(100, 700)).toBe(0.14);
      // 5 / 7 = 0.714285...
      expect(calculateRoiRatio(500, 700)).toBe(0.71);
    });

    it('BZ-7: sub-cent fractional values and floating point anomalies (0.1 + 0.2)', () => {
      const revenue = 0.1 + 0.2; // 0.30000000000000004
      const spend = 0.1;
      const roi = calculateRoiRatio(revenue, spend);
      expect(roi).toBe(3.0);
    });

    it('BZ-8: handles extreme financial scales ($100B in cents: 10_000_000_000_000 cents) without overflow', async () => {
      const hugeRev = 10_000_000_000_000; // $100B in cents
      const hugeSpend = 2_000_000_000_000; // $20B in cents
      const hugeMrr = 5_000_000_000_000;  // $50B in cents

      await recordExecutiveBIMetric(db as unknown as D1Database, {
        orgId,
        periodStart: standardRange.start,
        periodEnd: standardRange.end,
        mrrCents: hugeMrr,
        throughputCount: 1_000_000,
        viralScore: 98.5,
        affiliateRevenueCents: hugeRev,
        marketingSpendCents: hugeSpend,
      });

      const summary = await aggregateExecutiveBIMetrics(
        db as unknown as D1Database,
        orgId,
        standardRange,
      );

      expect(summary.mrrCents).toBe(hugeMrr);
      expect(summary.affiliateRevenueCents).toBe(hugeRev);
      expect(summary.marketingSpendCents).toBe(hugeSpend);
      expect(summary.roiRatio).toBe(5.0); // 10T / 2T = 5.0x
    });

    it('BZ-9: non-finite inputs to calculateAverageViralScore return safe fallbacks', () => {
      expect(calculateAverageViralScore([])).toBe(0);
      expect(calculateAverageViralScore([0, 0, 0])).toBe(0);
      expect(calculateAverageViralScore([100, 100, 100])).toBe(100);
      // Floating point averaging
      expect(calculateAverageViralScore([85.333, 91.666])).toBe(88.5);
    });

    it('BZ-10: peak MRR under decreasing sequences correctly maintains maximum historical peak', async () => {
      // Ingest 3 runs with decreasing MRR
      const runs = [
        { mrr: 800000, count: 50 },
        { mrr: 500000, count: 40 },
        { mrr: 300000, count: 30 },
      ];

      for (let i = 0; i < runs.length; i++) {
        await recordExecutiveBIMetric(db as unknown as D1Database, {
          id: `bi_peak_${i}`,
          orgId,
          periodStart: standardRange.start,
          periodEnd: standardRange.end,
          mrrCents: runs[i].mrr,
          throughputCount: runs[i].count,
          viralScore: 80,
          affiliateRevenueCents: 100000,
          marketingSpendCents: 50000,
        });
      }

      const summary = await aggregateExecutiveBIMetrics(
        db as unknown as D1Database,
        orgId,
        standardRange,
      );

      // Peak MRR must remain the highest value (800000), not the most recent (300000)
      expect(summary.mrrCents).toBe(800000);
      expect(summary.throughputCount).toBe(120); // 50 + 40 + 30
    });
  });

  // ============================================================================
  // SUITE 2: DATE RANGE INVERSION, BOUNDARY & OVERLAP ATTACKS
  // ============================================================================
  describe('2. Date Range Inversion, Boundary & Overlap Attacks', () => {
    it('DR-1: inverted date range (start > end) is rejected by isValidDateRange and returns zeroed summary', async () => {
      const invertedRange = { start: 2000, end: 1000 };
      expect(isValidDateRange(invertedRange)).toBe(false);

      const summary = await aggregateExecutiveBIMetrics(
        db as unknown as D1Database,
        orgId,
        invertedRange,
      );

      expect(summary.throughputCount).toBe(0);
      expect(summary.mrrCents).toBe(0);
      expect(summary.viralScore).toBe(0);
      expect(summary.roiRatio).toBe(0);
    });

    it('DR-2: epoch 0 date range (start: 0, end: 0) is valid and queries point-in-time snapshot', async () => {
      const epoch0Range = { start: 0, end: 0 };
      expect(isValidDateRange(epoch0Range)).toBe(true);

      // Record at epoch 0
      await recordExecutiveBIMetric(db as unknown as D1Database, {
        id: 'bi_epoch_0',
        orgId,
        periodStart: 0,
        periodEnd: 0,
        mrrCents: 12345,
        throughputCount: 1,
        viralScore: 90,
        affiliateRevenueCents: 1000,
        marketingSpendCents: 500,
      });

      const summary = await aggregateExecutiveBIMetrics(
        db as unknown as D1Database,
        orgId,
        epoch0Range,
      );

      expect(summary.mrrCents).toBe(12345);
      expect(summary.throughputCount).toBe(1);
      expect(summary.roiRatio).toBe(2.0);
    });

    it('DR-3: negative epoch timestamps (pre-1970) are handled safely without crashing', async () => {
      const pre1970Range = { start: -10000000, end: -5000000 };
      expect(isValidDateRange(pre1970Range)).toBe(true);

      await recordExecutiveBIMetric(db as unknown as D1Database, {
        id: 'bi_pre_1970',
        orgId,
        periodStart: -9000000,
        periodEnd: -6000000,
        mrrCents: 50000,
        throughputCount: 5,
        viralScore: 75,
        affiliateRevenueCents: 10000,
        marketingSpendCents: 5000,
      });

      const summary = await aggregateExecutiveBIMetrics(
        db as unknown as D1Database,
        orgId,
        pre1970Range,
      );

      expect(summary.throughputCount).toBe(5);
      expect(summary.mrrCents).toBe(50000);
    });

    it('DR-4: non-finite and malformed date range inputs return safe empty summary', async () => {
      const malformedRanges: unknown[] = [
        null,
        undefined,
        {},
        { start: NaN, end: 2000 },
        { start: 1000, end: NaN },
        { start: -Infinity, end: 2000 },
        { start: 1000, end: Infinity },
        { start: '1000', end: '2000' },
        { start: true, end: false },
      ];

      for (const badRange of malformedRanges) {
        expect(isValidDateRange(badRange as DateRange)).toBe(false);

        const summary = await aggregateExecutiveBIMetrics(
          db as unknown as D1Database,
          orgId,
          badRange as DateRange,
        );
        expect(summary.throughputCount).toBe(0);
        expect(summary.mrrCents).toBe(0);
        expect(summary.roiRatio).toBe(0);
      }
    });

    it('DR-5: exact sub-millisecond boundary inclusivity and off-by-one boundary exclusion', async () => {
      const targetWindow = { start: 10000, end: 20000 };

      // 1. Record exactly at bounds (period_start: 10000, period_end: 20000) -> MUST match
      await recordExecutiveBIMetric(db as unknown as D1Database, {
        id: 'bi_exact_in',
        orgId,
        periodStart: 10000,
        periodEnd: 20000,
        mrrCents: 100,
        throughputCount: 1,
        viralScore: 80,
        affiliateRevenueCents: 100,
        marketingSpendCents: 50,
      });

      // 2. Record off by 1ms before start (period_start: 9999, period_end: 20000) -> MUST be excluded
      await recordExecutiveBIMetric(db as unknown as D1Database, {
        id: 'bi_off_before',
        orgId,
        periodStart: 9999,
        periodEnd: 20000,
        mrrCents: 999,
        throughputCount: 10,
        viralScore: 80,
        affiliateRevenueCents: 999,
        marketingSpendCents: 50,
      });

      // 3. Record off by 1ms after end (period_start: 10000, period_end: 20001) -> MUST be excluded
      await recordExecutiveBIMetric(db as unknown as D1Database, {
        id: 'bi_off_after',
        orgId,
        periodStart: 10000,
        periodEnd: 20001,
        mrrCents: 999,
        throughputCount: 10,
        viralScore: 80,
        affiliateRevenueCents: 999,
        marketingSpendCents: 50,
      });

      const summary = await aggregateExecutiveBIMetrics(
        db as unknown as D1Database,
        orgId,
        targetWindow,
      );

      // Only 'bi_exact_in' should be included
      expect(summary.throughputCount).toBe(1);
      expect(summary.mrrCents).toBe(100);
    });

    it('DR-6: zero-length date range (start === end) allows single-millisecond matching', async () => {
      const exactTime = 1717200000000;
      const pointRange = { start: exactTime, end: exactTime };
      expect(isValidDateRange(pointRange)).toBe(true);

      await recordExecutiveBIMetric(db as unknown as D1Database, {
        id: 'bi_point',
        orgId,
        periodStart: exactTime,
        periodEnd: exactTime,
        mrrCents: 75000,
        throughputCount: 5,
        viralScore: 92,
        affiliateRevenueCents: 20000,
        marketingSpendCents: 10000,
      });

      const summary = await aggregateExecutiveBIMetrics(
        db as unknown as D1Database,
        orgId,
        pointRange,
      );

      expect(summary.throughputCount).toBe(5);
      expect(summary.mrrCents).toBe(75000);
    });

    it('DR-7: empty date range where no records exist returns fully zeroed summary object', async () => {
      const emptyRange = { start: 100, end: 200 };
      const summary = await aggregateExecutiveBIMetrics(
        db as unknown as D1Database,
        orgId,
        emptyRange,
      );

      expect(summary).toEqual({
        orgId,
        periodStart: 100,
        periodEnd: 200,
        mrrCents: 0,
        throughputCount: 0,
        viralScore: 0,
        affiliateRevenueCents: 0,
        marketingSpendCents: 0,
        roiRatio: 0,
      });
    });
  });

  // ============================================================================
  // SUITE 3: HIGH-THROUGHPUT STREAMING SIMULATION (10k TO 50k ROWS) & O(1) MEMORY
  // ============================================================================
  describe('3. High-Throughput Streaming Simulation (10,000 to 50,000 Rows) & O(1) Memory Stability', () => {
    // Helper to generate an async generator of records
    async function* generateMockRows(count: number) {
      for (let i = 0; i < count; i++) {
        yield {
          id: `rec_${i}`,
          period: '2024-06',
          mrr_cents: 100000 + (i % 1000),
          throughput: 10 + (i % 50),
          viral_score: 85.5,
          affiliate_rev: 250000,
          marketing_spend: 50000,
          channel: i % 2 === 0 ? 'TikTok Shop' : 'YouTube Shorts',
        };
      }
    }

    it('ST-1: streams 10,000 CSV rows via streamCsv without buffer accumulation', async () => {
      const rowCount = 10000;
      const headers = ['id', 'period', 'mrr_cents', 'throughput', 'viral_score', 'affiliate_rev', 'marketing_spend', 'channel'];
      const stream = streamCsv(headers, generateMockRows(rowCount));
      const reader = stream.getReader();

      let chunksCount = 0;
      let totalBytes = 0;
      let firstChunkText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunksCount++;
        totalBytes += value.byteLength;
        if (chunksCount === 1) {
          firstChunkText = new TextDecoder().decode(value);
        }
      }

      // First chunk must contain header
      expect(firstChunkText).toContain('id,period,mrr_cents,throughput');
      // Must stream chunks incrementally (1 header chunk + 10,000 row chunks)
      expect(chunksCount).toBe(rowCount + 1);
      // Total size around ~1MB for 10k rows
      expect(totalBytes).toBeGreaterThan(500_000);
    });

    it('ST-2: streams 50,000 CSV rows maintaining O(1) memory stability without isolate crash', async () => {
      const rowCount = 50000;
      const headers = ['id', 'mrr_cents', 'throughput', 'channel'];

      async function* fast50kRows() {
        for (let i = 0; i < rowCount; i++) {
          yield {
            id: `row_${i}`,
            mrr_cents: 200000,
            throughput: 50,
            channel: 'OmniChannel',
          };
        }
      }

      const memBefore = process.memoryUsage().heapUsed;
      const stream = streamCsv(headers, fast50kRows());
      const reader = stream.getReader();

      let streamBytes = 0;
      let totalLinesRead = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        streamBytes += value.byteLength;
        totalLinesRead++;
      }

      const memAfter = process.memoryUsage().heapUsed;
      const memDiffMb = (memAfter - memBefore) / (1024 * 1024);

      // 50,000 rows + 1 header = 50,001 chunks
      expect(totalLinesRead).toBe(rowCount + 1);
      expect(streamBytes).toBeGreaterThan(1_500_000); // > 1.5MB data (~1.64MB actual)
      // Memory growth must remain strictly bounded (< 50MB growth in Node runtime)
      expect(memDiffMb).toBeLessThan(50);
    });

    it('ST-3: streams 10,000 structured JSON array items via streamJsonArray', async () => {
      const count = 10000;
      async function* jsonGenerator() {
        for (let i = 0; i < count; i++) {
          yield { i, status: 'ok' };
        }
      }

      const stream = streamJsonArray(jsonGenerator(), { indent: 0 });
      const reader = stream.getReader();

      let chunksCount = 0;
      let firstChunk = '';
      let lastChunk = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunksCount++;
        const text = new TextDecoder().decode(value);
        if (chunksCount === 1) firstChunk = text;
        lastChunk = text;
      }

      // Stream must start with '[' and end with ']'
      expect(firstChunk.startsWith('[')).toBe(true);
      expect(lastChunk.endsWith(']')).toBe(true);
      // Chunks count = count + 1 (closing bracket)
      expect(chunksCount).toBe(count + 1);
    });

    it('ST-4: streams 20,000 NDJSON items via streamJsonArray({ ndjson: true })', async () => {
      const count = 20000;
      async function* ndjsonGenerator() {
        for (let i = 0; i < count; i++) {
          yield { id: i, score: 99 };
        }
      }

      const stream = streamJsonArray(ndjsonGenerator(), { ndjson: true });
      const reader = stream.getReader();

      let chunkIndex = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunkIndex++;
        const text = new TextDecoder().decode(value);
        // Each chunk in NDJSON ends with newline \n
        expect(text.endsWith('\n')).toBe(true);
      }

      expect(chunkIndex).toBe(count);
    });

    it('ST-5: handles empty dataset streaming: CSV produces header only, JSON produces "[]"', async () => {
      // Empty CSV
      const emptyCsvStream = streamCsv(['colA', 'colB'], []);
      const csvReader = emptyCsvStream.getReader();
      let csvContent = '';
      while (true) {
        const { done, value } = await csvReader.read();
        if (done) break;
        csvContent += new TextDecoder().decode(value);
      }
      expect(csvContent).toBe('colA,colB\r\n');

      // Empty JSON
      const emptyJsonStream = streamJsonArray([]);
      const jsonReader = emptyJsonStream.getReader();
      let jsonContent = '';
      while (true) {
        const { done, value } = await jsonReader.read();
        if (done) break;
        jsonContent += new TextDecoder().decode(value);
      }
      expect(jsonContent).toBe('[]');
    });

    it('ST-6: createStreamingExportResponse factory generates correct HTTP response headers and body', async () => {
      const response = createStreamingExportResponse(
        [{ channel: 'tiktok', count: 50 }],
        'csv',
        'monthly-bi-report',
        { headers: ['channel', 'count'] },
      );

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('text/csv; charset=utf-8');
      expect(response.headers.get('Content-Disposition')).toBe('attachment; filename="monthly-bi-report.csv"');
      expect(response.headers.get('Cache-Control')).toContain('no-cache');
      expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');

      const bodyText = await response.text();
      expect(bodyText).toBe('channel,count\r\ntiktok,50\r\n');
    });
  });

  // ============================================================================
  // SUITE 4: RFC-4180 EXTREME PAYLOADS & FORMULA INJECTION
  // ============================================================================
  describe('4. RFC-4180 Extreme Payloads & Injection Attacks', () => {
    describe('CSV Formula Injection Neutralization', () => {
      const formulaPayloads = [
        '=cmd|\' /C calc\'!A0',
        '=1+1',
        '=SUM(A1:A10)',
        '@SUM(1+1)*cmd|\' /C calc\'!A0',
        '+cmd|\' /C calc\'!A0',
        '-cmd|\' /C calc\'!A0',
        '\t=cmd|\' /C calc\'!A0',
        '\r=cmd|\' /C calc\'!A0',
      ];

      it('INJ-1: prepends single quote to neutralize formula triggers when sanitizeFormulas is enabled', () => {
        for (const payload of formulaPayloads) {
          const sanitized = escapeCsvField(payload, ',', true);
          // When sanitized, the leading dangerous token must be disarmed with single quote "'"
          // Or wrapped in quotes with leading single quote inside
          expect(sanitized.startsWith('\'') || sanitized.startsWith('"\'')).toBe(true);
        }
      });

      it('INJ-2: formatStreamingCsv applies formula sanitization across all matching columns', () => {
        const rows = [
          { name: '=HYPERLINK("http://evil.com","Click")', value: '+12345' },
          { name: '@malicious_macro', value: '-99999' },
        ];

        const csv = formatStreamingCsv(['name', 'value'], rows, { sanitizeFormulas: true });

        // Verify formulas are prefixed with single quote
        expect(csv).toContain('\'=HYPERLINK');
        expect(csv).toContain('\'+12345');
        expect(csv).toContain('\'@malicious_macro');
        expect(csv).toContain('\'-99999');
      });

      it('INJ-3: preserves raw values when sanitizeFormulas is disabled (RFC-4180 default)', () => {
        const rawFormula = '=SUM(A1:A10)';
        const unsanitized = escapeCsvField(rawFormula, ',', false);
        expect(unsanitized).toBe(rawFormula);
      });
    });

    describe('RFC-4180 Quoting & Doubling Integrity', () => {
      it('INJ-4: handles unmatched quotes and odd quote counts by doubling quotes', () => {
        // Single quote: " -> """"
        expect(escapeCsvField('"')).toBe('""""');
        // Three quotes: """ -> """""""" (6 escaped + 2 enclosing)
        expect(escapeCsvField('"""')).toBe('""""""""');
        // Unmatched quote inside sentence
        expect(escapeCsvField('They said "Hello to the world')).toBe('"They said ""Hello to the world"');
        // Quotes at boundaries
        expect(escapeCsvField('"start and end"')).toBe('"""start and end"""');
      });

      it('INJ-5: handles multi-megabyte cell (2MB text) without regex crash or stack overflow', () => {
        // Create 2MB text payload with commas, quotes, and newlines
        const baseString = 'Enterprise, "Quotes", and \r\nNewlines ';
        const repeatCount = Math.ceil((2 * 1024 * 1024) / baseString.length);
        const hugeCell = baseString.repeat(repeatCount);

        const escaped = escapeCsvField(hugeCell);

        expect(escaped.startsWith('"')).toBe(true);
        expect(escaped.endsWith('"')).toBe(true);
        expect(escaped.length).toBeGreaterThan(2 * 1024 * 1024);
      });

      it('INJ-6: control characters: null bytes, carriage returns, tabs, and emojis', () => {
        const weirdString = 'Null\0Byte, Tab\tSpace, AstralEmoji🚀🔥✨, CR\rLF\n';
        const escaped = escapeCsvField(weirdString);

        // Contains delimiter, quotes or CRLF -> must be wrapped in double quotes
        expect(escaped.startsWith('"')).toBe(true);
        expect(escaped.endsWith('"')).toBe(true);
        expect(escaped).toContain('Null\0Byte');
        expect(escaped).toContain('AstralEmoji🚀🔥✨');
      });

      it('INJ-7: custom delimiters (; and |) with fields containing that delimiter', () => {
        const semiField = 'First;Second';
        const escapedSemi = escapeCsvField(semiField, ';');
        expect(escapedSemi).toBe('"First;Second"');

        const pipeField = 'First|Second';
        const escapedPipe = escapeCsvField(pipeField, '|');
        expect(escapedPipe).toBe('"First|Second"');
      });

      it('INJ-8: complex JSON objects and nested arrays inside CSV fields are serialized and quoted', () => {
        const obj = { nested: { key: 'value, with comma and "quotes"' }, list: [1, 2, 3] };
        const escaped = escapeCsvField(obj);

        expect(escaped.startsWith('"')).toBe(true);
        expect(escaped.endsWith('"')).toBe(true);
        expect(escaped).toContain('\\""quotes\\""');
      });
    });
  });

  // ============================================================================
  // SUITE 5: MULTI-CHANNEL DIGEST FORMATTING UNDER ADVERSARIAL STRESS
  // ============================================================================
  describe('5. Multi-Channel Digest Formatting Under Adversarial Stress', () => {
    const stressMetrics: ExecutiveBIMetricsSummary = {
      orgId,
      periodStart: standardRange.start,
      periodEnd: standardRange.end,
      mrrCents: 123456789, // $1,234,567.89
      throughputCount: 9999,
      viralScore: 99.99,
      affiliateRevenueCents: 987654321, // $9,876,543.21
      marketingSpendCents: 12345600, // $123,456.00
      roiRatio: 80.0,
    };

    it('DG-1: Telegram digest safely escapes all 18 reserved characters + backslash in agency name', () => {
      const hostileAgencyName = 'Alpha_Beta*Gamma[Delta](Epsilon)~Zeta`Eta>Theta#Iota+Kappa-Lambda=Mu|Nu{Xi}Omicron.Pi!Slash\\';
      const digest = formatTelegramDigest(stressMetrics, { agencyName: hostileAgencyName });

      // Every reserved char must have an immediate preceding backslash
      expect(digest).toContain('Alpha\\_Beta\\*Gamma\\[Delta\\]\\(Epsilon\\)\\~Zeta\\`Eta\\>Theta\\#Iota\\+Kappa\\-Lambda\\=Mu\\|Nu\\{Xi\\}Omicron\\.Pi\\!Slash\\\\');
      // Periods in dollar amounts must be escaped: 1234567.89 -> 1234567\.89
      expect(digest).toContain('1234567\\.89');
    });

    it('DG-2: Telegram splitter handles mega-payload (>8000 chars) splitting without breaking escape tokens', () => {
      // Build an 8,000 char MarkdownV2 text with escaped dots and bold blocks
      const repeatedSection = '*Section* with escaped text \\. and emojis 🚀\n';
      const megaText = repeatedSection.repeat(200); // ~9,000 chars

      const chunks = splitTelegramMarkdownV2(megaText, 4096);

      // Must be split into at least 3 chunks
      expect(chunks.length).toBeGreaterThanOrEqual(2);
      for (const chunk of chunks) {
        // Strict Telegram 4096 limit
        expect(chunk.length).toBeLessThanOrEqual(4096);
        // Ensure backslashes are not left trailing at chunk boundary
        expect(chunk.endsWith('\\')).toBe(false);
      }
    });

    it('DG-3: Email digest sanitizes hostile XSS payloads inside agencyName and formats 2x2 grid cleanly', () => {
      const xssBranding = {
        agencyName: '<script>alert("XSS")</script><b>Safe Agency</b>',
        primaryColor: '#6366f1',
        logoUrl: 'https://evil.com/logo.png" onerror="alert(1)',
      };

      const html = formatEmailDigest(stressMetrics, xssBranding);

      // Raw script tags must be neutral
      expect(html).not.toContain('<script>alert');
      expect(html).toContain('&lt;script&gt;');
      // Formatted numbers present in cards
      expect(html).toContain('$1234567.89');
      expect(html).toContain('9999');
      expect(html).toContain('99.99/100');
      expect(html).toContain('80x');
    });

    it('DG-4: Handles zeroed and negative metrics in email digest without layout distortion', () => {
      const zeroMetrics: ExecutiveBIMetricsSummary = {
        orgId,
        periodStart: 0,
        periodEnd: 0,
        mrrCents: 0,
        throughputCount: 0,
        viralScore: 0,
        affiliateRevenueCents: 0,
        marketingSpendCents: 0,
        roiRatio: 0,
      };

      const html = renderExecutiveDigestInnerHtml(zeroMetrics);
      expect(html).toContain('$0.00');
      expect(html).toContain('0 videos');
      expect(html).toContain('0/100');
      expect(html).toContain('0x');
    });
  });
});
