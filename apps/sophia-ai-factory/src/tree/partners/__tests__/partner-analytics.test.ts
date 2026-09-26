/**
 * Unit & Integration Test Suite for Real-Time Partner Analytics & Cohort Reporting
 *
 * Verifies:
 * 1. Cohort matrix calculation, logo retention, LTV, churn rate, and NRR accuracy.
 * 2. MCU consumption velocity, acceleration trend, runway days, and risk categorization.
 * 3. RFC-4180 compliant CSV formatting with UTF-8 BOM and double-quote escaping.
 * 4. High-DPI printable HTML report with SVG sparklines and white-label branding.
 * 5. Web Crypto HMAC-SHA256 partner webhook signing, anti-replay tolerance, and 5-stage backoff.
 * 6. D1 database analytics summary aggregation.
 *
 * @vitest-environment node
 * @module tree/partners/__tests__/partner-analytics.test
 */

import { describe, it, expect, vi } from 'vitest';
import { createRequire } from 'node:module';
import type { D1Database } from '@/seed/db/client';

import {
  computePartnerCohortMatrix,
  computeCohortMatrix,
  calculateMcuVelocity,
  getPartnerAnalyticsSummary,
  formatYearMonth,
  diffMonths,
  addMonths,
  type ClientSubscriptionRecord,
  type McuLogRecord,
  type PartnerAnalyticsSummary,
} from '../partner-analytics';

import {
  formatPartnerCsvReport,
  formatPartnerPrintableHtml,
  generateSvgSparkline,
  escapeCsvCell,
  escapeHtml,
  formatCurrency,
} from '../export-formatter';

import {
  signPartnerWebhookPayload,
  verifyPartnerWebhookSignature,
  parseSignatureHeader,
  timingSafeEqual,
  calculateBackoffDelayMs,
  isRetryableHttpStatus,
  dispatchPartnerQuotaWebhook,
  DEFAULT_TOLERANCE_SECONDS,
  BACKOFF_BASE_DELAYS_MS,
  MAX_DELIVERY_ATTEMPTS,
  SIGNATURE_HEADER_NAME,
} from '../partner-webhook-bus';

// In-Memory SQLite D1 Database Mock
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

function createTestDb(): D1Database {
  const db = new DatabaseSync(':memory:');

  db.exec(`
    CREATE TABLE IF NOT EXISTS partner_profiles (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL UNIQUE,
      tenant_id TEXT NOT NULL,
      partner_name TEXT NOT NULL,
      partner_type TEXT NOT NULL DEFAULT 'agency',
      tier TEXT NOT NULL DEFAULT 'SILVER',
      commission_rate_pct REAL NOT NULL DEFAULT 20.0,
      referral_code TEXT NOT NULL UNIQUE,
      custom_domain TEXT UNIQUE,
      whitelabel_enabled INTEGER NOT NULL DEFAULT 0,
      total_referred_customers INTEGER NOT NULL DEFAULT 0,
      total_mrr_cents INTEGER NOT NULL DEFAULT 0,
      total_earnings_cents INTEGER NOT NULL DEFAULT 0,
      pending_payout_cents INTEGER NOT NULL DEFAULT 0,
      payout_rail TEXT DEFAULT 'USDT',
      payout_destination_json TEXT DEFAULT '{}',
      status TEXT NOT NULL DEFAULT 'active',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS partner_commissions (
      id TEXT PRIMARY KEY,
      partner_id TEXT NOT NULL,
      referred_user_id TEXT NOT NULL,
      referred_tenant_id TEXT NOT NULL,
      order_id TEXT NOT NULL,
      mrr_cents INTEGER NOT NULL,
      commission_rate_pct REAL NOT NULL,
      commission_cents INTEGER NOT NULL,
      tier_at_time TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'approved',
      payout_batch_id TEXT,
      period_start INTEGER,
      period_end INTEGER,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (partner_id) REFERENCES partner_profiles(id),
      UNIQUE(partner_id, order_id)
    );

    CREATE TABLE IF NOT EXISTS partner_license_pools (
      id TEXT PRIMARY KEY,
      partner_id TEXT NOT NULL,
      pool_name TEXT NOT NULL,
      total_seats INTEGER NOT NULL DEFAULT 0,
      allocated_seats INTEGER NOT NULL DEFAULT 0,
      total_mcu_credits INTEGER NOT NULL DEFAULT 0,
      allocated_mcu_credits INTEGER NOT NULL DEFAULT 0,
      consumed_mcu_credits INTEGER NOT NULL DEFAULT 0,
      unit_price_cents INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS webhook_subscriptions (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      endpoint_url TEXT NOT NULL,
      secret_key TEXT NOT NULL,
      event_types TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS webhook_delivery_logs (
      id TEXT PRIMARY KEY,
      subscription_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      signature TEXT NOT NULL,
      http_status INTEGER,
      status TEXT NOT NULL,
      attempt_number INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL
    );
  `);

  return {
    prepare(sql: string) {
      const stmt = db.prepare(sql);
      return {
        bind: (...params: unknown[]) => {
          const sanitized = params.map((p) => (p === undefined ? null : p));
          return {
            first: async <T>() => stmt.get(...sanitized) as T | undefined,
            run: async () => {
              const r = stmt.run(...sanitized);
              return { success: true, meta: { changes: Number(r.changes ?? 0) } };
            },
            all: async <T>() => {
              return { results: stmt.all(...sanitized) as T[], meta: { changes: 0 } };
            },
          };
        },
        first: async <T>() => stmt.get() as T | undefined,
        run: async () => {
          const r = stmt.run();
          return { success: true, meta: { changes: Number(r.changes ?? 0) } };
        },
        all: async <T>() => {
          return { results: stmt.all() as T[], meta: { changes: 0 } };
        },
      };
    },
  } as unknown as D1Database;
}

// ============================================================================
// PART 1: Cohort Matrix & Retention Analytics Tests
// ============================================================================

describe('Partner Analytics — Cohort Matrix & Retention Engine', () => {
  it('correctly normalizes month strings and calculates month differences', () => {
    expect(formatYearMonth('2026-06-15T08:00:00Z')).toBe('2026-06');
    expect(formatYearMonth('2026-09')).toBe('2026-09');
    expect(diffMonths('2026-01', '2026-04')).toBe(3);
    expect(diffMonths('2026-11', '2027-02')).toBe(3);
    expect(addMonths('2026-06', 2)).toBe('2026-08');
    expect(addMonths('2026-11', 3)).toBe('2027-02');
  });

  it('handles empty clients array gracefully', () => {
    const matrix = computePartnerCohortMatrix([]);
    expect(matrix.cohorts).toEqual([]);
    expect(matrix.summary.totalClients).toBe(0);
    expect(matrix.summary.activeClients).toBe(0);
    expect(matrix.summary.totalMrrCents).toBe(0);
    expect(matrix.summary.avgLtvCents).toBe(0);
    expect(matrix.summary.overallNrrPct).toBe(100);
  });

  it('computes cohort retention and Net Revenue Retention (NRR) accurately', () => {
    // 3 clients in 2026-06 cohort:
    // Client A: M0: $100 (10000 cents), M1: $100, M2: $150 (expansion)
    // Client B: M0: $200 (20000 cents), M1: $200, M2: $0 (churned)
    // Client C: M0: $300 (30000 cents), M1: $300, M2: $300
    const clients: ClientSubscriptionRecord[] = [
      {
        clientId: 'cli_01',
        firstOrderAt: '2026-06-01T00:00:00Z',
        monthlyHistory: [
          { month: '2026-06', mrrCents: 10000 },
          { month: '2026-07', mrrCents: 10000 },
          { month: '2026-08', mrrCents: 15000 },
        ],
        status: 'active',
        currentMrrCents: 15000,
      },
      {
        clientId: 'cli_02',
        firstOrderAt: '2026-06-05T00:00:00Z',
        monthlyHistory: [
          { month: '2026-06', mrrCents: 20000 },
          { month: '2026-07', mrrCents: 20000 },
          { month: '2026-08', mrrCents: 0 },
        ],
        status: 'churned',
        currentMrrCents: 0,
      },
      {
        clientId: 'cli_03',
        firstOrderAt: '2026-06-10T00:00:00Z',
        monthlyHistory: [
          { month: '2026-06', mrrCents: 30000 },
          { month: '2026-07', mrrCents: 30000 },
          { month: '2026-08', mrrCents: 30000 },
        ],
        status: 'active',
        currentMrrCents: 30000,
      },
    ];

    const result = computePartnerCohortMatrix(clients);
    expect(result.cohorts).toHaveLength(1);

    const cohort202606 = result.cohorts[0];
    expect(cohort202606.cohortMonth).toBe('2026-06');
    expect(cohort202606.initialSize).toBe(3);
    expect(cohort202606.initialMrrCents).toBe(60000); // 100 + 200 + 300 = $600

    // Total Realized Revenue:
    // M0: 100 + 200 + 300 = $600 (60000 cents)
    // M1: 100 + 200 + 300 = $600 (60000 cents)
    // M2: 150 + 0 + 300 = $450 (45000 cents)
    // Total = 165000 cents ($1,650)
    expect(cohort202606.totalRealizedRevenueCents).toBe(165000);
    // Realized LTV = 165000 / 3 = 55000 cents ($550)
    expect(cohort202606.realizedLtvCents).toBe(55000);

    // Month 0 (k=0)
    const p0 = cohort202606.periods[0];
    expect(p0.monthIndex).toBe(0);
    expect(p0.activeClients).toBe(3);
    expect(p0.logoRetentionPct).toBe(100.0);
    expect(p0.nrrPct).toBe(100.0);
    expect(p0.logoChurnPct).toBe(0.0);

    // Month 1 (k=1)
    const p1 = cohort202606.periods[1];
    expect(p1.monthIndex).toBe(1);
    expect(p1.activeClients).toBe(3);
    expect(p1.logoRetentionPct).toBe(100.0);
    expect(p1.nrrPct).toBe(100.0);

    // Month 2 (k=2): 2 active clients out of 3 -> 66.67% logo retention
    const p2 = cohort202606.periods[2];
    expect(p2.monthIndex).toBe(2);
    expect(p2.activeClients).toBe(2);
    expect(p2.logoRetentionPct).toBe(66.67);
    expect(p2.logoChurnPct).toBe(33.33);
    // MRR = 150 + 300 = $450 (45000 cents). Initial was $600 (60000 cents).
    // NRR = 45000 / 60000 * 100% = 75.0%
    expect(p2.mrrCents).toBe(45000);
    expect(p2.nrrPct).toBe(75.0);

    // Summary checks
    expect(result.summary.totalClients).toBe(3);
    expect(result.summary.activeClients).toBe(2);
    expect(result.summary.totalMrrCents).toBe(45000);
    expect(result.summary.avgLtvCents).toBe(55000);
    // Blended churn: 1 churned / 3 = 33.33%
    expect(result.summary.blendedChurnPct).toBe(33.33);
  });

  it('calculates Net Revenue Retention > 100% when expansion occurs', () => {
    // 1 client starting at $1,000 and upgrading to $2,000 in Month 1
    const clients: ClientSubscriptionRecord[] = [
      {
        clientId: 'cli_exp',
        firstOrderAt: '2026-07-01T00:00:00Z',
        monthlyHistory: [
          { month: '2026-07', mrrCents: 100000 },
          { month: '2026-08', mrrCents: 200000 },
        ],
        status: 'active',
        currentMrrCents: 200000,
      },
    ];

    const result = computePartnerCohortMatrix(clients);
    const cohort = result.cohorts[0];
    const m1 = cohort.periods[1];

    expect(m1.nrrPct).toBe(200.0);
    expect(m1.logoRetentionPct).toBe(100.0);
    expect(result.summary.overallNrrPct).toBe(200.0);
  });

  it('supports computeCohortMatrix alias identically', () => {
    expect(computeCohortMatrix).toBe(computePartnerCohortMatrix);
  });

  it('handles multiple cohorts and projected LTV formula with gross margin', () => {
    const clients: ClientSubscriptionRecord[] = [
      {
        clientId: 'cli_c1',
        firstOrderAt: '2026-05-01T00:00:00Z',
        currentMrrCents: 10000,
        status: 'active',
      },
      {
        clientId: 'cli_c2',
        firstOrderAt: '2026-06-01T00:00:00Z',
        currentMrrCents: 20000,
        status: 'churned',
      },
    ];

    const result = computePartnerCohortMatrix(clients);
    expect(result.cohorts).toHaveLength(2);
    expect(result.summary.totalClients).toBe(2);
    expect(result.summary.activeClients).toBe(1);
    expect(result.summary.blendedChurnPct).toBe(50.0);
    // ARPU = 10000 / 1 = 10000 cents ($100). Churn = 50% (0.50). Gross Margin = 82% (0.82)
    // Projected LTV = (10000 * 0.82) / 0.50 = 16400 cents ($164)
    expect(result.summary.projectedLtvCents).toBe(16400);
  });
});

// ============================================================================
// PART 2: MCU Consumption Velocity & Runway Tests
// ============================================================================

describe('Partner Analytics — MCU Consumption Velocity & Runway', () => {
  it('handles empty consumption logs with dormant status', () => {
    const res = calculateMcuVelocity([], 30, 1000);
    expect(res.velocity7d).toBe(0);
    expect(res.velocity30d).toBe(0);
    expect(res.velocityWindowDays).toBe(0);
    expect(res.acceleration).toBe(0);
    expect(res.trend).toBe('stable');
    expect(res.currentBalance).toBe(1000);
    expect(res.runwayDays).toBe(999);
    expect(res.exhaustionRisk).toBe('dormant');
  });

  it('calculates 7-day and 30-day velocity with negative delta consumption logs', () => {
    const now = 1790400000000;
    const dayMs = 86_400 * 1000;

    // 7 days of consumption: 70 MCU consumed in last 7 days (10 MCU/day)
    // plus earlier 23 days: 230 MCU consumed (total 300 MCU in 30 days -> 10 MCU/day)
    const logs: McuLogRecord[] = [];

    // Daily consumption over last 7 days: -10 each day
    for (let d = 0; d < 7; d++) {
      logs.push({
        timestamp: now - d * dayMs,
        delta: -10,
      });
    }

    // Days 8 to 29: -10 each day
    for (let d = 7; d < 30; d++) {
      logs.push({
        timestamp: now - d * dayMs,
        delta: -10,
      });
    }

    const res = calculateMcuVelocity(logs, 30, 200, now);
    expect(res.velocity7d).toBe(10.0);
    expect(res.velocity30d).toBe(10.0);
    expect(res.velocityWindowDays).toBe(10.0);
    expect(res.totalConsumedInWindow).toBe(300);
    expect(res.trend).toBe('stable');

    // Runway days = 200 / 10 = 20 days -> healthy
    expect(res.runwayDays).toBe(20);
    expect(res.exhaustionRisk).toBe('healthy');
  });

  it('detects accelerating consumption and flags imminent exhaustion risk (< 7 days)', () => {
    const now = 1790400000000;
    const dayMs = 86_400 * 1000;

    // Last 7 days: rapid surge of 700 MCU (100 MCU/day)
    // Days 8-30: baseline was 230 MCU (10 MCU/day)
    const logs: McuLogRecord[] = [];

    for (let d = 0; d < 7; d++) {
      logs.push({
        timestamp: now - d * dayMs,
        mcuConsumed: 100, // explicit positive mcuConsumed
      });
    }
    for (let d = 7; d < 30; d++) {
      logs.push({
        timestamp: now - d * dayMs,
        mcuConsumed: 10,
      });
    }

    // Current balance: 400 MCU. Velocity 7d: 100 MCU/day.
    // Runway days = 400 / 100 = 4 days -> 'imminent' risk (< 7 days)
    const res = calculateMcuVelocity(logs, 30, 400, now);
    expect(res.velocity7d).toBe(100.0);
    expect(res.velocity30d).toBe(31.0); // (700 + 230) / 30 = 31.0
    expect(res.acceleration).toBeGreaterThan(0.25);
    expect(res.trend).toBe('accelerating');
    expect(res.runwayDays).toBe(4);
    expect(res.exhaustionRisk).toBe('imminent');
  });

  it('detects decelerating consumption and warning risk level (< 15 days)', () => {
    const now = 1790400000000;
    const dayMs = 86_400 * 1000;

    // Last 7 days: slowed to 70 MCU (10 MCU/day)
    // Days 8-30: was heavy at 1150 MCU (50 MCU/day)
    const logs: McuLogRecord[] = [];
    for (let d = 0; d < 7; d++) {
      logs.push({ timestamp: now - d * dayMs, delta: -10 });
    }
    for (let d = 7; d < 30; d++) {
      logs.push({ timestamp: now - d * dayMs, delta: -50 });
    }

    // Current balance: 120 MCU. Velocity 7d: 10 MCU/day.
    // Runway days = 120 / 10 = 12 days -> 'warning' (< 15 days)
    const res = calculateMcuVelocity(logs, 30, 120, now);
    expect(res.velocity7d).toBe(10.0);
    expect(res.trend).toBe('decelerating');
    expect(res.runwayDays).toBe(12);
    expect(res.exhaustionRisk).toBe('warning');
  });
});

// ============================================================================
// PART 3: RFC-4180 CSV & Printable HTML Export Tests
// ============================================================================

describe('Export Formatter — RFC-4180 CSV & High-DPI Printable HTML', () => {
  const mockAnalyticsData: PartnerAnalyticsSummary = {
    partnerId: 'ptn_apex',
    partnerName: 'Apex Creative Agency, Inc.',
    tier: 'PLATINUM',
    period: '2026-09',
    generatedAt: 1790400000000,
    totalSubClients: 12,
    activeSubClients: 10,
    totalMrrCents: 2500000, // $25,000
    monthlyCommissionCents: 875000, // $8,750
    lifetimeEarningsCents: 4500000,
    totalMcuAllocated: 50000,
    totalMcuConsumed: 32000,
    avgMcuVelocityDaily: 45.2,
    avgLtvCents: 375000,
    blendedChurnPct: 16.67,
    revenueGrowthPct: 42.5,
    topSubClients: [
      {
        clientId: 'cli_01',
        clientName: 'Alpha "Special" Client, LLC',
        tier: 'Enterprise',
        totalOrders: 6,
        lifetimeMrrCents: 1200000,
        currentMrrCents: 500000,
        mcuBalance: 2400,
        mcuVelocityDaily: 60.0,
        runwayDays: 40,
        status: 'healthy',
        firstSeenAt: 1780000000000,
        lastActiveAt: 1790300000000,
      },
    ],
    cohortMatrix: {
      cohorts: [
        {
          cohortMonth: '2026-07',
          initialSize: 5,
          initialMrrCents: 1000000,
          totalRealizedRevenueCents: 2800000,
          realizedLtvCents: 560000,
          periods: [
            {
              monthIndex: 0,
              activityMonth: '2026-07',
              activeClients: 5,
              logoRetentionPct: 100,
              mrrCents: 1000000,
              nrrPct: 100,
              logoChurnPct: 0,
              mrrChurnPct: 0,
            },
            {
              monthIndex: 1,
              activityMonth: '2026-08',
              activeClients: 4,
              logoRetentionPct: 80,
              mrrCents: 950000,
              nrrPct: 95,
              logoChurnPct: 20,
              mrrChurnPct: 5,
            },
          ],
        },
      ],
      summary: {
        totalClients: 12,
        activeClients: 10,
        totalMrrCents: 2500000,
        avgLtvCents: 375000,
        projectedLtvCents: 1230000,
        blendedChurnPct: 16.67,
        avgM1RetentionPct: 80,
        avgM3RetentionPct: 75,
        overallNrrPct: 105.5,
      },
    },
  };

  it('escapes CSV cells strictly according to RFC-4180 rules', () => {
    expect(escapeCsvCell('simple')).toBe('simple');
    expect(escapeCsvCell('comma, separated')).toBe('"comma, separated"');
    expect(escapeCsvCell('contains "quotes"')).toBe('"contains ""quotes"""');
    expect(escapeCsvCell('line\nbreak')).toBe('"line\nbreak"');
    expect(escapeCsvCell('both "quotes", and, commas')).toBe('"both ""quotes"", and, commas"');
  });

  it('generates RFC-4180 CSV with UTF-8 BOM and correct record escaping', () => {
    const csv = formatPartnerCsvReport(mockAnalyticsData, {
      brandName: 'Apex "Global" Agency, LLC',
      reportPeriod: 'September 2026',
    });

    // 1. Starts with UTF-8 Byte Order Mark
    expect(csv.startsWith('\uFEFF')).toBe(true);

    // 2. Uses CRLF line endings
    expect(csv).toContain('\r\n');

    // 3. Contains properly escaped brand name and client name
    expect(csv).toContain('"Apex ""Global"" Agency, LLC"');
    expect(csv).toContain('"Alpha ""Special"" Client, LLC"');

    // 4. Contains major sections
    expect(csv).toContain('EXECUTIVE KPI SUMMARY');
    expect(csv).toContain('CUSTOMER COHORT RETENTION & NRR MATRIX');
    expect(csv).toContain('SUB-CLIENT MCU CONSUMPTION & RUNWAY LEDGER');

    // 5. Contains formatted currency
    expect(csv).toContain('$25,000.00');
  });

  it('generates high-DPI printable HTML report with SVG sparklines and partner branding', () => {
    const html = formatPartnerPrintableHtml(mockAnalyticsData, {
      brandName: 'Apex Brand Factory',
      logoUrl: 'https://cdn.apex.agency/logo.png',
      primaryColor: '#8b5cf6',
      accentColor: '#ec4899',
      reportPeriod: 'Q3 2026 Executive Review',
      supportUrl: 'https://apex.agency/support',
    });

    // 1. Contains partner branding and colors
    expect(html).toContain('Apex Brand Factory');
    expect(html).toContain('https://cdn.apex.agency/logo.png');
    expect(html).toContain('#8b5cf6');
    expect(html).toContain('#ec4899');

    // 2. Contains print-ready styles and media query
    expect(html).toContain('@page');
    expect(html).toContain('A4 landscape');
    expect(html).toContain('-webkit-print-color-adjust: exact');
    expect(html).toContain('window.print()');

    // 3. Contains genuine SVG sparklines with path and stroke
    expect(html).toContain('<svg');
    expect(html).toContain('viewBox="0 0 140 36"');
    expect(html).toContain('<path');
    expect(html).toContain('class="sparkline"');

    // 4. Contains zero vendor leakage (no unauthorized Sophia references)
    expect(html).not.toContain('Powered by Sophia');

    // 5. Protects against XSS via escapeHtml
    expect(html).toContain('Alpha &quot;Special&quot; Client, LLC');
  });

  it('generates valid SVG sparklines across single, multi, and empty data points', () => {
    const emptySvg = generateSvgSparkline([]);
    expect(emptySvg).toContain('<svg');
    expect(emptySvg).toContain('stroke-dasharray="3 3"');

    const singleSvg = generateSvgSparkline([42]);
    expect(singleSvg).toContain('<circle');

    const multiSvg = generateSvgSparkline([10, 25, 15, 30, 45, 60], {
      width: 150,
      height: 40,
      strokeColor: '#10b981',
    });
    expect(multiSvg).toContain('viewBox="0 0 150 40"');
    expect(multiSvg).toContain('stroke="#10b981"');
    expect(multiSvg).toContain('<linearGradient');
  });
});

// ============================================================================
// PART 4: HMAC-SHA256 Webhook Signing, Replay & 5-Stage Backoff Tests
// ============================================================================

describe('Partner Webhook Bus — HMAC-SHA256 Signing & 5-Stage Backoff', () => {
  const secretKey = 'whsec_test_secret_key_12345';
  const testPayload = {
    client_id: 'usr_abc999',
    credits_remaining: 10,
    credits_initial: 100,
    percentage_remaining: 10.0,
  };

  it('signs payload using Web Crypto HMAC-SHA256 and formats header', async () => {
    const now = Math.floor(Date.now() / 1000);
    const { headerValue, timestamp, signature } = await signPartnerWebhookPayload(
      secretKey,
      testPayload,
      now
    );

    expect(headerValue).toBe(`t=${now},v1=${signature}`);
    expect(timestamp).toBe(now);
    expect(signature).toMatch(/^[0-9a-f]{64}$/);

    const parsed = parseSignatureHeader(headerValue);
    expect(parsed).not.toBeNull();
    expect(parsed?.timestamp).toBe(now);
    expect(parsed?.signature).toBe(signature);
  });

  it('verifies genuine signature successfully', async () => {
    const now = Math.floor(Date.now() / 1000);
    const rawBody = JSON.stringify(testPayload);
    const { headerValue } = await signPartnerWebhookPayload(secretKey, rawBody, now);

    const result = await verifyPartnerWebhookSignature(secretKey, headerValue, rawBody, 300, now);
    expect(result.valid).toBe(true);
    expect(result.timestamp).toBe(now);
  });

  it('rejects tampered payload content', async () => {
    const now = Math.floor(Date.now() / 1000);
    const rawBody = JSON.stringify(testPayload);
    const { headerValue } = await signPartnerWebhookPayload(secretKey, rawBody, now);

    const tamperedBody = JSON.stringify({ ...testPayload, credits_remaining: 999 });
    const result = await verifyPartnerWebhookSignature(secretKey, headerValue, tamperedBody, 300, now);

    expect(result.valid).toBe(false);
    expect(result.reason).toBe('Signature mismatch');
  });

  it('rejects tampered secret key', async () => {
    const now = Math.floor(Date.now() / 1000);
    const rawBody = JSON.stringify(testPayload);
    const { headerValue } = await signPartnerWebhookPayload(secretKey, rawBody, now);

    const result = await verifyPartnerWebhookSignature('wrong_secret', headerValue, rawBody, 300, now);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('Signature mismatch');
  });

  it('rejects replay attacks outside the 300-second tolerance window', async () => {
    const pastTimestamp = Math.floor(Date.now() / 1000) - 305; // 305 seconds ago (> 300s window)
    const rawBody = JSON.stringify(testPayload);
    const { headerValue } = await signPartnerWebhookPayload(secretKey, rawBody, pastTimestamp);

    const currentNow = Math.floor(Date.now() / 1000);
    const result = await verifyPartnerWebhookSignature(secretKey, headerValue, rawBody, 300, currentNow);

    expect(result.valid).toBe(false);
    expect(result.reason).toContain('outside tolerance window');
  });

  it('implements constant-time string comparison', () => {
    expect(timingSafeEqual('abcdef', 'abcdef')).toBe(true);
    expect(timingSafeEqual('abcdef', 'abcdeg')).toBe(false);
    expect(timingSafeEqual('short', 'longer_string')).toBe(false);
  });

  it('computes 5-stage exponential backoff progression accurately', () => {
    // Attempt 1: 0ms
    expect(calculateBackoffDelayMs(1, false)).toBe(0);
    // Attempt 2: 30,000ms (30s)
    expect(calculateBackoffDelayMs(2, false)).toBe(30_000);
    // Attempt 3: 120,000ms (2m)
    expect(calculateBackoffDelayMs(3, false)).toBe(120_000);
    // Attempt 4: 600,000ms (10m)
    expect(calculateBackoffDelayMs(4, false)).toBe(600_000);
    // Attempt 5: 3,600,000ms (1h)
    expect(calculateBackoffDelayMs(5, false)).toBe(3_600_000);
    // Attempt > 5 caps at 1h
    expect(calculateBackoffDelayMs(6, false)).toBe(3_600_000);

    // Jitter produces values within 80% - 120% of base delay
    const jittered = calculateBackoffDelayMs(2, true);
    expect(jittered).toBeGreaterThanOrEqual(24_000);
    expect(jittered).toBeLessThanOrEqual(36_000);
  });

  it('classifies retryable vs non-retryable HTTP statuses', () => {
    // Retryable: 429, 500, 502, 503, 504
    expect(isRetryableHttpStatus(429)).toBe(true);
    expect(isRetryableHttpStatus(500)).toBe(true);
    expect(isRetryableHttpStatus(503)).toBe(true);

    // Non-retryable: 400, 401, 403, 404, 422
    expect(isRetryableHttpStatus(400)).toBe(false);
    expect(isRetryableHttpStatus(401)).toBe(false);
    expect(isRetryableHttpStatus(404)).toBe(false);
    expect(isRetryableHttpStatus(422)).toBe(false);
  });

  it('dispatches partner quota webhook successfully on HTTP 200', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
    });

    const res = await dispatchPartnerQuotaWebhook(
      'ptn_apex',
      'partner.client.quota_low',
      { client_id: 'cli_01', remaining: 15 },
      {
        endpointUrl: 'https://webhook.client.com/events',
        secretKey: 'sec_test',
        fetchFn: mockFetch as unknown as typeof fetch,
      }
    );

    expect(res.delivered).toBe(true);
    expect(res.httpStatus).toBe(200);
    expect(res.attempts).toBe(1);
    expect(mockFetch).toHaveBeenCalledTimes(1);

    // Verify headers passed to recipient
    const callHeaders = mockFetch.mock.calls[0][1].headers;
    expect(callHeaders[SIGNATURE_HEADER_NAME]).toMatch(/^t=\d+,v1=[0-9a-f]{64}$/);
    expect(callHeaders['X-Sophia-Event-Type']).toBe('partner.client.quota_low');
  });

  it('aborts immediately without retry on non-retryable HTTP 400', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
    });

    const res = await dispatchPartnerQuotaWebhook(
      'ptn_apex',
      'partner.client.quota_depleted',
      { client_id: 'cli_01', remaining: 0 },
      {
        endpointUrl: 'https://webhook.client.com/events',
        secretKey: 'sec_test',
        fetchFn: mockFetch as unknown as typeof fetch,
        maxAttempts: 5,
      }
    );

    expect(res.delivered).toBe(false);
    expect(res.httpStatus).toBe(400);
    expect(res.attempts).toBe(1); // Aborted after 1 attempt, no useless retries
    expect(res.lastError).toBe('Non-retryable HTTP 400');
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('retries up to maxAttempts on retryable HTTP 500 error', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
    });

    const res = await dispatchPartnerQuotaWebhook(
      'ptn_apex',
      'partner.client.milestone_reached',
      { client_id: 'cli_01', milestone_type: 'videos_rendered_total', milestone_value: 100 },
      {
        endpointUrl: 'https://webhook.client.com/events',
        secretKey: 'sec_test',
        fetchFn: mockFetch as unknown as typeof fetch,
        maxAttempts: 3,
      }
    );

    expect(res.delivered).toBe(false);
    expect(res.httpStatus).toBe(500);
    expect(res.attempts).toBe(3);
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it('persists delivery audit log when D1 database is provided', async () => {
    const db = createTestDb();
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
    });

    const res = await dispatchPartnerQuotaWebhook(
      db,
      'ptn_apex',
      'partner.client.quota_low',
      { client_id: 'cli_01', remaining: 10 },
      {
        endpointUrl: 'https://webhook.client.com/events',
        secretKey: 'sec_test',
        fetchFn: mockFetch as unknown as typeof fetch,
      }
    );

    expect(res.delivered).toBe(true);
    expect(res.deliveryLogId).toBeDefined();

    // Query D1 log table
    const log = await db
      .prepare('SELECT id, subscription_id, event_type, status, attempt_number FROM webhook_delivery_logs WHERE id = ?1')
      .bind(res.deliveryLogId)
      .first<{ id: string; subscription_id: string; event_type: string; status: string; attempt_number: number }>();

    expect(log).toBeDefined();
    expect(log?.subscription_id).toBe('ptn_apex');
    expect(log?.event_type).toBe('partner.client.quota_low');
    expect(log?.status).toBe('success');
    expect(log?.attempt_number).toBe(1);
  });
});

// ============================================================================
// PART 5: D1 Partner Analytics Summary Aggregator Tests
// ============================================================================

describe('Partner Analytics — D1 Analytics Summary Aggregator', () => {
  it('aggregates profile, commissions, and sub-client metrics from D1', async () => {
    const db = createTestDb();
    const now = Date.now();

    // Seed partner profile
    await db
      .prepare(`
        INSERT INTO partner_profiles (
          id, user_id, tenant_id, partner_name, tier, total_referred_customers,
          total_mrr_cents, total_earnings_cents, pending_payout_cents, referral_code,
          created_at, updated_at
        ) VALUES (
          'ptn_01', 'usr_partner', 'ten_partner', 'Nexus Growth Agency', 'GOLD',
          5, 500000, 140000, 35000, 'nexus-ref', ?1, ?1
        )
      `)
      .bind(now)
      .run();

    // Seed commissions for 2 sub-clients
    await db
      .prepare(`
        INSERT INTO partner_commissions (
          id, partner_id, referred_user_id, referred_tenant_id, order_id,
          mrr_cents, commission_rate_pct, commission_cents, tier_at_time,
          status, created_at
        ) VALUES
          ('comm_1', 'ptn_01', 'client_alpha', 'ten_a', 'ord_1', 300000, 28.0, 84000, 'GOLD', 'approved', ?1),
          ('comm_2', 'ptn_01', 'client_beta', 'ten_b', 'ord_2', 200000, 28.0, 56000, 'GOLD', 'approved', ?1)
      `)
      .bind(now)
      .run();

    // Seed license pool
    await db
      .prepare(`
        INSERT INTO partner_license_pools (
          id, partner_id, pool_name, total_seats, allocated_seats,
          total_mcu_credits, allocated_mcu_credits, consumed_mcu_credits,
          unit_price_cents, status, created_at, updated_at
        ) VALUES (
          'pool_01', 'ptn_01', 'Standard Pool', 20, 10,
          10000, 5000, 2200, 100, 'active', ?1, ?1
        )
      `)
      .bind(now)
      .run();

    const summary = await getPartnerAnalyticsSummary(db, 'ptn_01');

    expect(summary.partnerId).toBe('ptn_01');
    expect(summary.partnerName).toBe('Nexus Growth Agency');
    expect(summary.tier).toBe('GOLD');
    expect(summary.totalSubClients).toBe(2);
    expect(summary.totalMcuAllocated).toBe(5000);
    expect(summary.totalMcuConsumed).toBe(2200);
    expect(summary.topSubClients).toHaveLength(2);
    expect(summary.topSubClients[0].clientId).toBe('client_alpha');
    expect(summary.topSubClients[0].currentMrrCents).toBe(300000);
  });
});
