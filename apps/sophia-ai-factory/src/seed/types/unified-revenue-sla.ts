/**
 * Enterprise SLA evaluation and penalty credit ledger types.
 *
 * @module seed/types/unified-revenue-sla
 */

export type SlaBreachLevel = 'none' | 'minor' | 'moderate' | 'critical';

export type SlaPenaltyStatus = 'none' | 'pending_approval' | 'credited' | 'refunded' | 'waived';

/**
 * Enterprise SLA evaluation and penalty credit ledger entry.
 */
export interface EnterpriseSlaEvaluation {
  id: string;
  tenantId: string;
  contractId: string;
  billingPeriod: string; // 'YYYY-MM'
  targetSlaPct: number; // 99.999
  actualUptimePct: number;
  totalPeriodSeconds: number; // 2,592,000 (30 days)
  downtimeSeconds: number;
  errorBudgetAllocatedSeconds: number; // 25.92
  errorBudgetConsumedSeconds: number;
  errorBudgetRemainingSeconds: number;
  breachLevel: SlaBreachLevel;
  penaltyCreditPct: number;
  penaltyCreditCents: number;
  penaltyStatus: SlaPenaltyStatus;
  incidentIds: string[];
  evaluatedAt: number;
  createdAt: number;
  updatedAt: number;
}

/**
 * Input for evaluating tenant SLA uptime.
 */
export interface EvaluateSlaInput {
  tenantId: string;
  contractId: string;
  billingPeriod: string;
  monthlyContractCents: number;
  downtimeSeconds: number;
  totalPeriodSeconds?: number;
  incidentIds?: string[];
}
