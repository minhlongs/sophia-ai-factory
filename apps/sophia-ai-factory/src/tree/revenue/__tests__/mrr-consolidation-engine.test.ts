import { describe, it, expect, beforeEach } from 'vitest';
import { createRequire } from 'node:module';
import type { D1Database } from '@cloudflare/workers-types';
import {
  consolidateMrrChannels,
  generateGate8TargetModel,
  sanitizeCents,
  saveUnifiedRevenueSnapshot,
  getLatestUnifiedRevenueSnapshot,
  getUnifiedRevenueSnapshotsHistory,
  aggregateRealtimeMrrFromD1,
} from '../mrr-consolidation-engine';
import { GATE_8_CONSTANTS } from '@/seed/types/unified-revenue';

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
    CREATE TABLE IF NOT EXISTS unified_revenue_snapshots (
      id TEXT PRIMARY KEY,
      snapshot_timestamp INTEGER NOT NULL,
      period_month TEXT NOT NULL,
      direct_sales_cents INTEGER NOT NULL DEFAULT 0,
      affiliate_sales_cents INTEGER NOT NULL DEFAULT 0,
      content_seo_cents INTEGER NOT NULL DEFAULT 0,
      enterprise_deals_cents INTEGER NOT NULL DEFAULT 0,
      total_mrr_cents INTEGER NOT NULL DEFAULT 0,
      active_customers_count INTEGER NOT NULL DEFAULT 0,
      arpu_cents INTEGER NOT NULL DEFAULT 0,
      target_mrr_cents INTEGER NOT NULL DEFAULT 100000000,
      target_customers_count INTEGER NOT NULL DEFAULT 5000,
      target_arpu_cents INTEGER NOT NULL DEFAULT 20000,
      channel_breakdown_json TEXT NOT NULL DEFAULT '{}',
      currency TEXT NOT NULL DEFAULT 'USD',
      status TEXT NOT NULL DEFAULT 'active',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS subscriptions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      current_mrr_cents INTEGER NOT NULL,
      status TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS enterprise_deals (
      id TEXT PRIMARY KEY,
      mrr_cents INTEGER NOT NULL,
      stage TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS partner_commissions (
      id TEXT PRIMARY KEY,
      referred_user_id TEXT NOT NULL,
      mrr_cents INTEGER NOT NULL,
      status TEXT NOT NULL
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

describe('MRR Consolidation Engine - Mathematical Invariance & Leakage Checks', () => {
  it('enforces exact zero-penny leakage across 4 channels', () => {
    const input = {
      periodMonth: '2027-09',
      directSalesCents: 40_000_123,
      affiliateSalesCents: 15_000_456,
      contentSeoCents: 9_999_421,
      enterpriseDealsCents: 35_000_000,
      activeCustomersCount: 5_000,
    };

    const res = consolidateMrrChannels(input);
    const expectedTotal = 40_000_123 + 15_000_456 + 9_999_421 + 35_000_000;

    expect(res.totalMrrCents).toBe(expectedTotal);
    expect(res.totalMrrCents).toBe(100_000_000);

    // Sum of channels must strictly equal totalMrrCents
    const sumChannels = res.breakdowns.reduce((acc, c) => acc + c.mrrCents, 0);
    expect(sumChannels).toBe(res.totalMrrCents);
  });

  it('rejects negative, non-finite, and NaN amounts', () => {
    expect(() => sanitizeCents(-100)).toThrow('Monetary amount cannot be negative');
    expect(() => sanitizeCents(NaN)).toThrow('Invalid monetary amount');
    expect(() => sanitizeCents(Infinity)).toThrow('Invalid monetary amount');
  });

  it('calculates integer ARPU and handles zero active customers without divide-by-zero error', () => {
    const zeroCust = consolidateMrrChannels({
      periodMonth: '2027-09',
      directSalesCents: 10_000,
      affiliateSalesCents: 0,
      contentSeoCents: 0,
      enterpriseDealsCents: 0,
      activeCustomersCount: 0,
    });
    expect(zeroCust.arpuCents).toBe(0);

    const validCust = consolidateMrrChannels({
      periodMonth: '2027-09',
      directSalesCents: 200_000, // $2,000
      affiliateSalesCents: 100_000, // $1,000
      contentSeoCents: 0,
      enterpriseDealsCents: 0,
      activeCustomersCount: 10,
    });
    // $3,000 / 10 = $300 (30,000 cents)
    expect(validCust.arpuCents).toBe(30_000);
  });
});

describe('MRR Consolidation Engine - Gate 8 Milestone Attainment Model', () => {
  it('generates the authentic Gate 8 target financial model reaching $1,000,000 MRR', () => {
    const { input, consolidated } = generateGate8TargetModel();

    expect(input.directSalesCents).toBe(40_000_000); // $400k
    expect(input.enterpriseDealsCents).toBe(35_000_000); // $350k
    expect(input.affiliateSalesCents).toBe(15_000_000); // $150k
    expect(input.contentSeoCents).toBe(10_000_000); // $100k

    expect(consolidated.totalMrrCents).toBe(GATE_8_CONSTANTS.TARGET_MRR_CENTS); // 100,000,000 cents ($1M)
    expect(consolidated.progress.currentCustomers).toBe(GATE_8_CONSTANTS.TARGET_CUSTOMERS); // 5,000
    expect(consolidated.arpuCents).toBe(GATE_8_CONSTANTS.TARGET_ARPU_CENTS); // 20,000 cents ($200)

    expect(consolidated.progress.mrrAttainmentPct).toBe(100.0);
    expect(consolidated.progress.customersAttainmentPct).toBe(100.0);
    expect(consolidated.progress.isMilestoneAchieved).toBe(true);

    // Verify 4 channels are present in breakdowns
    expect(consolidated.breakdowns).toHaveLength(4);
    const direct = consolidated.breakdowns.find((b) => b.channel === 'direct_sales');
    const enterprise = consolidated.breakdowns.find((b) => b.channel === 'enterprise_deals');
    const affiliate = consolidated.breakdowns.find((b) => b.channel === 'affiliate');
    const seo = consolidated.breakdowns.find((b) => b.channel === 'content_seo');

    expect(direct?.percentageOfTotal).toBe(40.0);
    expect(enterprise?.percentageOfTotal).toBe(35.0);
    expect(affiliate?.percentageOfTotal).toBe(15.0);
    expect(seo?.percentageOfTotal).toBe(10.0);
  });

  it('correctly marks milestone as unachieved when targets are not met', () => {
    // Under-target MRR
    const partialMrr = consolidateMrrChannels({
      periodMonth: '2027-01',
      directSalesCents: 20_000_000,
      affiliateSalesCents: 10_000_000,
      contentSeoCents: 5_000_000,
      enterpriseDealsCents: 15_000_000,
      activeCustomersCount: 5_000,
    });
    expect(partialMrr.totalMrrCents).toBe(50_000_000); // $500k
    expect(partialMrr.progress.mrrAttainmentPct).toBe(50.0);
    expect(partialMrr.progress.isMilestoneAchieved).toBe(false);

    // Under-target customer count (even if MRR meets $1M)
    const partialCustomers = consolidateMrrChannels({
      periodMonth: '2027-08',
      directSalesCents: 50_000_000,
      affiliateSalesCents: 20_000_000,
      contentSeoCents: 10_000_000,
      enterpriseDealsCents: 20_000_000,
      activeCustomersCount: 4_999,
    });
    expect(partialCustomers.totalMrrCents).toBe(100_000_000);
    expect(partialCustomers.progress.customersAttainmentPct).toBe(99.98);
    expect(partialCustomers.progress.isMilestoneAchieved).toBe(false);
  });
});

describe('MRR Consolidation Engine - D1 Persistence & Aggregation', () => {
  let db: D1Database;

  beforeEach(() => {
    db = createTestDb();
  });

  it('saves snapshot to D1 and reads back latest and history', async () => {
    const saved = await saveUnifiedRevenueSnapshot(db, {
      periodMonth: '2027-08',
      directSalesCents: 35_000_000,
      affiliateSalesCents: 12_000_000,
      contentSeoCents: 8_000_000,
      enterpriseDealsCents: 30_000_000,
      activeCustomersCount: 4_200,
      status: 'active',
      snapshotTimestamp: 1000,
    });

    expect(saved.id).toBeDefined();
    expect(saved.totalMrrCents).toBe(85_000_000);
    expect(saved.arpuCents).toBe(Math.floor(85_000_000 / 4_200));

    const latest = await getLatestUnifiedRevenueSnapshot(db);
    expect(latest).not.toBeNull();
    expect(latest?.periodMonth).toBe('2027-08');
    expect(latest?.totalMrrCents).toBe(85_000_000);

    // Save a second snapshot
    await saveUnifiedRevenueSnapshot(db, {
      periodMonth: '2027-09',
      directSalesCents: 40_000_000,
      affiliateSalesCents: 15_000_000,
      contentSeoCents: 10_000_000,
      enterpriseDealsCents: 35_000_000,
      activeCustomersCount: 5_000,
      status: 'reconciled',
      snapshotTimestamp: 2000,
    });

    const history = await getUnifiedRevenueSnapshotsHistory(db, 10);
    expect(history).toHaveLength(2);
    expect(history[0].periodMonth).toBe('2027-09');
    expect(history[1].periodMonth).toBe('2027-08');
  });

  it('aggregates live table data from subscriptions, deals, and partner commissions', async () => {
    // Populate sub tables
    await db.prepare('INSERT INTO subscriptions VALUES (?, ?, ?, ?)').bind('sub_1', 'u_1', 19_900, 'active').run();
    await db.prepare('INSERT INTO subscriptions VALUES (?, ?, ?, ?)').bind('sub_2', 'u_2', 39_900, 'active').run();
    await db.prepare('INSERT INTO enterprise_deals VALUES (?, ?, ?)').bind('deal_1', 100_000, 'closed_won').run();
    await db.prepare('INSERT INTO partner_commissions VALUES (?, ?, ?, ?)').bind('comm_1', 'u_3', 30_000, 'approved').run();

    const snapshot = await aggregateRealtimeMrrFromD1(db, '2027-09');

    expect(snapshot.directSalesCents).toBe(19_900 + 39_900);
    expect(snapshot.enterpriseDealsCents).toBe(100_000);
    expect(snapshot.affiliateSalesCents).toBe(30_000);
    expect(snapshot.totalMrrCents).toBe(19_900 + 39_900 + 100_000 + 30_000);
    expect(snapshot.activeCustomersCount).toBe(4); // 2 subs + 1 deal + 1 referral
  });
});
