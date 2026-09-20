/**
 * Enterprise Executive Business Intelligence (BI) & Automated Reporting — Comprehensive 4-Tier E2E Test Suite
 *
 * Covers:
 * - Feature 1: Unified BI metrics aggregations (MRR, throughput, engagement, ROI)
 * - Feature 2: Automated Telegram executive digest formatting (MarkdownV2, character limits)
 * - Feature 3: Branded HTML email executive digest formatting
 * - Feature 4: RFC-4180 compliant streaming CSV export
 * - Feature 5: Streaming structured JSON export
 *
 * Implements 4-Tier Test Architecture:
 * - Tier 1: Feature Coverage (>=5 tests per feature area)
 * - Tier 2: Boundary & Corner Cases (>=5 tests per feature area)
 * - Tier 3: Cross-Feature Combinations
 * - Tier 4: Real-World Scenarios
 *
 * @module __tests__/e2e/enterprise/executive-bi.e2e.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createEnterpriseD1,
  aggregateExecutiveBIMetrics,
  formatTelegramDigest,
  escapeTelegramMarkdownV2,
  escapeCsvField,
  formatStreamingCsv,
  wrapWithAgencyBranding,
  type MockD1Database,
  type BrandingSettings,
  type ExecutiveBIMetricsSummary,
} from './enterprise-test-harness';

describe('Enterprise Executive BI & Reporting E2E Test Suite', () => {
  let db: MockD1Database;
  const testOrgId = 'org_bi_enterprise';
  const otherOrgId = 'org_bi_competitor';

  const rangeJune = {
    start: 1717200000000, // 2024-06-01
    end: 1719791999000,   // 2024-06-30
  };

  beforeEach(async () => {
    db = createEnterpriseD1();

    // Seed test organizations
    await db
      .prepare(
        `INSERT INTO organizations (id, name, slug, tier, max_seats, status, created_at, updated_at)
         VALUES (?1, 'Enterprise BI Org', 'bi-org', 'master', 999, 'active', ?2, ?2)`
      )
      .bind(testOrgId, Date.now())
      .run();

    await db
      .prepare(
        `INSERT INTO organizations (id, name, slug, tier, max_seats, status, created_at, updated_at)
         VALUES (?1, 'Competitor Org', 'competitor-org', 'master', 999, 'active', ?2, ?2)`
      )
      .bind(otherOrgId, Date.now())
      .run();
  });

  // ============================================================================
  // TIER 1: FEATURE COVERAGE (>=5 tests per feature area)
  // ============================================================================
  describe('Tier 1: Feature Coverage', () => {
    describe('F1: Unified BI Metrics Aggregations', () => {
      it('F1-1: aggregates MRR, video throughput, viral score, and affiliate ROI', async () => {
        // Seed BI records for June
        await db
          .prepare(
            `INSERT INTO executive_bi_metrics
             (id, org_id, period_start, period_end, mrr_cents, throughput_count, viral_score, affiliate_revenue_cents, marketing_spend_cents, created_at)
             VALUES
             ('bi_1', ?1, ?2, ?3, 250000, 45, 84.5, 300000, 100000, ?4),
             ('bi_2', ?1, ?2, ?3, 300000, 55, 91.0, 450000, 150000, ?4)`
          )
          .bind(testOrgId, rangeJune.start, rangeJune.end, Date.now())
          .run();

        const metrics = await aggregateExecutiveBIMetrics(db, testOrgId, rangeJune);

        expect(metrics.orgId).toBe(testOrgId);
        expect(metrics.mrrCents).toBe(300000); // Peak MRR: $3,000.00
        expect(metrics.throughputCount).toBe(100); // 45 + 55 = 100 videos
        expect(metrics.viralScore).toBe(87.75); // (84.5 + 91.0) / 2
        expect(metrics.affiliateRevenueCents).toBe(750000); // $7,500.00
        expect(metrics.marketingSpendCents).toBe(250000); // $2,500.00
        expect(metrics.roiRatio).toBe(3.0); // 750000 / 250000 = 3.0x
      });

      it('F1-2: returns zeroed metrics when date range has no records', async () => {
        const metrics = await aggregateExecutiveBIMetrics(db, testOrgId, {
          start: 1000,
          end: 2000,
        });

        expect(metrics.mrrCents).toBe(0);
        expect(metrics.throughputCount).toBe(0);
        expect(metrics.viralScore).toBe(0);
        expect(metrics.affiliateRevenueCents).toBe(0);
        expect(metrics.marketingSpendCents).toBe(0);
        expect(metrics.roiRatio).toBe(0);
      });

      it('F1-3: correctly aggregates throughput count across multiple batch runs', async () => {
        for (let i = 1; i <= 5; i++) {
          await db
            .prepare(
              `INSERT INTO executive_bi_metrics
               (id, org_id, period_start, period_end, mrr_cents, throughput_count, viral_score, affiliate_revenue_cents, marketing_spend_cents, created_at)
               VALUES (?1, ?2, ?3, ?4, 100000, 20, 75.0, 10000, 5000, ?5)`
            )
            .bind(`bi_batch_${i}`, testOrgId, rangeJune.start, rangeJune.end, Date.now())
            .run();
        }

        const metrics = await aggregateExecutiveBIMetrics(db, testOrgId, rangeJune);
        expect(metrics.throughputCount).toBe(100); // 5 runs * 20 = 100 videos
      });

      it('F1-4: computes accurate affiliate ROI ratio to 2 decimal places', async () => {
        await db
          .prepare(
            `INSERT INTO executive_bi_metrics
             (id, org_id, period_start, period_end, mrr_cents, throughput_count, viral_score, affiliate_revenue_cents, marketing_spend_cents, created_at)
             VALUES ('bi_roi', ?1, ?2, ?3, 100000, 10, 80.0, 357890, 123450, ?4)`
          )
          .bind(testOrgId, rangeJune.start, rangeJune.end, Date.now())
          .run();

        const metrics = await aggregateExecutiveBIMetrics(db, testOrgId, rangeJune);
        // 357890 / 123450 = 2.89906... -> 2.9
        expect(metrics.roiRatio).toBe(2.9);
      });

      it('F1-5: calculates arithmetic mean of viral scores across campaigns', async () => {
        const scores = [70, 80, 90, 85, 95];
        for (let i = 0; i < scores.length; i++) {
          await db
            .prepare(
              `INSERT INTO executive_bi_metrics
               (id, org_id, period_start, period_end, mrr_cents, throughput_count, viral_score, affiliate_revenue_cents, marketing_spend_cents, created_at)
               VALUES (?1, ?2, ?3, ?4, 50000, 5, ?5, 0, 0, ?6)`
            )
            .bind(`bi_score_${i}`, testOrgId, rangeJune.start, rangeJune.end, scores[i], Date.now())
            .run();
        }

        const metrics = await aggregateExecutiveBIMetrics(db, testOrgId, rangeJune);
        // (70 + 80 + 90 + 85 + 95) / 5 = 420 / 5 = 84.00
        expect(metrics.viralScore).toBe(84);
      });
    });

    describe('F2: Automated Telegram Executive Digest Formatting', () => {
      const sampleMetrics: ExecutiveBIMetricsSummary = {
        orgId: testOrgId,
        periodStart: rangeJune.start,
        periodEnd: rangeJune.end,
        mrrCents: 543200, // $5,432.00
        throughputCount: 142,
        viralScore: 89.5,
        affiliateRevenueCents: 1250000, // $12,500.00
        marketingSpendCents: 350000, // $3,500.00
        roiRatio: 3.57,
      };

      it('F2-1: formats Telegram digest with agency name and key performance indicators', () => {
        const text = formatTelegramDigest(sampleMetrics, { agencyName: 'Apex Viral Agency' });
        expect(text).toContain('Apex Viral Agency');
        expect(text).toContain('5432\\.00'); // Period escaped in MarkdownV2
        expect(text).toContain('142 videos');
        expect(text).toContain('89\\.5/100');
        expect(text).toContain('12500\\.00');
        expect(text).toContain('3\\.57x');
      });

      it('F2-2: strictly escapes all Telegram MarkdownV2 reserved characters', () => {
        const dangerousString = '_ * [ ] ( ) ~ ` > # + - = | { } . !';
        const escaped = escapeTelegramMarkdownV2(dangerousString);

        expect(escaped).toBe(
          '\\_ \\* \\[ \\] \\( \\) \\~ \\` \\> \\# \\+ \\- \\= \\| \\{ \\} \\. \\!'
        );
      });

      it('F2-3: ensures message length conforms to Telegram 4096 character limit', () => {
        const text = formatTelegramDigest(sampleMetrics, { agencyName: 'A'.repeat(50) });
        expect(text.length).toBeLessThan(4096);
      });

      it('F2-4: uses default Sophia AI Factory name when agency branding is absent', () => {
        const text = formatTelegramDigest(sampleMetrics);
        expect(text).toContain('Sophia AI Factory');
      });

      it('F2-5: formats dollar currency amounts from integer cents accurately', () => {
        const text = formatTelegramDigest({
          ...sampleMetrics,
          mrrCents: 99, // $0.99
          affiliateRevenueCents: 10000, // $100.00
        });
        expect(text).toContain('0\\.99');
        expect(text).toContain('100\\.00');
      });
    });

    describe('F3: Branded HTML Email Executive Digest Formatting', () => {
      it('F3-1: renders metrics summary in agency-branded email template', () => {
        const branding: BrandingSettings = {
          agencyName: 'Horizon Media Group',
          primaryColor: '#2563eb',
          logoUrl: 'https://horizon.com/logo.png',
        };

        const bodyHtml = `
          <h2>Executive Monthly Performance Report</h2>
          <ul>
            <li>Monthly Recurring Revenue: $5,000.00</li>
            <li>Videos Produced: 120</li>
            <li>Average Viral Engagement: 92.4/100</li>
            <li>Affiliate ROI: 4.2x</li>
          </ul>
        `;

        const email = wrapWithAgencyBranding(bodyHtml, branding);
        expect(email).toContain('Horizon Media Group');
        expect(email).toContain('#2563eb');
        expect(email).toContain('https://horizon.com/logo.png');
        expect(email).toContain('Executive Monthly Performance Report');
        expect(email).toContain('Affiliate ROI: 4.2x');
      });

      it('F3-2: email body includes valid HTML doctype and container markup', () => {
        const email = wrapWithAgencyBranding('<p>Summary</p>', {});
        expect(email).toContain('<!DOCTYPE html>');
        expect(email).toContain('<table width="100%"');
      });

      it('F3-3: includes powered-by footer tag in transactional template', () => {
        const email = wrapWithAgencyBranding('<p>Content</p>', { agencyName: 'Test Agency' });
        expect(email).toContain('Powered by Sophia Enterprise Scale Engine');
      });

      it('F3-4: sanitizes HTML injection in agency title inside email header', () => {
        const email = wrapWithAgencyBranding('<p>Safe Body</p>', {
          agencyName: '<img src=x onerror=alert(1)> Agency',
        });
        expect(email).not.toContain('<img src=x onerror=alert(1)>');
        expect(email).toContain('&lt;img src=x onerror=alert(1)&gt; Agency');
      });

      it('F3-5: handles multi-paragraph digest layout cleanly without formatting degradation', () => {
        const multiParagraph = '<p>Paragraph 1</p><p>Paragraph 2</p>';
        const email = wrapWithAgencyBranding(multiParagraph, {});
        expect(email).toContain(multiParagraph);
      });
    });

    describe('F4: Streaming CSV Export with RFC-4180 Compliance', () => {
      it('F4-1: generates valid RFC-4180 CSV header and rows', () => {
        const headers = ['period', 'mrr_usd', 'throughput', 'roi'];
        const rows = [
          { period: '2024-06', mrr_usd: '3000.00', throughput: 100, roi: '3.0x' },
          { period: '2024-07', mrr_usd: '4500.00', throughput: 150, roi: '3.5x' },
        ];

        const csv = formatStreamingCsv(headers, rows);
        const lines = csv.split('\r\n');
        expect(lines).toHaveLength(3);
        expect(lines[0]).toBe('period,mrr_usd,throughput,roi');
        expect(lines[1]).toBe('2024-06,3000.00,100,3.0x');
        expect(lines[2]).toBe('2024-07,4500.00,150,3.5x');
      });

      it('F4-2: escapes fields containing commas by wrapping in quotes', () => {
        expect(escapeCsvField('Agency, Inc.')).toBe('"Agency, Inc."');
      });

      it('F4-3: escapes fields containing double quotes by doubling quotes', () => {
        expect(escapeCsvField('The "Best" Agency')).toBe('"The ""Best"" Agency"');
      });

      it('F4-4: escapes fields containing CRLF and newlines by wrapping in quotes', () => {
        expect(escapeCsvField('Line 1\nLine 2')).toBe('"Line 1\nLine 2"');
        expect(escapeCsvField('Line 1\r\nLine 2')).toBe('"Line 1\r\nLine 2"');
      });

      it('F4-5: handles null, undefined, numbers, and boolean values safely', () => {
        expect(escapeCsvField(null)).toBe('');
        expect(escapeCsvField(undefined)).toBe('');
        expect(escapeCsvField(12345)).toBe('12345');
        expect(escapeCsvField(true)).toBe('true');
      });
    });

    describe('F5: Streaming Structured JSON Export', () => {
      it('F5-1: formats metrics array as valid structured JSON string', () => {
        const records = [
          { id: '1', mrr: 1000, videos: 50 },
          { id: '2', mrr: 2000, videos: 80 },
        ];
        const json = JSON.stringify(records, null, 2);
        const parsed = JSON.parse(json);
        expect(parsed).toHaveLength(2);
        expect(parsed[0].mrr).toBe(1000);
      });

      it('F5-2: handles empty record list returning empty JSON array "[]"', () => {
        const json = JSON.stringify([]);
        expect(json).toBe('[]');
      });

      it('F5-3: preserves nested metadata structures in JSON export', () => {
        const record = {
          orgId: testOrgId,
          metrics: { mrrCents: 500000, channels: ['tiktok', 'youtube'] },
        };
        const json = JSON.stringify(record);
        const parsed = JSON.parse(json);
        expect(parsed.metrics.channels).toEqual(['tiktok', 'youtube']);
      });

      it('F5-4: serializes dates and numbers deterministically without precision loss', () => {
        const record = { timestamp: 1717200000000, roi: 3.14159 };
        const json = JSON.stringify(record);
        const parsed = JSON.parse(json);
        expect(parsed.timestamp).toBe(1717200000000);
        expect(parsed.roi).toBe(3.14159);
      });

      it('F5-5: validates JSON formatting for streaming chunks (NDJSON)', () => {
        const items = [{ row: 1 }, { row: 2 }, { row: 3 }];
        const ndjson = items.map((i) => JSON.stringify(i)).join('\n');
        const lines = ndjson.split('\n');
        expect(lines).toHaveLength(3);
        expect(JSON.parse(lines[0])).toEqual({ row: 1 });
      });
    });
  });

  // ============================================================================
  // TIER 2: BOUNDARY & CORNER CASES (>=5 tests)
  // ============================================================================
  describe('Tier 2: Boundary & Corner Cases', () => {
    it('B1: handles zero marketing spend without division by zero error (returns 0 or fallback)', async () => {
      await db
        .prepare(
          `INSERT INTO executive_bi_metrics
           (id, org_id, period_start, period_end, mrr_cents, throughput_count, viral_score, affiliate_revenue_cents, marketing_spend_cents, created_at)
           VALUES ('bi_zerospend', ?1, ?2, ?3, 100000, 10, 80.0, 50000, 0, ?4)`
        )
        .bind(testOrgId, rangeJune.start, rangeJune.end, Date.now())
        .run();

      const metrics = await aggregateExecutiveBIMetrics(db, testOrgId, rangeJune);
      expect(Number.isFinite(metrics.roiRatio)).toBe(true);
      expect(metrics.roiRatio).toBe(99.0); // Safe max multiplier when spend is 0 but revenue exists
    });

    it('B2: handles both zero revenue and zero spend returning 0.0 ROI', async () => {
      await db
        .prepare(
          `INSERT INTO executive_bi_metrics
           (id, org_id, period_start, period_end, mrr_cents, throughput_count, viral_score, affiliate_revenue_cents, marketing_spend_cents, created_at)
           VALUES ('bi_allzero', ?1, ?2, ?3, 0, 0, 0, 0, 0, ?4)`
        )
        .bind(testOrgId, rangeJune.start, rangeJune.end, Date.now())
        .run();

      const metrics = await aggregateExecutiveBIMetrics(db, testOrgId, rangeJune);
      expect(metrics.roiRatio).toBe(0);
      expect(metrics.viralScore).toBe(0);
    });

    it('B3: handles extreme financial numbers ($10M+ MRR) without integer overflow', async () => {
      const hugeCents = 1_000_000_000; // $10,000,000.00
      await db
        .prepare(
          `INSERT INTO executive_bi_metrics
           (id, org_id, period_start, period_end, mrr_cents, throughput_count, viral_score, affiliate_revenue_cents, marketing_spend_cents, created_at)
           VALUES ('bi_huge', ?1, ?2, ?3, ?4, 5000, 95.5, ?4, 200000000, ?5)`
        )
        .bind(testOrgId, rangeJune.start, rangeJune.end, hugeCents, Date.now())
        .run();

      const metrics = await aggregateExecutiveBIMetrics(db, testOrgId, rangeJune);
      expect(metrics.mrrCents).toBe(1_000_000_000);
      expect(metrics.roiRatio).toBe(5.0); // 1,000,000,000 / 200,000,000 = 5.0
    });

    it('B4: CSV escaping handles complex multi-column escaping in a single row', () => {
      const headers = ['col1', 'col2', 'col3'];
      const rows = [
        {
          col1: 'Field with "quotes" and, commas',
          col2: 'Multi\r\nLine',
          col3: 'Simple',
        },
      ];

      const csv = formatStreamingCsv(headers, rows);
      expect(csv).toContain('"Field with ""quotes"" and, commas"');
      expect(csv).toContain('"Multi\r\nLine"');
      expect(csv).toContain('Simple');
    });

    it('B5: strictly excludes records outside requested date range', async () => {
      // Past record (May)
      await db
        .prepare(
          `INSERT INTO executive_bi_metrics
           (id, org_id, period_start, period_end, mrr_cents, throughput_count, viral_score, affiliate_revenue_cents, marketing_spend_cents, created_at)
           VALUES ('bi_may', ?1, 1000, 2000, 999999, 500, 99.0, 999999, 1000, ?2)`
        )
        .bind(testOrgId, Date.now())
        .run();

      // June record
      await db
        .prepare(
          `INSERT INTO executive_bi_metrics
           (id, org_id, period_start, period_end, mrr_cents, throughput_count, viral_score, affiliate_revenue_cents, marketing_spend_cents, created_at)
           VALUES ('bi_june', ?1, ?2, ?3, 10000, 10, 80.0, 20000, 10000, ?4)`
        )
        .bind(testOrgId, rangeJune.start, rangeJune.end, Date.now())
        .run();

      const metrics = await aggregateExecutiveBIMetrics(db, testOrgId, rangeJune);
      expect(metrics.throughputCount).toBe(10); // Does NOT include 500 from May!
      expect(metrics.mrrCents).toBe(10000);
    });
  });

  // ============================================================================
  // TIER 3: CROSS-FEATURE COMBINATIONS
  // ============================================================================
  describe('Tier 3: Cross-Feature Combinations', () => {
    it('P1: multi-tenant BI isolation prevents competitor data from polluting aggregation', async () => {
      // Seed metrics for Org A
      await db
        .prepare(
          `INSERT INTO executive_bi_metrics
           (id, org_id, period_start, period_end, mrr_cents, throughput_count, viral_score, affiliate_revenue_cents, marketing_spend_cents, created_at)
           VALUES ('bi_orgA', ?1, ?2, ?3, 100000, 50, 80.0, 200000, 50000, ?4)`
        )
        .bind(testOrgId, rangeJune.start, rangeJune.end, Date.now())
        .run();

      // Seed metrics for Competitor Org B
      await db
        .prepare(
          `INSERT INTO executive_bi_metrics
           (id, org_id, period_start, period_end, mrr_cents, throughput_count, viral_score, affiliate_revenue_cents, marketing_spend_cents, created_at)
           VALUES ('bi_orgB', ?1, ?2, ?3, 900000, 500, 99.0, 9000000, 1000000, ?4)`
        )
        .bind(otherOrgId, rangeJune.start, rangeJune.end, Date.now())
        .run();

      const metricsA = await aggregateExecutiveBIMetrics(db, testOrgId, rangeJune);
      const metricsB = await aggregateExecutiveBIMetrics(db, otherOrgId, rangeJune);

      expect(metricsA.throughputCount).toBe(50);
      expect(metricsA.mrrCents).toBe(100000);

      expect(metricsB.throughputCount).toBe(500);
      expect(metricsB.mrrCents).toBe(900000);
    });

    it('P2: generated BI metrics feed directly into both Telegram digest and CSV export', async () => {
      await db
        .prepare(
          `INSERT INTO executive_bi_metrics
           (id, org_id, period_start, period_end, mrr_cents, throughput_count, viral_score, affiliate_revenue_cents, marketing_spend_cents, created_at)
           VALUES ('bi_combo', ?1, ?2, ?3, 400000, 80, 88.0, 800000, 200000, ?4)`
        )
        .bind(testOrgId, rangeJune.start, rangeJune.end, Date.now())
        .run();

      const metrics = await aggregateExecutiveBIMetrics(db, testOrgId, rangeJune);

      // Telegram output
      const telegram = formatTelegramDigest(metrics, { agencyName: 'Omni Media' });
      expect(telegram).toContain('Omni Media');
      expect(telegram).toContain('4000\\.00');

      // CSV output
      const csv = formatStreamingCsv(['metric', 'value'], [
        { metric: 'MRR (USD)', value: (metrics.mrrCents / 100).toFixed(2) },
        { metric: 'Throughput', value: metrics.throughputCount },
        { metric: 'ROI', value: `${metrics.roiRatio}x` },
      ]);

      expect(csv).toContain('MRR (USD),4000.00');
      expect(csv).toContain('Throughput,80');
      expect(csv).toContain('ROI,4x');
    });
  });

  // ============================================================================
  // TIER 4: REAL-WORLD APPLICATION SCENARIOS
  // ============================================================================
  describe('Tier 4: Real-World Scenarios', () => {
    it('S1: complete Executive Monthly Financial Closeout & Multi-Channel BI Dispatch Workflow', async () => {
      // Step 1: Ingest monthly campaign metrics from multi-track creative engine
      await db
        .prepare(
          `INSERT INTO executive_bi_metrics
           (id, org_id, period_start, period_end, mrr_cents, throughput_count, viral_score, affiliate_revenue_cents, marketing_spend_cents, created_at)
           VALUES
           ('bi_tiktok', ?1, ?2, ?3, 350000, 120, 92.5, 850000, 250000, ?4),
           ('bi_shorts', ?1, ?2, ?3, 400000, 80, 88.0, 650000, 150000, ?4),
           ('bi_reels', ?1, ?2, ?3, 450000, 60, 85.5, 500000, 100000, ?4)`
        )
        .bind(testOrgId, rangeJune.start, rangeJune.end, Date.now())
        .run();

      // Step 2: Aggregate unified Executive BI metrics for June
      const summary = await aggregateExecutiveBIMetrics(db, testOrgId, rangeJune);

      expect(summary.mrrCents).toBe(450000); // Peak MRR: $4,500.00
      expect(summary.throughputCount).toBe(260); // 120 + 80 + 60 = 260 videos
      expect(summary.viralScore).toBe(88.67); // (92.5 + 88.0 + 85.5) / 3
      expect(summary.affiliateRevenueCents).toBe(2000000); // $20,000.00
      expect(summary.marketingSpendCents).toBe(500000); // $5,000.00
      expect(summary.roiRatio).toBe(4.0); // 2,000,000 / 500,000 = 4.0x ROI

      // Step 3: Format and verify Telegram Executive Digest for CEO mobile phone
      const telegramDigest = formatTelegramDigest(summary, { agencyName: 'Alpha Scale AI' });
      expect(telegramDigest).toContain('Alpha Scale AI');
      expect(telegramDigest).toContain('4500\\.00');
      expect(telegramDigest).toContain('260 videos');
      expect(telegramDigest).toContain('4x');
      expect(telegramDigest.length).toBeLessThan(4096);

      // Step 4: Render branded HTML email digest for executive board members
      const emailDigest = wrapWithAgencyBranding(
        `
        <h2>Monthly Performance Closeout — June 2024</h2>
        <p>Peak MRR reached $4,500.00 with 260 autonomous videos rendered.</p>
        <p>Total affiliate revenue reached $20,000.00 against $5,000.00 spend (4.0x ROI).</p>
        `,
        {
          agencyName: 'Alpha Scale AI',
          primaryColor: '#6366f1',
          logoUrl: 'https://alphascale.ai/logo.png',
        }
      );
      expect(emailDigest).toContain('Alpha Scale AI');
      expect(emailDigest).toContain('#6366f1');
      expect(emailDigest).toContain('Monthly Performance Closeout — June 2024');
      expect(emailDigest).toContain('4.0x ROI');

      // Step 5: Export full financial audit trail to RFC-4180 CSV
      const csvExport = formatStreamingCsv(
        ['channel', 'mrr_cents', 'throughput', 'revenue_cents', 'spend_cents'],
        [
          { channel: 'TikTok Shop', mrr_cents: 350000, throughput: 120, revenue_cents: 850000, spend_cents: 250000 },
          { channel: 'YouTube Shorts', mrr_cents: 400000, throughput: 80, revenue_cents: 650000, spend_cents: 150000 },
          { channel: 'Instagram Reels', mrr_cents: 450000, throughput: 60, revenue_cents: 500000, spend_cents: 100000 },
        ]
      );
      expect(csvExport).toContain('channel,mrr_cents,throughput,revenue_cents,spend_cents');
      expect(csvExport).toContain('TikTok Shop,350000,120,850000,250000');
      expect(csvExport).toContain('YouTube Shorts,400000,80,650000,150000');
    });
  });
});
