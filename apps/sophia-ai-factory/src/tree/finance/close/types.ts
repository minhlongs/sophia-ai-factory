/**
 * Multi-Org Financial Close Types & Internal Database Row Schemas
 * Layer: tree/finance
 *
 * @module tree/finance/close/types
 */

import type {
  FinancialClosePeriod,
  PeriodType,
  CloseStatus,
  AuditOpinion,
  PeriodAggregates,
  FinalizePeriodResult,
  IntercompanyTransfer,
  RecordTransferInput,
  WithholdingTaxRegime,
  IntercompanyEntity,
  SettlementStatus,
  VasAccountCode,
} from '@/seed/types/financial-close';

export type {
  FinancialClosePeriod,
  PeriodType,
  CloseStatus,
  AuditOpinion,
  PeriodAggregates,
  FinalizePeriodResult,
  IntercompanyTransfer,
  RecordTransferInput,
  WithholdingTaxRegime,
  IntercompanyEntity,
  SettlementStatus,
  VasAccountCode,
};

export interface VasJournalEntry {
  account: VasAccountCode;
  debitCents: number;
  creditCents: number;
  description: string;
}

export interface RawPeriodRow {
  id: string;
  org_id: string | null;
  period_key: string;
  period_type: PeriodType;
  start_date: string;
  end_date: string;
  close_status: CloseStatus;
  closed_by: string | null;
  closed_at: number | null;
  total_recognized_revenue_cents: number;
  total_deferred_revenue_cents: number;
  total_refunds_cents: number;
  net_revenue_cents: number;
  active_contracts_count: number;
  merkle_root_hash: string | null;
  digital_signature: string | null;
  compliance_frameworks: string;
  audit_opinion: AuditOpinion;
  lock_reason: string | null;
  created_at: number;
  updated_at: number;
}

export interface RawTransferRow {
  id: string;
  transfer_reference: string;
  origin_entity: IntercompanyEntity;
  destination_entity: IntercompanyEntity;
  transfer_type: RecordTransferInput['transferType'];
  currency: string;
  gross_amount_cents: number;
  withholding_tax_regime: WithholdingTaxRegime;
  withholding_tax_rate_pct: number;
  withholding_tax_amount_cents: number;
  net_settlement_cents: number;
  settlement_status: SettlementStatus;
  reconciliation_ledger_id: string | null;
  approved_by: string | null;
  transfer_date: string;
  settled_at: number | null;
  supporting_docs_hash: string | null;
  notes: string | null;
  created_at: number;
  updated_at: number;
}
