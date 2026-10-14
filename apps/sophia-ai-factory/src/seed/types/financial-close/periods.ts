/**
 * Period & Revenue Schedule Types
 * Layer: seed
 */

import type {
  AccountingStandard,
  AuditOpinion,
  BillingCycle,
  CloseStatus,
  PeriodType,
  RevenueScheduleTier,
  ScheduleStatus,
} from './enums';

export interface FinancialClosePeriod {
  id: string;
  orgId: string | null;
  periodKey: string;
  periodType: PeriodType;
  startDate: string;
  endDate: string;
  closeStatus: CloseStatus;
  closedBy: string | null;
  closedAt: number | null;
  totalRecognizedRevenueCents: number;
  totalDeferredRevenueCents: number;
  totalRefundsCents: number;
  netRevenueCents: number;
  activeContractsCount: number;
  merkleRootHash: string | null;
  digitalSignature: string | null;
  complianceFrameworks: string;
  auditOpinion: AuditOpinion;
  lockReason: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface RevenueSchedule {
  id: string;
  orgId: string;
  userId: string | null;
  contractId: string;
  tier: RevenueScheduleTier;
  billingCycle: BillingCycle;
  currency: string;
  totalContractValueCents: number;
  recognizedRevenueCents: number;
  deferredRevenueCents: number;
  dailyRecognitionRateCents: number;
  startDate: string;
  endDate: string;
  termDays: number;
  daysRecognized: number;
  accountingStandard: AccountingStandard;
  status: ScheduleStatus;
  lastAccrualDate: string | null;
  metadataJson: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}

export interface PeriodAggregates {
  recognizedRevenueCents: number;
  deferredRevenueCents: number;
  refundsCents: number;
  netRevenueCents: number;
  activeContractsCount: number;
}

export interface AccrualRunResult {
  asOfDate: string;
  schedulesEvaluated: number;
  schedulesAccrued: number;
  totalAccruedCents: number;
  invarianceViolationsCount: number;
  completedSchedulesCount: number;
}

export interface CreateScheduleInput {
  orgId: string;
  userId?: string | null;
  contractId: string;
  tier: RevenueScheduleTier;
  billingCycle: BillingCycle;
  currency?: string;
  customContractValueCents?: number;
  startDate: string; // 'YYYY-MM-DD'
  endDate?: string;   // 'YYYY-MM-DD'
  accountingStandard?: AccountingStandard;
  metadata?: Record<string, unknown>;
}

export interface FinalizePeriodResult {
  period: FinancialClosePeriod;
  merkleRootHash: string;
  digitalSignature: string;
  totalLedgerEvents: number;
  aggregates: PeriodAggregates;
}
