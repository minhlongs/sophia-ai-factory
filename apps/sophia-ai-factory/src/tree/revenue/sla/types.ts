/**
 * Enterprise SLA Uptime Types & Database Row Mappings
 *
 * @module tree/revenue/sla/types
 */

import {
  type EnterpriseSlaEvaluation,
  type SlaBreachLevel,
  type SlaPenaltyStatus,
} from '@/seed/types/unified-revenue';

export interface SlaLedgerDbRow {
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

export function mapRowToEvaluation(row: SlaLedgerDbRow): EnterpriseSlaEvaluation {
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

export {
  type EnterpriseSlaEvaluation,
  type EvaluateSlaInput,
  type SlaBreachLevel,
  type SlaPenaltyStatus,
  GATE_8_CONSTANTS,
} from '@/seed/types/unified-revenue';
