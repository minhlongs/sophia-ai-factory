/**
 * @file escrow-types.ts
 * @description SLA metrics, evaluation, and escrow lifecycle interfaces for Edge GPU Mesh.
 * @layer seed
 */

import type { SixNinesBreachTier, EscrowStatus } from './enums';

export interface FundEscrowInput {
  tenantId: string;
  contractId: string;
  periodMonth: string;
  monthlyContractValueCents: number;
  depositPct?: number;
}

export interface SixNinesSlaMetrics {
  targetSlaPct: number;
  actualUptimePct: number;
  totalPeriodSeconds: number;
  allowedDowntimeSeconds: number;
  downtimeSeconds: number;
  errorBudgetAllocatedSeconds: number;
  errorBudgetConsumedSeconds: number;
  errorBudgetRemainingSeconds: number;
  errorBudgetBurnRatePct: number;
  breachTier: SixNinesBreachTier;
  penaltyPct: number;
}

export interface SixNinesEvaluationResult {
  escrowId: string;
  tenantId: string;
  contractId: string;
  periodMonth: string;
  metrics: SixNinesSlaMetrics;
  penaltyCents: number;
  escrowBalanceCents: number;
  breachTier: SixNinesBreachTier;
  evaluatedAt: number;
  auditHash: string;
}

export interface PenaltyClaimResult {
  escrowId: string;
  tenantId: string;
  claimedCents: number;
  remainingEscrowCents: number;
  status: EscrowStatus;
  claimedAt: number;
}

export interface EscrowReleaseResult {
  escrowId: string;
  releasedCents: number;
  status: 'released_to_revenue';
  releasedAt: number;
}
