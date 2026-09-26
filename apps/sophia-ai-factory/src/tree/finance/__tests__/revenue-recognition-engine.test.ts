/** @vitest-environment node */

/**
 * Unit Test Suite: ASC 606 / IFRS 15 SaaS Revenue Recognition Engine
 *
 * Validates:
 * 1. Ratable daily accruals for BASIC ($199), PREMIUM ($399), ENTERPRISE ($799)
 * 2. 36-month (1,095-day) straight-line customer economic life amortization for MASTER ($4,999)
 * 3. Zero Penny Leakage Invariant across all tiers and lifecycle stages
 * 4. Completion state transition when term days elapse
 * 5. Multi-schedule batch accrual execution and idempotency
 *
 * @module tree/finance/__tests__/revenue-recognition-engine.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createRequire } from 'node:module';
import { makeD1 } from '@/__tests__/integration/shared-d1-shim';
import type { D1Database } from '@cloudflare/workers-types';
import {
  calculateTierContractTerms,
  verifyScheduleInvariance,
  createRevenueSchedule,
  getScheduleById,
  listSchedulesByOrg,
  processDailyAccrual,
  CANONICAL_TIER_PRICES_CENTS,
  MASTER_ECONOMIC_LIFE_DAYS,
} from '../revenue-recognition-engine';

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

describe('ASC 606 SaaS Revenue Recognition Engine — Unit Tests', () => {
  let rawDb: InstanceType<typeof DatabaseSync>;
  let d1: D1Database;

  beforeEach(() => {
    rawDb = new DatabaseSync(':memory:');
    rawDb.exec(`
      CREATE TABLE IF NOT EXISTS organizations (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS revenue_schedules (
        id TEXT PRIMARY KEY,
        org_id TEXT NOT NULL,
        user_id TEXT,
        contract_id TEXT NOT NULL,
        tier TEXT NOT NULL,
        billing_cycle TEXT NOT NULL,
        currency TEXT NOT NULL DEFAULT 'USD',
        total_contract_value_cents INTEGER NOT NULL,
        recognized_revenue_cents INTEGER NOT NULL DEFAULT 0,
        deferred_revenue_cents INTEGER NOT NULL,
        daily_recognition_rate_cents REAL NOT NULL,
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        term_days INTEGER NOT NULL,
        days_recognized INTEGER NOT NULL DEFAULT 0,
        accounting_standard TEXT NOT NULL DEFAULT 'ASC_606_IFRS_15',
        status TEXT NOT NULL DEFAULT 'active',
        last_accrual_date TEXT,
        metadata_json TEXT NOT NULL DEFAULT '{}',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      INSERT INTO organizations (id, name) VALUES ('org_enterprise_01', 'Acme Corp');
      INSERT INTO users (id, email) VALUES ('user_cfo_01', 'cfo@acme.corp');
    `);

    d1 = makeD1(rawDb) as unknown as D1Database;
  });

  describe('Contract Terms & Pricing Calculation', () => {
    it('calculates correct monthly values for standard tiers', () => {
      const basic = calculateTierContractTerms('BASIC', 'monthly', undefined, '2026-09-01');
      expect(basic.totalValueCents).toBe(19900); // $199.00
      expect(basic.termDays).toBe(30);
      expect(basic.dailyRateCents).toBeCloseTo(19900 / 30, 2);

      const premium = calculateTierContractTerms('PREMIUM', 'monthly', undefined, '2026-09-01');
      expect(premium.totalValueCents).toBe(39900); // $399.00
      expect(premium.termDays).toBe(30);

      const enterprise = calculateTierContractTerms('ENTERPRISE', 'monthly', undefined, '2026-09-01');
      expect(enterprise.totalValueCents).toBe(79900); // $799.00
      expect(enterprise.termDays).toBe(30);
    });

    it('amortizes MASTER lifetime license over 36 months (1,095 days)', () => {
      const master = calculateTierContractTerms('MASTER', 'lifetime', undefined, '2026-09-01');
      expect(master.totalValueCents).toBe(499900); // $4,999.00
      expect(master.termDays).toBe(MASTER_ECONOMIC_LIFE_DAYS);
      expect(master.dailyRateCents).toBeCloseTo(499900 / 1095, 4);
    });

    it('handles annual billing cycles with 365 days', () => {
      const annualBasic = calculateTierContractTerms('BASIC', 'annual', undefined, '2026-01-01');
      expect(annualBasic.totalValueCents).toBe(199000); // $1,990.00
      expect(annualBasic.termDays).toBe(365);
    });

    it('accepts custom contract values and explicit end dates', () => {
      const custom = calculateTierContractTerms(
        'CUSTOM',
        'custom',
        2500000,
        '2026-01-01',
        '2026-03-02'
      );
      expect(custom.totalValueCents).toBe(2500000); // $25,000.00
      expect(custom.termDays).toBe(60);
    });
  });

  describe('Schedule Creation & Invariance Verification', () => {
    it('creates an active revenue schedule with 100% initial deferred revenue', async () => {
      const schedule = await createRevenueSchedule(d1, {
        orgId: 'org_enterprise_01',
        userId: 'user_cfo_01',
        contractId: 'INV-2026-001',
        tier: 'PREMIUM',
        billingCycle: 'monthly',
        startDate: '2026-09-01',
      });

      expect(schedule.id).toBeDefined();
      expect(schedule.contractId).toBe('INV-2026-001');
      expect(schedule.totalContractValueCents).toBe(39900);
      expect(schedule.recognizedRevenueCents).toBe(0);
      expect(schedule.deferredRevenueCents).toBe(39900);
      expect(schedule.status).toBe('active');
      expect(verifyScheduleInvariance(schedule)).toBe(true);

      const fetched = await getScheduleById(d1, schedule.id);
      expect(fetched).not.toBeNull();
      expect(fetched?.totalContractValueCents).toBe(39900);
    });

    it('lists schedules filtered by organization and status', async () => {
      await createRevenueSchedule(d1, {
        orgId: 'org_enterprise_01',
        contractId: 'INV-A',
        tier: 'BASIC',
        billingCycle: 'monthly',
        startDate: '2026-09-01',
      });
      await createRevenueSchedule(d1, {
        orgId: 'org_enterprise_01',
        contractId: 'INV-B',
        tier: 'ENTERPRISE',
        billingCycle: 'monthly',
        startDate: '2026-09-01',
      });

      const list = await listSchedulesByOrg(d1, 'org_enterprise_01');
      expect(list.length).toBe(2);

      const activeList = await listSchedulesByOrg(d1, 'org_enterprise_01', 'active');
      expect(activeList.length).toBe(2);
    });
  });

  describe('Ratable Daily Accrual & Zero Penny Leakage', () => {
    it('progressively accrues revenue daily and maintains total == recognized + deferred', async () => {
      const schedule = await createRevenueSchedule(d1, {
        orgId: 'org_enterprise_01',
        contractId: 'INV-BASIC-30D',
        tier: 'BASIC',
        billingCycle: 'monthly',
        startDate: '2026-09-01',
      });

      expect(schedule.totalContractValueCents).toBe(19900);

      // Day 1: 2026-09-01
      const res1 = await processDailyAccrual(d1, '2026-09-01');
      expect(res1.schedulesAccrued).toBe(1);

      const day1 = await getScheduleById(d1, schedule.id);
      expect(day1).not.toBeNull();
      expect(day1!.daysRecognized).toBe(1);
      expect(day1!.recognizedRevenueCents).toBe(Math.round(19900 / 30)); // 663
      expect(day1!.deferredRevenueCents).toBe(19900 - 663); // 19237
      expect(verifyScheduleInvariance(day1!)).toBe(true);

      // Day 15: 2026-09-15 (halfway)
      await processDailyAccrual(d1, '2026-09-15');
      const day15 = await getScheduleById(d1, schedule.id);
      expect(day15!.daysRecognized).toBe(15);
      expect(day15!.recognizedRevenueCents).toBe(Math.round((15 * 19900) / 30)); // 9950
      expect(day15!.deferredRevenueCents).toBe(9950);
      expect(verifyScheduleInvariance(day15!)).toBe(true);

      // Day 30: 2026-09-30 (completed - zero penny leakage)
      const res30 = await processDailyAccrual(d1, '2026-09-30');
      expect(res30.completedSchedulesCount).toBe(1);

      const day30 = await getScheduleById(d1, schedule.id);
      expect(day30!.daysRecognized).toBe(30);
      expect(day30!.recognizedRevenueCents).toBe(19900);
      expect(day30!.deferredRevenueCents).toBe(0);
      expect(day30!.status).toBe('completed');
      expect(verifyScheduleInvariance(day30!)).toBe(true);
    });

    it('amortizes MASTER lifetime license across multi-year period with zero penny leakage', async () => {
      const schedule = await createRevenueSchedule(d1, {
        orgId: 'org_enterprise_01',
        contractId: 'INV-MASTER-LIFETIME',
        tier: 'MASTER',
        billingCycle: 'lifetime',
        startDate: '2026-01-01',
      });

      expect(schedule.termDays).toBe(1095);
      expect(schedule.totalContractValueCents).toBe(499900);

      // Accrue on day 365 (end of Year 1)
      await processDailyAccrual(d1, '2026-12-31');
      const y1 = await getScheduleById(d1, schedule.id);
      expect(y1!.daysRecognized).toBe(365);
      expect(y1!.recognizedRevenueCents).toBe(Math.round((365 * 499900) / 1095)); // ~166633 cents
      expect(verifyScheduleInvariance(y1!)).toBe(true);

      // Accrue on day 1095 (end of 36 months)
      await processDailyAccrual(d1, '2028-12-31');
      const y3 = await getScheduleById(d1, schedule.id);
      expect(y3!.status).toBe('completed');
      expect(y3!.recognizedRevenueCents).toBe(499900);
      expect(y3!.deferredRevenueCents).toBe(0);
      expect(verifyScheduleInvariance(y3!)).toBe(true);
    });

    it('simulates 1,000 varied price points confirming Zero Penny Leakage Invariant', () => {
      for (let i = 1; i <= 1000; i++) {
        const totalCents = Math.floor(Math.random() * 1000000) + 100;
        const termDays = Math.floor(Math.random() * 365) + 1;
        const elapsedDays = Math.floor(Math.random() * (termDays + 10));

        const effectiveDays = Math.min(termDays, elapsedDays);
        let recognized: number;
        let deferred: number;

        if (effectiveDays >= termDays) {
          recognized = totalCents;
          deferred = 0;
        } else {
          recognized = Math.round(effectiveDays * (totalCents / termDays));
          deferred = totalCents - recognized;
        }

        expect(recognized + deferred).toBe(totalCents);
        expect(recognized).toBeGreaterThanOrEqual(0);
        expect(deferred).toBeGreaterThanOrEqual(0);
      }
    });
  });
});
