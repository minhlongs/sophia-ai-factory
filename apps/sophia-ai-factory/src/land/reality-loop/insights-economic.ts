/**
 * Economic snapshot accessor — Phase H creative_economic_snapshot.
 *
 * Split from insights.ts to keep each module ≤200 LOC. Reads the latest
 * workspace snapshot (migration 0263) and derives netCents / roiPct in JS.
 *
 * Migration 0263 columns: id, workspace_id, mission_id, creative_cost,
 * production_cost, distribution_cost, leads, conversions, revenue,
 * recorded_at. There is deliberately NO net_cents / roi_pct column — ROI is
 * computed by callers that choose to, never stored.
 *
 * Missing data is null, never 0: a workspace with no snapshot row, or a row
 * with all-NULL costs, yields all-null outcomes.
 *
 * @module land/reality-loop/insights-economic
 */

import { createServerClient } from '@/seed/db/client';
import { computeRoi } from '@/land/creative-economy/roi-modeling';
import { type EconomicOutcomes } from './insights';

/**
 * Total cost = creative_cost + production_cost + distribution_cost.
 * All three are nullable per migration 0263; when all are NULL the total is
 * NULL (no signal), not 0.
 */
function sumCost(
  creative: number | null,
  production: number | null,
  distribution: number | null,
): number | null {
  if (creative === null && production === null && distribution === null) {
    return null;
  }
  return (creative ?? 0) + (production ?? 0) + (distribution ?? 0);
}

/**
 * Read the latest economic outcomes for one workspace. Gracefully returns
 * an all-null snapshot when the Phase H table is absent or empty.
 */
export async function getEconomicOutcomes(
  db: ReturnType<typeof createServerClient>,
  workspaceId: string,
): Promise<EconomicOutcomes> {
  const nullEconomic: EconomicOutcomes = {
    revenueCents: null,
    costCents: null,
    netCents: null,
    roiPct: null,
  };
  try {
    const row = await db
      .prepare(
        `SELECT creative_cost, production_cost, distribution_cost, revenue
         FROM creative_economic_snapshot
         WHERE workspace_id = ?1
         ORDER BY recorded_at DESC
         LIMIT 1`,
      )
      .bind(workspaceId)
      .first<{
        creative_cost: number | null;
        production_cost: number | null;
        distribution_cost: number | null;
        revenue: number | null;
      }>();
    if (!row) return nullEconomic;

    const revenueCents = row.revenue ?? null;
    const costCents = sumCost(row.creative_cost, row.production_cost, row.distribution_cost);
    const netCents =
      revenueCents !== null && costCents !== null ? revenueCents - costCents : null;
    const roiPct =
      revenueCents !== null && costCents !== null ? computeRoi(revenueCents, costCents) : null;

    return { revenueCents, costCents, netCents, roiPct };
  } catch {
    // Table absent (Phase H not yet deployed) → null, never throw.
    return nullEconomic;
  }
}