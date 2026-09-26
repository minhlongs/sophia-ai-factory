import { describe, it, expect, beforeEach } from 'vitest';
import { createRequire } from 'node:module';
import type { D1Database } from '@cloudflare/workers-types';
import {
  calculateUptimeMetrics,
  determineSlaBreachLevel,
  calculatePenaltyCreditCents,
  evaluateEnterpriseSla,
  saveSlaEvaluation,
  getSlaEvaluationByTenant,
  getSlaLedgerByTenant,
  updateSlaPenaltyStatus,
} from '../sla-uptime-engine';
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
    CREATE TABLE IF NOT EXISTS enterprise_sla_ledger (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      contract_id TEXT NOT NULL,
      billing_period TEXT NOT NULL,
      target_sla_pct REAL NOT NULL DEFAULT 99.999,
      actual_uptime_pct REAL NOT NULL,
      total_period_seconds INTEGER NOT NULL DEFAULT 2592000,
      downtime_seconds REAL NOT NULL DEFAULT 0.0,
      error_budget_allocated_seconds REAL NOT NULL DEFAULT 25.92,
      error_budget_consumed_seconds REAL NOT NULL DEFAULT 0.0,
      error_budget_remaining_seconds REAL NOT NULL DEFAULT 25.92,
      breach_level TEXT NOT NULL DEFAULT 'none',
      penalty_credit_pct REAL NOT NULL DEFAULT 0.0,
      penalty_credit_cents INTEGER NOT NULL DEFAULT 0,
      penalty_status TEXT NOT NULL DEFAULT 'none',
      incident_ids_json TEXT NOT NULL DEFAULT '[]',
      evaluated_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
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

describe('Enterprise SLA Uptime Engine - Five-Nines Error Budget Mechanics', () => {
  it('allocates exactly 25.92 seconds monthly error budget for 99.999% SLA', () => {
    const zeroDowntime = calculateUptimeMetrics(0);

    expect(zeroDowntime.errorBudgetAllocatedSeconds).toBe(25.92);
    expect(zeroDowntime.errorBudgetConsumedSeconds).toBe(0);
    expect(zeroDowntime.errorBudgetRemainingSeconds).toBe(25.92);
    expect(zeroDowntime.actualUptimePct).toBe(100.0);
    expect(zeroDowntime.errorBudgetBurnRatePct).toBe(0.0);
  });

  it('accurately burns error budget during partial downtime events', () => {
    // 12.96 seconds downtime = exactly 50% error budget consumed
    const halfBudget = calculateUptimeMetrics(12.96);

    expect(halfBudget.errorBudgetConsumedSeconds).toBe(12.96);
    expect(halfBudget.errorBudgetRemainingSeconds).toBe(12.96);
    expect(halfBudget.errorBudgetBurnRatePct).toBe(50.0);
    expect(halfBudget.actualUptimePct).toBeGreaterThan(99.999);
  });

  it('exhausts error budget at exactly 25.92 seconds without breaching', () => {
    const fullBudget = calculateUptimeMetrics(25.92);

    expect(fullBudget.errorBudgetConsumedSeconds).toBe(25.92);
    expect(fullBudget.errorBudgetRemainingSeconds).toBe(0);
    expect(fullBudget.errorBudgetBurnRatePct).toBe(100.0);
    expect(fullBudget.actualUptimePct).toBe(GATE_8_CONSTANTS.FIVE_NINES_SLA_PCT);

    const breach = determineSlaBreachLevel(fullBudget.actualUptimePct, 25.92);
    expect(breach.breachLevel).toBe('none');
    expect(breach.penaltyCreditPct).toBe(0.0);
  });
});

describe('Enterprise SLA Uptime Engine - Breach Tiering & Automated Penalty Credits', () => {
  it('classifies Minor Breach (Four-Nines tier) and awards 10% credit', () => {
    // 100 seconds downtime (> 25.92s and <= 259.2s)
    const metrics = calculateUptimeMetrics(100);
    const breach = determineSlaBreachLevel(metrics.actualUptimePct, 100);

    expect(breach.breachLevel).toBe('minor');
    expect(breach.penaltyCreditPct).toBe(10.0);

    // On $5,000 monthly contract (500,000 cents) -> 10% = 50,000 cents ($500)
    const credit = calculatePenaltyCreditCents(500_000, breach.penaltyCreditPct);
    expect(credit).toBe(50_000);
  });

  it('classifies Moderate Breach (Three-Nines tier) and awards 25% credit', () => {
    // 1,000 seconds downtime (> 259.2s and <= 2,592s)
    const metrics = calculateUptimeMetrics(1_000);
    const breach = determineSlaBreachLevel(metrics.actualUptimePct, 1_000);

    expect(breach.breachLevel).toBe('moderate');
    expect(breach.penaltyCreditPct).toBe(25.0);

    // On $10,000 monthly contract (1,000,000 cents) -> 25% = 250,000 cents ($2,500)
    const credit = calculatePenaltyCreditCents(1_000_000, breach.penaltyCreditPct);
    expect(credit).toBe(250_000);
  });

  it('classifies Critical Breach (> 2,592s downtime) and awards 50% credit', () => {
    // 3,000 seconds downtime (~50 mins)
    const metrics = calculateUptimeMetrics(3_000);
    const breach = determineSlaBreachLevel(metrics.actualUptimePct, 3_000);

    expect(breach.breachLevel).toBe('critical');
    expect(breach.penaltyCreditPct).toBe(50.0);

    // On $20,000 monthly contract (2,000,000 cents) -> 50% = 1,000,000 cents ($10,000)
    const credit = calculatePenaltyCreditCents(2_000_000, breach.penaltyCreditPct);
    expect(credit).toBe(1_000_000);
  });

  it('awards 100% full month credit for catastrophic downtime (< 99.0% uptime)', () => {
    // 30,000 seconds downtime (~8.3 hours down, uptime ~98.84%)
    const metrics = calculateUptimeMetrics(30_000);
    expect(metrics.actualUptimePct).toBeLessThan(99.0);

    const breach = determineSlaBreachLevel(metrics.actualUptimePct, 30_000);
    expect(breach.breachLevel).toBe('critical');
    expect(breach.penaltyCreditPct).toBe(100.0);

    const credit = calculatePenaltyCreditCents(1_000_000, breach.penaltyCreditPct);
    expect(credit).toBe(1_000_000);
  });
});

describe('Enterprise SLA Uptime Engine - D1 Ledger Persistence & Workflows', () => {
  let db: D1Database;

  beforeEach(() => {
    db = createTestDb();
  });

  it('evaluates SLA, stores ledger entry, and handles penalty credit approval', async () => {
    const evaluation = evaluateEnterpriseSla({
      tenantId: 'org_enterprise_acme',
      contractId: 'contract_acme_2027',
      billingPeriod: '2027-09',
      monthlyContractCents: 1_500_000, // $15,000 / month
      downtimeSeconds: 150, // Minor breach
      incidentIds: ['inc_edge_us_east_1', 'inc_circuit_break_2'],
    });

    expect(evaluation.breachLevel).toBe('minor');
    expect(evaluation.penaltyCreditPct).toBe(10.0);
    expect(evaluation.penaltyCreditCents).toBe(150_000); // $1,500 credit
    expect(evaluation.penaltyStatus).toBe('pending_approval');
    expect(evaluation.incidentIds).toHaveLength(2);

    await saveSlaEvaluation(db, evaluation);

    const retrieved = await getSlaEvaluationByTenant(db, 'org_enterprise_acme', '2027-09');
    expect(retrieved).not.toBeNull();
    expect(retrieved?.tenantId).toBe('org_enterprise_acme');
    expect(retrieved?.penaltyCreditCents).toBe(150_000);
    expect(retrieved?.incidentIds).toEqual(['inc_edge_us_east_1', 'inc_circuit_break_2']);

    // Approve credit
    const approved = await updateSlaPenaltyStatus(db, evaluation.id, 'credited');
    expect(approved).toBe(true);

    const afterApproval = await getSlaEvaluationByTenant(db, 'org_enterprise_acme', '2027-09');
    expect(afterApproval?.penaltyStatus).toBe('credited');
  });

  it('retrieves trailing SLA ledger history for a tenant', async () => {
    const periods = ['2027-07', '2027-08', '2027-09'];
    for (const p of periods) {
      const evalItem = evaluateEnterpriseSla({
        tenantId: 'org_fintech_asia',
        contractId: 'contract_fintech_asia',
        billingPeriod: p,
        monthlyContractCents: 800_000,
        downtimeSeconds: 10, // within budget
      });
      await saveSlaEvaluation(db, evalItem);
    }

    const history = await getSlaLedgerByTenant(db, 'org_fintech_asia', 5);
    expect(history).toHaveLength(3);
    expect(history[0].billingPeriod).toBe('2027-09');
    expect(history[0].breachLevel).toBe('none');
  });
});
