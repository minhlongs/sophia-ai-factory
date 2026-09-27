/** @vitest-environment node */

import { describe, it, expect, beforeEach } from 'vitest';
import { createRequire } from 'node:module';
import type { D1Database } from '@cloudflare/workers-types';
import {
  calculateSixNinesUptimeMetrics,
  determineSixNinesBreachTier,
  generateEscrowAuditHash,
  fundSlaEscrow,
  evaluateSixNinesSlaPeriod,
  claimSlaPenalty,
  releaseEscrowToRevenue,
} from '../six-nines-sla-engine';
import {
  GATE_10_CONSTANTS,
  type FundEscrowInput,
} from '@/seed/types/edge-gpu-mesh';

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
    CREATE TABLE IF NOT EXISTS sla_penalty_escrow (
      id TEXT PRIMARY KEY,
      escrow_id TEXT UNIQUE NOT NULL,
      tenant_id TEXT NOT NULL,
      contract_id TEXT NOT NULL,
      period_month TEXT NOT NULL,
      target_sla_pct REAL NOT NULL DEFAULT 99.9999,
      actual_uptime_pct REAL NOT NULL DEFAULT 100.0,
      total_period_seconds INTEGER NOT NULL DEFAULT 2592000,
      allowed_downtime_seconds REAL NOT NULL DEFAULT 2.592,
      downtime_seconds REAL NOT NULL DEFAULT 0.0,
      error_budget_consumed_seconds REAL NOT NULL DEFAULT 0.0,
      error_budget_remaining_seconds REAL NOT NULL DEFAULT 2.592,
      escrow_funded_cents INTEGER NOT NULL DEFAULT 0,
      penalty_claimed_cents INTEGER NOT NULL DEFAULT 0,
      escrow_balance_cents INTEGER NOT NULL DEFAULT 0,
      breach_tier TEXT NOT NULL DEFAULT 'none',
      penalty_pct REAL NOT NULL DEFAULT 0.0,
      escrow_status TEXT NOT NULL DEFAULT 'locked',
      last_breach_timestamp INTEGER,
      audit_hash TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL DEFAULT 0,
      UNIQUE(tenant_id, contract_id, period_month)
    );
  `);

  return {
    prepare(sql: string) {
      const stmt = db.prepare(sql);
      return {
        bind: (...params: unknown[]) => {
          const sanitized = params.map((p) => (p === undefined ? null : p));
          return {
            first: async <T = Record<string, unknown>>() =>
              stmt.get(...sanitized) as T | undefined,
            run: async () => {
              const r = stmt.run(...sanitized);
              return { success: true, meta: { changes: Number(r.changes ?? 0), duration: 0 } };
            },
            all: async <T = Record<string, unknown>>() => {
              return { results: stmt.all(...sanitized) as T[], meta: { changes: 0, duration: 0 } };
            },
          };
        },
        first: async <T = Record<string, unknown>>() =>
          stmt.get() as T | undefined,
        run: async () => {
          const r = stmt.run();
          return { success: true, meta: { changes: Number(r.changes ?? 0), duration: 0 } };
        },
        all: async <T = Record<string, unknown>>() => {
          return { results: stmt.all() as T[], meta: { changes: 0, duration: 0 } };
        },
      };
    },
    exec: async (sql: string) => {
      db.exec(sql);
      return { count: 1, duration: 0 };
    },
    batch: async <T = unknown>(statements: Array<{ run?: () => Promise<unknown> }>): Promise<T[]> => {
      const results: unknown[] = [];
      for (const s of statements) {
        if (typeof s?.run === 'function') {
          results.push(await s.run());
        }
      }
      return results as T[];
    },
  } as unknown as D1Database;
}

describe('Six-Nines (99.9999%) SLA Escrow Engine', () => {
  let db: D1Database;

  beforeEach(() => {
    db = createTestDb();
  });

  describe('calculateSixNinesUptimeMetrics & determineSixNinesBreachTier', () => {
    it('accurately computes 100% uptime for 0s downtime with 2.592s remaining error budget', () => {
      const metrics = calculateSixNinesUptimeMetrics(0.0);

      expect(metrics.targetSlaPct).toBe(99.9999);
      expect(metrics.actualUptimePct).toBe(100.0);
      expect(metrics.allowedDowntimeSeconds).toBe(2.592);
      expect(metrics.errorBudgetRemainingSeconds).toBe(2.592);
      expect(metrics.errorBudgetBurnRatePct).toBe(0.0);
      expect(metrics.breachTier).toBe('none');
      expect(metrics.penaltyPct).toBe(0.0);
    });

    it('honors exact boundary condition at 2.592s allowed downtime with 0% penalty', () => {
      const metrics = calculateSixNinesUptimeMetrics(2.592);

      expect(metrics.actualUptimePct).toBeGreaterThanOrEqual(99.999899);
      expect(metrics.errorBudgetConsumedSeconds).toBe(2.592);
      expect(metrics.errorBudgetRemainingSeconds).toBe(0.0);
      expect(metrics.errorBudgetBurnRatePct).toBe(100.0);
      expect(metrics.breachTier).toBe('none');
      expect(metrics.penaltyPct).toBe(0.0);
    });

    it('triggers minor breach tier at microsecond boundary 2.593s with 15% penalty', () => {
      const metrics = calculateSixNinesUptimeMetrics(2.593);

      expect(metrics.breachTier).toBe('minor');
      expect(metrics.penaltyPct).toBe(15.0);
      expect(metrics.errorBudgetRemainingSeconds).toBe(0.0);
      expect(metrics.errorBudgetBurnRatePct).toBeGreaterThan(100.0);
    });

    it('evaluates tiered breach escalation accurately across all tiers', () => {
      // Minor: 10s (<= 25.92s)
      const minor = determineSixNinesBreachTier(10.0);
      expect(minor.breachTier).toBe('minor');
      expect(minor.penaltyPct).toBe(15.0);

      // Moderate: 100s (<= 259.2s)
      const moderate = determineSixNinesBreachTier(100.0);
      expect(moderate.breachTier).toBe('moderate');
      expect(moderate.penaltyPct).toBe(35.0);

      // Major: 1000s (<= 2592.0s)
      const major = determineSixNinesBreachTier(1000.0);
      expect(major.breachTier).toBe('major');
      expect(major.penaltyPct).toBe(70.0);

      // Catastrophic: 3000s (> 2592.0s)
      const catastrophic = determineSixNinesBreachTier(3000.0);
      expect(catastrophic.breachTier).toBe('catastrophic');
      expect(catastrophic.penaltyPct).toBe(100.0);
    });
  });

  describe('generateEscrowAuditHash', () => {
    it('produces a deterministic 64-character hex SHA-256 hash', async () => {
      const payload = {
        tenantId: 'tenant-acme',
        contractId: 'contract-enterprise-01',
        periodMonth: '2027-09',
        downtimeSeconds: 1.25,
        balanceCents: 500000,
        breachTier: 'none',
      };

      const hash1 = await generateEscrowAuditHash(payload);
      const hash2 = await generateEscrowAuditHash(payload);

      expect(hash1).toHaveLength(64);
      expect(hash1).toMatch(/^[0-9a-f]{64}$/);
      expect(hash1).toBe(hash2);
    });

    it('alters hash upon 1-cent mutation or 1-millisecond variation', async () => {
      const base = {
        tenantId: 'tenant-acme',
        contractId: 'contract-enterprise-01',
        periodMonth: '2027-09',
        downtimeSeconds: 1.25,
        balanceCents: 500000,
        breachTier: 'none',
      };

      const mutated = { ...base, balanceCents: 500001 };
      const hashBase = await generateEscrowAuditHash(base);
      const hashMutated = await generateEscrowAuditHash(mutated);

      expect(hashBase).not.toBe(hashMutated);
    });
  });

  describe('Escrow Lifecycle Management', () => {
    it('funds SLA penalty escrow with 20% deposit of monthly contract value', async () => {
      const input: FundEscrowInput = {
        tenantId: 'tenant-corp-42',
        contractId: 'contract-sla-99',
        periodMonth: '2027-09',
        monthlyContractValueCents: 2_500_000, // $25,000/mo
      };

      const escrow = await fundSlaEscrow(db, input);

      expect(escrow.escrowId).toMatch(/^esc_/);
      expect(escrow.tenantId).toBe('tenant-corp-42');
      expect(escrow.periodMonth).toBe('2027-09');
      expect(escrow.escrowFundedCents).toBe(500_000); // 20% of $25,000 = $5,000 = 500,000 cents
      expect(escrow.escrowBalanceCents).toBe(500_000);
      expect(escrow.breachTier).toBe('none');
      expect(escrow.escrowStatus).toBe('locked');
      expect(escrow.auditHash).toHaveLength(64);
    });

    it('evaluates clean SLA period and preserves 100% escrow balance', async () => {
      await fundSlaEscrow(db, {
        tenantId: 'tenant-clean',
        contractId: 'contract-clean',
        periodMonth: '2027-09',
        monthlyContractValueCents: 1_000_000,
      });

      // 1.5s downtime (< 2.592s threshold)
      const evaluation = await evaluateSixNinesSlaPeriod(
        db,
        'tenant-clean',
        'contract-clean',
        '2027-09',
        1.5,
      );

      expect(evaluation.breachTier).toBe('none');
      expect(evaluation.penaltyCents).toBe(0);
      expect(evaluation.escrowBalanceCents).toBe(200_000); // 20% of 1M
      expect(evaluation.metrics.errorBudgetRemainingSeconds).toBeCloseTo(1.092, 3);
    });

    it('evaluates breach, applies penalty schedule, and updates status', async () => {
      await fundSlaEscrow(db, {
        tenantId: 'tenant-breached',
        contractId: 'contract-breached',
        periodMonth: '2027-09',
        monthlyContractValueCents: 1_000_000, // 200,000 cents escrow
      });

      // 50.0s downtime (Moderate breach: 35% penalty)
      const evaluation = await evaluateSixNinesSlaPeriod(
        db,
        'tenant-breached',
        'contract-breached',
        '2027-09',
        50.0,
      );

      expect(evaluation.breachTier).toBe('moderate');
      expect(evaluation.metrics.penaltyPct).toBe(35.0);
      expect(evaluation.penaltyCents).toBe(70_000); // 35% of 200,000
      expect(evaluation.escrowBalanceCents).toBe(130_000); // 200,000 - 70,000
    });

    it('allows claiming accumulated penalty from escrow', async () => {
      const escrow = await fundSlaEscrow(db, {
        tenantId: 'tenant-claim-test',
        contractId: 'contract-claim-test',
        periodMonth: '2027-09',
        monthlyContractValueCents: 1_000_000,
      });

      // Moderate breach: 35%
      await evaluateSixNinesSlaPeriod(
        db,
        'tenant-claim-test',
        'contract-claim-test',
        '2027-09',
        50.0,
      );

      const claimResult = await claimSlaPenalty(db, escrow.escrowId);

      expect(claimResult.claimedCents).toBe(70_000);
      expect(claimResult.remainingEscrowCents).toBe(130_000);
      expect(claimResult.status).toBe('partially_disbursed');

      // Verify D1 state updated
      const row = await db
        .prepare('SELECT * FROM sla_penalty_escrow WHERE escrow_id = ?')
        .bind(escrow.escrowId)
        .first<{ penalty_claimed_cents: number; escrow_balance_cents: number }>();

      expect(row?.penalty_claimed_cents).toBe(70_000);
      expect(row?.escrow_balance_cents).toBe(130_000);
    });

    it('releases unpenalized escrow fund to recognized enterprise revenue upon clean close', async () => {
      const escrow = await fundSlaEscrow(db, {
        tenantId: 'tenant-release-test',
        contractId: 'contract-release-test',
        periodMonth: '2027-09',
        monthlyContractValueCents: 2_000_000, // 400,000 cents escrow
      });

      // Clean evaluation
      await evaluateSixNinesSlaPeriod(
        db,
        'tenant-release-test',
        'contract-release-test',
        '2027-09',
        0.5,
      );

      const releaseResult = await releaseEscrowToRevenue(db, escrow.escrowId);

      expect(releaseResult.releasedCents).toBe(400_000);
      expect(releaseResult.status).toBe('released_to_revenue');

      // Verify in DB
      const row = await db
        .prepare('SELECT * FROM sla_penalty_escrow WHERE escrow_id = ?')
        .bind(escrow.escrowId)
        .first<{ escrow_balance_cents: number; escrow_status: string }>();

      expect(row?.escrow_balance_cents).toBe(0);
      expect(row?.escrow_status).toBe('released_to_revenue');
    });

    it('throws error when attempting to claim penalty on zero-breach escrow', async () => {
      const escrow = await fundSlaEscrow(db, {
        tenantId: 'tenant-no-breach',
        contractId: 'contract-no-breach',
        periodMonth: '2027-09',
        monthlyContractValueCents: 1_000_000,
      });

      await expect(claimSlaPenalty(db, escrow.escrowId)).rejects.toThrow(
        'No SLA penalty available to claim',
      );
    });
  });
});
