import { describe, it, expect, beforeEach } from 'vitest';
import { createRequire } from 'node:module';
import type { D1Database } from '@cloudflare/workers-types';
import {
  calculateCohortCell,
  buildTriangularCohortMatrix,
  generateGate8TriangularMatrix,
  saveCohortRetentionCell,
  saveCohortRetentionBatch,
  queryCohortMatrix,
} from '../cohort-retention-calculator';

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
    CREATE TABLE IF NOT EXISTS cohort_retention_matrix (
      id TEXT PRIMARY KEY,
      cohort_month TEXT NOT NULL,
      period_offset INTEGER NOT NULL,
      starting_customers INTEGER NOT NULL,
      retained_customers INTEGER NOT NULL,
      churned_customers INTEGER NOT NULL DEFAULT 0,
      starting_mrr_cents INTEGER NOT NULL,
      retained_base_mrr_cents INTEGER NOT NULL,
      expansion_mrr_cents INTEGER NOT NULL DEFAULT 0,
      contraction_mrr_cents INTEGER NOT NULL DEFAULT 0,
      churned_mrr_cents INTEGER NOT NULL DEFAULT 0,
      ending_mrr_cents INTEGER NOT NULL,
      grr_pct REAL NOT NULL,
      nrr_pct REAL NOT NULL,
      calculated_at INTEGER NOT NULL,
      UNIQUE(cohort_month, period_offset)
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

describe('Cohort Retention Calculator - Mathematical Invariance & Invariants', () => {
  it('strictly caps Gross Revenue Retention (GRR) at 100.0%', () => {
    // Zero contraction or churn
    const perfectCell = calculateCohortCell({
      cohortMonth: '2027-01',
      periodOffset: 3,
      startingCustomers: 100,
      startingMrrCents: 1_000_000,
      expansionMrrCents: 500_000, // Massive expansion
      contractionMrrCents: 0,
      churnedMrrCents: 0,
    });

    expect(perfectCell.grrPct).toBe(100.0);
    expect(perfectCell.grrPct).toBeLessThanOrEqual(100.0);
    // Expansion lifts NRR, not GRR
    expect(perfectCell.nrrPct).toBe(150.0);
  });

  it('correctly calculates GRR degradation and NRR expansion', () => {
    // Starting $10,000. Contraction $500, Churn $1,000. Expansion $4,500.
    // Retained base = $8,500 -> GRR = 85.0%
    // Ending MRR = $8,500 + $4,500 = $13,000 -> NRR = 130.0%
    const cell = calculateCohortCell({
      cohortMonth: '2026-10',
      periodOffset: 6,
      startingCustomers: 200,
      startingMrrCents: 1_000_000, // $10,000
      contractionMrrCents: 50_000, // $500
      churnedMrrCents: 100_000, // $1,000
      expansionMrrCents: 450_000, // $4,500
      churnedCustomers: 10,
    });

    expect(cell.retainedBaseMrrCents).toBe(850_000);
    expect(cell.endingMrrCents).toBe(1_300_000);
    expect(cell.grrPct).toBe(85.0);
    expect(cell.nrrPct).toBe(130.0);
    expect(cell.retainedCustomers).toBe(190);
  });

  it('handles zero starting MRR gracefully without division by zero', () => {
    const emptyCell = calculateCohortCell({
      cohortMonth: '2027-01',
      periodOffset: 0,
      startingCustomers: 0,
      startingMrrCents: 0,
    });

    expect(emptyCell.grrPct).toBe(100.0);
    expect(emptyCell.nrrPct).toBe(100.0);
    expect(emptyCell.endingMrrCents).toBe(0);
  });
});

describe('Cohort Retention Calculator - Triangular Matrix Construction', () => {
  it('builds triangular cohort matrix and validates Gate 8 NRR >= 130% target', () => {
    const simulatedCells = generateGate8TriangularMatrix({
      numCohorts: 12,
      baseCustomersPerCohort: 400,
      baseMrrPerCohortCents: 8_000_000,
    });

    const matrix = buildTriangularCohortMatrix(simulatedCells);

    expect(matrix.cohorts).toHaveLength(12);

    // First cohort has 12 offsets (0 to 11)
    expect(matrix.cohorts[0].offsets).toHaveLength(12);
    // Last cohort has 1 offset (0)
    expect(matrix.cohorts[11].offsets).toHaveLength(1);

    // Invariant: GRR <= 100% across all cells
    for (const cohort of matrix.cohorts) {
      for (const cell of cohort.offsets) {
        expect(cell.grrPct).toBeLessThanOrEqual(100.0);
        expect(cell.grrPct).toBeGreaterThan(0.0);
      }
    }

    // Invariant: NRR >= 130% for Gate 8 simulation model
    expect(matrix.aggregateAverageNrrPct).toBeGreaterThanOrEqual(130.0);
    expect(matrix.targetNrrAchieved).toBe(true);
    expect(matrix.aggregateAverageGrrPct).toBeGreaterThanOrEqual(90.0);
  });
});

describe('Cohort Retention Calculator - D1 Database Persistence & Upsert', () => {
  let db: D1Database;

  beforeEach(() => {
    db = createTestDb();
  });

  it('saves and updates cohort retention cells via upsert', async () => {
    const cell1 = calculateCohortCell({
      cohortMonth: '2027-03',
      periodOffset: 1,
      startingCustomers: 100,
      startingMrrCents: 500_000,
      expansionMrrCents: 100_000,
      contractionMrrCents: 10_000,
      churnedMrrCents: 20_000,
    });

    const saved = await saveCohortRetentionCell(db, cell1);
    expect(saved.id).toBeDefined();

    // Upsert update with higher expansion
    const updatedCell = calculateCohortCell({
      cohortMonth: '2027-03',
      periodOffset: 1,
      startingCustomers: 100,
      startingMrrCents: 500_000,
      expansionMrrCents: 200_000, // expanded further
      contractionMrrCents: 10_000,
      churnedMrrCents: 20_000,
    });

    await saveCohortRetentionCell(db, updatedCell);

    const matrix = await queryCohortMatrix(db);
    const targetCohort = matrix.cohorts.find((c) => c.cohortMonth === '2027-03');
    expect(targetCohort).toBeDefined();
    const offset1 = targetCohort?.offsets.find((o) => o.periodOffset === 1);
    expect(offset1?.expansionMrrCents).toBe(200_000);
    expect(offset1?.nrrPct).toBe(134.0); // ($500k - $30k + $200k) / $500k = 670k / 500k = 1.34 = 134%
  });

  it('initializes and saves Gate 8 simulated cohorts when database is initially empty', async () => {
    const matrix = await queryCohortMatrix(db, { limitMonths: 6 });

    expect(matrix.cohorts).toHaveLength(6);
    expect(matrix.targetNrrAchieved).toBe(true);

    // Verify records were actually saved into D1
    const { results } = await db.prepare('SELECT count(*) as count FROM cohort_retention_matrix').all<{ count: number }>();
    expect(results?.[0]?.count).toBeGreaterThan(0);
  });
});
