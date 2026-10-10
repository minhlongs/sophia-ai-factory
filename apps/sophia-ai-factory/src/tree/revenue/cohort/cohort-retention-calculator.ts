/**
 * Cohort Retention Coordinator & D1 Storage Engine
 *
 * Implements persistence and retrieval of triangular cohort matrices in Cloudflare D1.
 *
 * Layer: tree/revenue/cohort
 */

import type { D1Database } from '@cloudflare/workers-types';
import type {
  CohortRetentionCell,
  CohortTriangularMatrix,
} from '@/seed/types/unified-revenue';
import { type CohortDbRow, mapRowToCell } from './types';
import { buildTriangularCohortMatrix } from './matrix-builder';
import { generateGate8TriangularMatrix } from './decay-curve-fitter';

/**
 * Saves a single cohort retention cell to D1.
 */
export async function saveCohortRetentionCell(
  db: D1Database,
  cell: CohortRetentionCell,
): Promise<CohortRetentionCell> {
  const calculatedAt = cell.calculatedAt || Date.now();
  const id = cell.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `cell_${Date.now()}`);

  const stmt = db.prepare(`
    INSERT INTO cohort_retention_matrix (
      id, cohort_month, period_offset,
      starting_customers, retained_customers, churned_customers,
      starting_mrr_cents, retained_base_mrr_cents, expansion_mrr_cents, contraction_mrr_cents, churned_mrr_cents, ending_mrr_cents,
      grr_pct, nrr_pct, calculated_at
    ) VALUES (
      ?, ?, ?,
      ?, ?, ?,
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?
    )
    ON CONFLICT(cohort_month, period_offset) DO UPDATE SET
      starting_customers = excluded.starting_customers,
      retained_customers = excluded.retained_customers,
      churned_customers = excluded.churned_customers,
      starting_mrr_cents = excluded.starting_mrr_cents,
      retained_base_mrr_cents = excluded.retained_base_mrr_cents,
      expansion_mrr_cents = excluded.expansion_mrr_cents,
      contraction_mrr_cents = excluded.contraction_mrr_cents,
      churned_mrr_cents = excluded.churned_mrr_cents,
      ending_mrr_cents = excluded.ending_mrr_cents,
      grr_pct = excluded.grr_pct,
      nrr_pct = excluded.nrr_pct,
      calculated_at = excluded.calculated_at
  `);

  await stmt
    .bind(
      id,
      cell.cohortMonth,
      cell.periodOffset,
      cell.startingCustomers,
      cell.retainedCustomers,
      cell.churnedCustomers,
      cell.startingMrrCents,
      cell.retainedBaseMrrCents,
      cell.expansionMrrCents,
      cell.contractionMrrCents,
      cell.churnedMrrCents,
      cell.endingMrrCents,
      cell.grrPct,
      cell.nrrPct,
      calculatedAt,
    )
    .run();

  return { ...cell, id, calculatedAt };
}

/**
 * Saves a batch of cohort retention cells into D1.
 */
export async function saveCohortRetentionBatch(
  db: D1Database,
  cells: CohortRetentionCell[],
): Promise<number> {
  let count = 0;
  for (const cell of cells) {
    await saveCohortRetentionCell(db, cell);
    count++;
  }
  return count;
}

/**
 * Queries the cohort matrix from D1 and builds the triangular structure.
 * If database table is empty, initializes with Gate 8 simulation model.
 */
export async function queryCohortMatrix(
  db: D1Database,
  options?: { limitMonths?: number },
): Promise<CohortTriangularMatrix> {
  const limitMonths = options?.limitMonths ?? 12;

  const { results } = await db
    .prepare('SELECT * FROM cohort_retention_matrix ORDER BY cohort_month ASC, period_offset ASC')
    .all<CohortDbRow>();

  if (!results || results.length === 0) {
    // Generate and persist Gate 8 seed matrix
    const simulated = generateGate8TriangularMatrix({ numCohorts: limitMonths });
    await saveCohortRetentionBatch(db, simulated);
    return buildTriangularCohortMatrix(simulated);
  }

  const cells = results.map(mapRowToCell);
  return buildTriangularCohortMatrix(cells);
}
