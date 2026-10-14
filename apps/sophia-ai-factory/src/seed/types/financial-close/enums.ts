/**
 * Financial Close Enums & Literal Types
 * Layer: seed
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
