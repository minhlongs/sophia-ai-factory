/**
 * Enterprise SLA D1 Ledger Persistence & Query Helpers
 *
 * @module tree/revenue/sla/sla-credit-helpers
 */

import type { D1Database } from '@cloudflare/workers-types';
import {
  type EnterpriseSlaEvaluation,
  type SlaLedgerDbRow,
  type SlaPenaltyStatus,
  mapRowToEvaluation,
} from './types';

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
