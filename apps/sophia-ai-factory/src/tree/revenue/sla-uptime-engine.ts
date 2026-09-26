/**
 * Enterprise SLA Uptime Engine
 *
 * Implements Five-Nines (99.999%) SLA commitment, monthly error budget tracking
 * (exactly 25.92s allowed downtime per 30-day period), and automated penalty credit calculations.
 *
 * Layer: tree/revenue (Domain engine - imports only from @/seed)
 *
 * @module tree/revenue/sla-uptime-engine
 */

import type { D1Database } from '@cloudflare/workers-types';
import {
  type EnterpriseSlaEvaluation,
  type EvaluateSlaInput,
  type SlaBreachLevel,
  type SlaPenaltyStatus,
  GATE_8_CONSTANTS,
} from '@/seed/types/unified-revenue';

interface SlaLedgerDbRow {
  id: string;
  tenant_id: string;
  contract_id: string;
  billing_period: string;
  target_sla_pct: number;
  actual_uptime_pct: number;
  total_period_seconds: number;
  downtime_seconds: number;
  error_budget_allocated_seconds: number;
  error_budget_consumed_seconds: number;
  error_budget_remaining_seconds: number;
  breach_level: string;
  penalty_credit_pct: number;
  penalty_credit_cents: number;
  penalty_status: string;
  incident_ids_json: string;
  evaluated_at: number;
  created_at: number;
  updated_at: number;
}

function mapRowToEvaluation(row: SlaLedgerDbRow): EnterpriseSlaEvaluation {
  let incidentIds: string[] = [];
  try {
    incidentIds = JSON.parse(row.incident_ids_json || '[]') as string[];
  } catch {
    incidentIds = [];
  }

  return {
    id: row.id,
    tenantId: row.tenant_id,
    contractId: row.contract_id,
    billingPeriod: row.billing_period,
    targetSlaPct: Number(row.target_sla_pct),
    actualUptimePct: Number(row.actual_uptime_pct),
    totalPeriodSeconds: Number(row.total_period_seconds),
    downtimeSeconds: Number(row.downtime_seconds),
    errorBudgetAllocatedSeconds: Number(row.error_budget_allocated_seconds),
    errorBudgetConsumedSeconds: Number(row.error_budget_consumed_seconds),
    errorBudgetRemainingSeconds: Number(row.error_budget_remaining_seconds),
    breachLevel: row.breach_level as SlaBreachLevel,
    penaltyCreditPct: Number(row.penalty_credit_pct),
    penaltyCreditCents: Number(row.penalty_credit_cents),
    penaltyStatus: row.penalty_status as SlaPenaltyStatus,
    incidentIds,
    evaluatedAt: Number(row.evaluated_at),
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  };
}

/**
 * Calculates five-nines uptime percentage and error budget consumption.
 */
export function calculateUptimeMetrics(
  downtimeSeconds: number,
  totalPeriodSeconds: number = GATE_8_CONSTANTS.MONTHLY_PERIOD_SECONDS,
): {
  actualUptimePct: number;
  errorBudgetAllocatedSeconds: number;
  errorBudgetConsumedSeconds: number;
  errorBudgetRemainingSeconds: number;
  errorBudgetBurnRatePct: number;
} {
  const sanitizedDowntime = Math.max(0, downtimeSeconds);
  const totalSeconds = Math.max(1, totalPeriodSeconds);

  // Five Nines error budget: 25.92 seconds in a 30-day month (2,592,000 * 0.00001)
  const errorBudgetAllocatedSeconds = Number(
    ((1 - GATE_8_CONSTANTS.FIVE_NINES_SLA_PCT / 100) * totalSeconds).toFixed(2),
  );

  const uptimeSeconds = Math.max(0, totalSeconds - sanitizedDowntime);
  const actualUptimePct = Number(((uptimeSeconds / totalSeconds) * 100).toFixed(5));

  const errorBudgetConsumedSeconds = Number(sanitizedDowntime.toFixed(2));
  const errorBudgetRemainingSeconds = Number(
    Math.max(0, errorBudgetAllocatedSeconds - sanitizedDowntime).toFixed(2),
  );

  const errorBudgetBurnRatePct = errorBudgetAllocatedSeconds > 0
    ? Number(((sanitizedDowntime / errorBudgetAllocatedSeconds) * 100).toFixed(2))
    : 0;

  return {
    actualUptimePct,
    errorBudgetAllocatedSeconds,
    errorBudgetConsumedSeconds,
    errorBudgetRemainingSeconds,
    errorBudgetBurnRatePct,
  };
}

/**
 * Determines SLA breach tier and penalty credit percentage.
 *
 * Rules:
 * - None (Uptime >= 99.999%, downtime <= 25.92s): 0% penalty
 * - Minor (99.99% <= Uptime < 99.999%, 25.92s < downtime <= 259.2s): 10% penalty
 * - Moderate (99.90% <= Uptime < 99.99%, 259.2s < downtime <= 2,592s): 25% penalty
 * - Critical (99.0% <= Uptime < 99.90%, 2,592s < downtime <= 25,920s): 50% penalty
 * - Catastrophic (Uptime < 99.0%, downtime > 25,920s): 100% penalty
 */
export function determineSlaBreachLevel(
  actualUptimePct: number,
  downtimeSeconds: number,
  errorBudgetAllocatedSeconds: number = GATE_8_CONSTANTS.FIVE_NINES_MONTHLY_ERROR_BUDGET_SECONDS,
): {
  breachLevel: SlaBreachLevel;
  penaltyCreditPct: number;
} {
  if (downtimeSeconds <= errorBudgetAllocatedSeconds) {
    return { breachLevel: 'none', penaltyCreditPct: 0.0 };
  }

  // Minor breach: > 25.92s and <= 259.2s (Four Nines tier: 99.99%)
  if (downtimeSeconds <= errorBudgetAllocatedSeconds * 10) {
    return { breachLevel: 'minor', penaltyCreditPct: 10.0 };
  }

  // Moderate breach: > 259.2s and <= 2592s (Three Nines tier: 99.90%)
  if (downtimeSeconds <= errorBudgetAllocatedSeconds * 100) {
    return { breachLevel: 'moderate', penaltyCreditPct: 25.0 };
  }

  // Critical breach: > 2592s (~43.2 minutes)
  const penaltyCreditPct = actualUptimePct < 99.0 ? 100.0 : 50.0;
  return { breachLevel: 'critical', penaltyCreditPct };
}

/**
 * Calculates the exact dollar penalty credit in integer cents.
 */
export function calculatePenaltyCreditCents(
  monthlyContractCents: number,
  penaltyCreditPct: number,
): number {
  if (monthlyContractCents <= 0 || penaltyCreditPct <= 0) return 0;
  return Math.round((monthlyContractCents * penaltyCreditPct) / 100);
}

/**
 * Fully evaluates enterprise tenant SLA uptime for a billing period.
 */
export function evaluateEnterpriseSla(
  input: EvaluateSlaInput & { id?: string; targetSlaPct?: number },
): EnterpriseSlaEvaluation {
  const totalPeriodSeconds = input.totalPeriodSeconds ?? GATE_8_CONSTANTS.MONTHLY_PERIOD_SECONDS;
  const metrics = calculateUptimeMetrics(input.downtimeSeconds, totalPeriodSeconds);
  const { breachLevel, penaltyCreditPct } = determineSlaBreachLevel(
    metrics.actualUptimePct,
    input.downtimeSeconds,
    metrics.errorBudgetAllocatedSeconds,
  );

  const penaltyCreditCents = calculatePenaltyCreditCents(
    input.monthlyContractCents,
    penaltyCreditPct,
  );

  const penaltyStatus: SlaPenaltyStatus = breachLevel === 'none' ? 'none' : 'pending_approval';
  const now = Date.now();
  const id = input.id ?? (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `sla_${now}_${Math.random().toString(36).substring(2, 9)}`);

  return {
    id,
    tenantId: input.tenantId,
    contractId: input.contractId,
    billingPeriod: input.billingPeriod,
    targetSlaPct: input.targetSlaPct ?? GATE_8_CONSTANTS.FIVE_NINES_SLA_PCT,
    actualUptimePct: metrics.actualUptimePct,
    totalPeriodSeconds,
    downtimeSeconds: input.downtimeSeconds,
    errorBudgetAllocatedSeconds: metrics.errorBudgetAllocatedSeconds,
    errorBudgetConsumedSeconds: metrics.errorBudgetConsumedSeconds,
    errorBudgetRemainingSeconds: metrics.errorBudgetRemainingSeconds,
    breachLevel,
    penaltyCreditPct,
    penaltyCreditCents,
    penaltyStatus,
    incidentIds: input.incidentIds ?? [],
    evaluatedAt: now,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Saves or updates an enterprise SLA evaluation record in D1.
 */
export async function saveSlaEvaluation(
  db: D1Database,
  evaluation: EnterpriseSlaEvaluation,
): Promise<EnterpriseSlaEvaluation> {
  const incidentIdsJson = JSON.stringify(evaluation.incidentIds);

  const stmt = db.prepare(`
    INSERT INTO enterprise_sla_ledger (
      id, tenant_id, contract_id, billing_period,
      target_sla_pct, actual_uptime_pct, total_period_seconds,
      downtime_seconds, error_budget_allocated_seconds, error_budget_consumed_seconds, error_budget_remaining_seconds,
      breach_level, penalty_credit_pct, penalty_credit_cents, penalty_status,
      incident_ids_json, evaluated_at, created_at, updated_at
    ) VALUES (
      ?, ?, ?, ?,
      ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?
    )
    ON CONFLICT(id) DO UPDATE SET
      actual_uptime_pct = excluded.actual_uptime_pct,
      downtime_seconds = excluded.downtime_seconds,
      error_budget_consumed_seconds = excluded.error_budget_consumed_seconds,
      error_budget_remaining_seconds = excluded.error_budget_remaining_seconds,
      breach_level = excluded.breach_level,
      penalty_credit_pct = excluded.penalty_credit_pct,
      penalty_credit_cents = excluded.penalty_credit_cents,
      penalty_status = excluded.penalty_status,
      incident_ids_json = excluded.incident_ids_json,
      evaluated_at = excluded.evaluated_at,
      updated_at = excluded.updated_at
  `);

  await stmt
    .bind(
      evaluation.id,
      evaluation.tenantId,
      evaluation.contractId,
      evaluation.billingPeriod,
      evaluation.targetSlaPct,
      evaluation.actualUptimePct,
      evaluation.totalPeriodSeconds,
      evaluation.downtimeSeconds,
      evaluation.errorBudgetAllocatedSeconds,
      evaluation.errorBudgetConsumedSeconds,
      evaluation.errorBudgetRemainingSeconds,
      evaluation.breachLevel,
      evaluation.penaltyCreditPct,
      evaluation.penaltyCreditCents,
      evaluation.penaltyStatus,
      incidentIdsJson,
      evaluation.evaluatedAt,
      evaluation.createdAt,
      evaluation.updatedAt,
    )
    .run();

  return evaluation;
}

/**
 * Retrieves the SLA evaluation for a tenant and billing period.
 */
export async function getSlaEvaluationByTenant(
  db: D1Database,
  tenantId: string,
  billingPeriod: string,
): Promise<EnterpriseSlaEvaluation | null> {
  const row = await db
    .prepare('SELECT * FROM enterprise_sla_ledger WHERE tenant_id = ? AND billing_period = ? LIMIT 1')
    .bind(tenantId, billingPeriod)
    .first<SlaLedgerDbRow>();

  if (!row) return null;
  return mapRowToEvaluation(row);
}

/**
 * Retrieves trailing SLA ledger entries for a tenant.
 */
export async function getSlaLedgerByTenant(
  db: D1Database,
  tenantId: string,
  limit = 12,
): Promise<EnterpriseSlaEvaluation[]> {
  const { results } = await db
    .prepare('SELECT * FROM enterprise_sla_ledger WHERE tenant_id = ? ORDER BY billing_period DESC LIMIT ?')
    .bind(tenantId, limit)
    .all<SlaLedgerDbRow>();

  if (!results) return [];
  return results.map(mapRowToEvaluation);
}

/**
 * Updates the penalty credit status (e.g. approving a credit).
 */
export async function updateSlaPenaltyStatus(
  db: D1Database,
  ledgerId: string,
  status: SlaPenaltyStatus,
): Promise<boolean> {
  const now = Date.now();
  const res = await db
    .prepare('UPDATE enterprise_sla_ledger SET penalty_status = ?, updated_at = ? WHERE id = ?')
    .bind(status, now, ledgerId)
    .run();

  return (res.meta.changes ?? 0) > 0;
}
