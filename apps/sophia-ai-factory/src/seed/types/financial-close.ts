/**
 * Enterprise Financial Close & IPO-Ready Audit Governance Type Definitions
 *
 * Implements ASC 606 / IFRS 15, Vietnam VAS TT200 Chart of Accounts,
 * SEC Form S-1 Audit Vault, SOX 404 controls, and Cross-Border Intercompany Settlement.
 *
 * Layer: seed (Foundational types, zero upper-layer imports)
 *
 * @module seed/types/financial-close
 */

export type CloseStatus = 'open' | 'closing' | 'closed' | 'locked' | 'audited' | 'reopened';

export type PeriodType = 'monthly' | 'quarterly' | 'annual';

export type AuditOpinion = 'unqualified' | 'qualified' | 'adverse' | 'disclaimer' | 'pending';

export type RevenueScheduleTier = 'BASIC' | 'PREMIUM' | 'ENTERPRISE' | 'MASTER' | 'CUSTOM';

export type BillingCycle = 'monthly' | 'annual' | 'lifetime' | 'custom';

export type ScheduleStatus = 'active' | 'completed' | 'paused' | 'cancelled' | 'refunded';

export type AccountingStandard = 'ASC_606_IFRS_15' | 'VAS_TT200' | 'HYBRID_DUAL_LEDGER';

export type IntercompanyEntity =
  | 'SOPHIA_GLOBAL_INC'
  | 'SOPHIA_VN_CO_LTD'
  | 'SOPHIA_SG_PTE_LTD'
  | 'SOPHIA_EU_BV'
  | 'SOPHIA_PARTNER_FEDERATION';

export type TransferType =
  | 'ip_license_royalty'
  | 'service_fee'
  | 'cost_sharing_recharge'
  | 'mcu_compute_rebill'
  | 'dividend_distribution';

export type WithholdingTaxRegime =
  | 'VN_FCT_10PCT'
  | 'VN_FCT_5PCT'
  | 'US_W8_30PCT'
  | 'US_W8_TREATY_0PCT'
  | 'SG_DTA_EXEMPT'
  | 'NONE';

export type SettlementStatus =
  | 'pending'
  | 'approved'
  | 'reconciled'
  | 'settled'
  | 'disputed'
  | 'cancelled';

export type AuditEventType =
  | 'REVENUE_SCHEDULE_CREATED'
  | 'REVENUE_DAILY_ACCRUED'
  | 'PERIOD_PRE_CLOSE_AUDIT'
  | 'PERIOD_CLOSED'
  | 'PERIOD_LOCKED'
  | 'INTERCOMPANY_TRANSFER_POSTED'
  | 'INTERCOMPANY_RECONCILED'
  | 'REFUND_REVERSAL_POSTED'
  | 'MERKLE_ROOT_ANCHORED'
  | 'SOX_CONTROL_CERTIFIED';

export type EventScope = 'entity_level' | 'consolidated_group' | 'system_wide';

export type ActorRole =
  | 'SYSTEM'
  | 'CFO'
  | 'CONTROLLER'
  | 'EXTERNAL_AUDITOR'
  | 'SOX_COMPLIANCE_OFFICER';

export type SoxControlId =
  | 'CC-1.1'
  | 'CC-2.1'
  | 'CC-3.2'
  | 'CC-5.1'
  | 'AC-4.1'
  | 'AC-6.2'
  | 'NONE';

export type VasAccountCode = '112' | '3387' | '511' | '136' | '336' | '3338' | '642';

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

export interface IntercompanyTransfer {
  id: string;
  transferReference: string;
  originEntity: IntercompanyEntity;
  destinationEntity: IntercompanyEntity;
  transferType: TransferType;
  currency: string;
  grossAmountCents: number;
  withholdingTaxRegime: WithholdingTaxRegime;
  withholdingTaxRatePct: number;
  withholdingTaxAmountCents: number;
  netSettlementCents: number;
  settlementStatus: SettlementStatus;
  reconciliationLedgerId: string | null;
  approvedBy: string | null;
  transferDate: string;
  settledAt: number | null;
  supportingDocsHash: string | null;
  notes: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface IpoAuditLedgerRecord {
  id: string;
  sequenceNumber: number;
  periodKey: string;
  orgId: string | null;
  eventType: AuditEventType;
  eventScope: EventScope;
  actorId: string;
  actorRole: ActorRole;
  amountCents: number;
  payloadCanonicalJson: string;
  prevHash: string;
  contentHash: string;
  merkleLeafHash: string;
  digitalSignature: string;
  soxControlId: SoxControlId;
  vasAccountCode: string | null;
  timestamp: number;
  createdAt: number;
}

export interface MerkleProof {
  rootHash: string;
  leafHash: string;
  index: number;
  totalLeaves: number;
  proofHashes: string[];
  proofDirections: ('left' | 'right')[];
  isValid: boolean;
}

export interface LedgerIntegrityResult {
  isValid: boolean;
  totalRecordsChecked: number;
  genesisHashValid: boolean;
  brokenSequenceIndex: number | null;
  tamperedRecordId: string | null;
  computedMerkleRoot: string | null;
  anchoredMerkleRoot: string | null;
  discrepancies: string[];
}

export interface FormS1AuditPack {
  periodKey: string;
  periodType: PeriodType;
  startDate: string;
  endDate: string;
  closeStatus: CloseStatus;
  auditOpinion: AuditOpinion;
  financialMetrics: {
    totalGrossContractValueCents: number;
    recognizedRevenueCents: number;
    deferredRevenueCents: number;
    refundsCents: number;
    netRevenueCents: number;
    activeContractsCount: number;
  };
  intercompanySummary: {
    totalTransfersCount: number;
    grossTransfersCents: number;
    totalWithholdingTaxCents: number;
    netSettledCents: number;
  };
  merkleVerification: {
    rootHash: string;
    digitalSignature: string;
    totalAuditedEvents: number;
    integrityVerified: boolean;
  };
  soxComplianceAttestation: {
    controlsEvaluated: SoxControlId[];
    attestationTimestamp: number;
    signOffStatus: 'CERTIFIED' | 'EXCEPTION_NOTED';
  };
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

export interface RecordTransferInput {
  originEntity: IntercompanyEntity;
  destinationEntity: IntercompanyEntity;
  transferType: TransferType;
  currency?: string;
  grossAmountCents: number;
  withholdingTaxRegime: WithholdingTaxRegime;
  transferDate: string;
  notes?: string;
  supportingDocsHash?: string;
}

export interface FinalizePeriodResult {
  period: FinancialClosePeriod;
  merkleRootHash: string;
  digitalSignature: string;
  totalLedgerEvents: number;
  aggregates: PeriodAggregates;
}
