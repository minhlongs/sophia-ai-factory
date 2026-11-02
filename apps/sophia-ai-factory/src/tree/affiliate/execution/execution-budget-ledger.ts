/**
 * Pilot Budget Ledger & Atomic Reservation Helpers for Affiliate Execution Runs.
 *
 * Enforces the proposed Gate 1 cumulative budget ceilings across execution runs:
 * - Per-vertical ceiling (`saas_global` or `crypto_global`): 2500 cents ($25.00)
 * - Total pilot ceiling across all verticals: 5000 cents ($50.00)
 *
 * Cost & Liability State Machine (5 states):
 * 1. Pre-TTS (`state IN ('cancelled','failed')`, `provider_job_id IS NULL`, `actual_cost_cents IS NULL`, `render_attempts = 0`): 0 cents committed.
 * 2. TTS Dispatched / Uncertain (`state = 'blocked'` / `UNCERTAIN_OUTCOME`): full `reserved_cost_cents` stays locked until reconciled.
 * 3. TTS Completed, Render Pre-Submit Failed (`state = 'failed'`, `provider_job_id IS NULL`, `actual_cost_cents IS NOT NULL`): `actual_cost_cents` (incurred TTS cost) stays committed; unused render reserve is released.
 * 4. Render Attempted / Uncertain (`render_attempts > 0` or `provider_job_id IS NOT NULL` or `state = 'blocked'`): full `COALESCE(actual_cost_cents, reserved_cost_cents)` stays locked.
 * 5. Settled (`actual_cost_cents IS NOT NULL` on terminal/reconciled run): `actual_cost_cents` is committed once without double-counting `reserved_cost_cents`.
 *
 * Layer: tree/affiliate/execution
 * @module tree/affiliate/execution/execution-budget-ledger
 */

import {
  DEFAULT_TTS_RESERVE_CENTS,
  PROPOSED_GATE1_TOTAL_CAP_CENTS,
  PROPOSED_GATE1_VERTICAL_CAP_CENTS,
} from '@/seed/config/affiliate-budget-defaults';
import { failure, success, type Result } from '@/seed/types/result';

export type PilotVerticalNiche = 'saas_global' | 'crypto_global';

export interface WorkspacePilotBudgetSummary {
  tenantId: string;
  saasCommittedCents: number;
  cryptoCommittedCents: number;
  unclassifiedCommittedCents: number;
  totalCommittedCents: number;
  verticalCapCents: number;
  totalCapCents: number;
  saasRemainingCents: number;
  cryptoRemainingCents: number;
  totalRemainingCents: number;
}

export interface BudgetCheckInput {
  tenantId: string;
  niche?: PilotVerticalNiche | null;
  requestedCostCents: number;
}

export interface BudgetLedgerError {
  code: string;
  message: string;
}

export function computeTtsReserveCents(reservedCostCents: number): number {
  if (!Number.isFinite(reservedCostCents) || reservedCostCents <= 0) return 0;
  return Math.min(Math.round(reservedCostCents), DEFAULT_TTS_RESERVE_CENTS);
}

export function encodeExecutionMarket(
  market: string | null | undefined,
  niche?: PilotVerticalNiche | null,
): string | null {
  const cleanMarket = market?.trim() ?? '';
  if (niche === 'saas_global' || niche === 'crypto_global') {
    return `${niche}:${cleanMarket}`;
  }
  return cleanMarket || null;
}

export function decodeExecutionMarket(rawMarket: string | null | undefined): {
  market: string | null;
  niche: PilotVerticalNiche | null;
} {
  if (!rawMarket) return { market: null, niche: null };
  if (rawMarket.startsWith('saas_global:')) {
    const rest = rawMarket.slice('saas_global:'.length);
    return { market: rest.length > 0 ? rest : null, niche: 'saas_global' };
  }
  if (rawMarket.startsWith('crypto_global:')) {
    const rest = rawMarket.slice('crypto_global:'.length);
    return { market: rest.length > 0 ? rest : null, niche: 'crypto_global' };
  }
  if (rawMarket === 'saas_global') return { market: null, niche: 'saas_global' };
  if (rawMarket === 'crypto_global') return { market: null, niche: 'crypto_global' };
  return { market: rawMarket, niche: null };
}

export const SQL_COMMITTED_RUN_PREDICATE = `(state NOT IN ('cancelled', 'failed') OR provider_job_id IS NOT NULL OR actual_cost_cents IS NOT NULL OR COALESCE(render_attempts, 0) > 0)`;

export const SQL_CLASSIFY_RUN_NICHE = `(
  CASE
    WHEN market LIKE 'crypto_global:%' OR market = 'crypto_global'
      OR offer_id LIKE '%_cex_%' OR offer_id LIKE '%crypto%'
      OR campaign_id LIKE '%crypto%'
    THEN 'crypto_global'
    WHEN market LIKE 'saas_global:%' OR market = 'saas_global'
      OR offer_id LIKE '%_saas_%' OR offer_id LIKE '%saas%'
      OR campaign_id LIKE '%saas%'
    THEN 'saas_global'
    ELSE 'unclassified'
  END
)`;

export async function getWorkspacePilotBudgetSummary(
  db: D1Database | null,
  tenantId: string,
): Promise<Result<WorkspacePilotBudgetSummary, BudgetLedgerError>> {
  if (!db) return failure({ code: 'DB_UNAVAILABLE', message: 'D1 database binding is null' });
  if (!tenantId) return failure({ code: 'INVALID_INPUT', message: 'tenantId is required' });

  try {
    const rows = await db
      .prepare(
        `SELECT ${SQL_CLASSIFY_RUN_NICHE} AS resolved_niche,
                COALESCE(SUM(COALESCE(actual_cost_cents, reserved_cost_cents)), 0) AS committed_cents
           FROM affiliate_execution_runs
          WHERE tenant_id = ?
            AND ${SQL_COMMITTED_RUN_PREDICATE}
          GROUP BY resolved_niche`,
      )
      .bind(tenantId)
      .all<{ resolved_niche: string; committed_cents: number }>();

    let saasCommittedCents = 0;
    let cryptoCommittedCents = 0;
    let unclassifiedCommittedCents = 0;
    for (const row of rows.results ?? []) {
      const amount = Number(row.committed_cents ?? 0);
      if (row.resolved_niche === 'saas_global') saasCommittedCents += amount;
      else if (row.resolved_niche === 'crypto_global') cryptoCommittedCents += amount;
      else unclassifiedCommittedCents += amount;
    }

    const totalCommittedCents = saasCommittedCents + cryptoCommittedCents + unclassifiedCommittedCents;
    return success({
      tenantId,
      saasCommittedCents,
      cryptoCommittedCents,
      unclassifiedCommittedCents,
      totalCommittedCents,
      verticalCapCents: PROPOSED_GATE1_VERTICAL_CAP_CENTS,
      totalCapCents: PROPOSED_GATE1_TOTAL_CAP_CENTS,
      saasRemainingCents: Math.max(0, PROPOSED_GATE1_VERTICAL_CAP_CENTS - saasCommittedCents),
      cryptoRemainingCents: Math.max(0, PROPOSED_GATE1_VERTICAL_CAP_CENTS - cryptoCommittedCents),
      totalRemainingCents: Math.max(0, PROPOSED_GATE1_TOTAL_CAP_CENTS - totalCommittedCents),
    });
  } catch (err) {
    return failure({
      code: 'DB_ERROR',
      message: err instanceof Error ? err.message : 'unknown D1 error',
    });
  }
}

export async function evaluateCumulativePilotBudget(
  db: D1Database | null,
  input: BudgetCheckInput,
): Promise<Result<WorkspacePilotBudgetSummary, BudgetLedgerError>> {
  if (!Number.isFinite(input.requestedCostCents) || input.requestedCostCents < 0) {
    return failure({ code: 'INVALID_BUDGET', message: 'requestedCostCents must be >= 0' });
  }
  if (input.requestedCostCents > PROPOSED_GATE1_VERTICAL_CAP_CENTS) {
    return failure({
      code: 'BUDGET_CAP_EXCEEDED',
      message: `Requested render budget (${input.requestedCostCents} cents) exceeds the Gate 1 vertical ceiling of ${PROPOSED_GATE1_VERTICAL_CAP_CENTS} cents ($25.00)`,
    });
  }

  const summaryRes = await getWorkspacePilotBudgetSummary(db, input.tenantId);
  if (!summaryRes.ok) return summaryRes;
  const summary = summaryRes.value;

  if (input.niche === 'saas_global' && summary.saasCommittedCents + input.requestedCostCents > summary.verticalCapCents) {
    return failure({
      code: 'BUDGET_CAP_EXCEEDED',
      message: `Cumulative saas_global budget (${summary.saasCommittedCents} + ${input.requestedCostCents} cents) exceeds the Gate 1 vertical ceiling of ${summary.verticalCapCents} cents ($25.00)`,
    });
  }
  if (input.niche === 'crypto_global' && summary.cryptoCommittedCents + input.requestedCostCents > summary.verticalCapCents) {
    return failure({
      code: 'BUDGET_CAP_EXCEEDED',
      message: `Cumulative crypto_global budget (${summary.cryptoCommittedCents} + ${input.requestedCostCents} cents) exceeds the Gate 1 vertical ceiling of ${summary.verticalCapCents} cents ($25.00)`,
    });
  }
  if (summary.totalCommittedCents + input.requestedCostCents > summary.totalCapCents) {
    return failure({
      code: 'BUDGET_CAP_EXCEEDED',
      message: `Cumulative pilot budget (${summary.totalCommittedCents} + ${input.requestedCostCents} cents) exceeds the Gate 1 total ceiling of ${summary.totalCapCents} cents ($50.00)`,
    });
  }

  return success(summary);
}
