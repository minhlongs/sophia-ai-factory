/**
 * Period Dates Inference & D1 Row Mappers
 * Layer: tree/finance
 *
 * @module tree/finance/close/period-mappers
 */

import type {
  FinancialClosePeriod,
  PeriodType,
  IntercompanyTransfer,
} from '@/seed/types/financial-close';
import type { RawPeriodRow, RawTransferRow } from './types';

/**
 * Derive default start and end dates from period key (e.g. '2026-09', '2026-Q3', '2026-FY')
 */
export function inferPeriodDates(
  periodKey: string,
  periodType: PeriodType
): { startDate: string; endDate: string } {
  if (periodType === 'monthly') {
    // Expecting 'YYYY-MM'
    const parts = periodKey.split('-');
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const mm = String(month).padStart(2, '0');
    return {
      startDate: `${year}-${mm}-01`,
      endDate: `${year}-${mm}-${String(lastDay).padStart(2, '0')}`,
    };
  }

  if (periodType === 'quarterly') {
    // e.g. '2026-Q3'
    const [yearStr, qStr] = periodKey.split('-');
    const year = parseInt(yearStr, 10);
    const q = parseInt(qStr.replace('Q', ''), 10);
    const startMonth = (q - 1) * 3 + 1;
    const endMonth = q * 3;
    const lastDay = new Date(Date.UTC(year, endMonth, 0)).getUTCDate();
    return {
      startDate: `${year}-${String(startMonth).padStart(2, '0')}-01`,
      endDate: `${year}-${String(endMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`,
    };
  }

  // Annual '2026-FY' or '2026'
  const yearStr = periodKey.substring(0, 4);
  return {
    startDate: `${yearStr}-01-01`,
    endDate: `${yearStr}-12-31`,
  };
}

export function mapRowToPeriod(row: RawPeriodRow): FinancialClosePeriod {
  return {
    id: row.id,
    orgId: row.org_id,
    periodKey: row.period_key,
    periodType: row.period_type,
    startDate: row.start_date,
    endDate: row.end_date,
    closeStatus: row.close_status,
    closedBy: row.closed_by,
    closedAt: row.closed_at ? Number(row.closed_at) : null,
    totalRecognizedRevenueCents: Number(row.total_recognized_revenue_cents),
    totalDeferredRevenueCents: Number(row.total_deferred_revenue_cents),
    totalRefundsCents: Number(row.total_refunds_cents),
    netRevenueCents: Number(row.net_revenue_cents),
    activeContractsCount: Number(row.active_contracts_count),
    merkleRootHash: row.merkle_root_hash,
    digitalSignature: row.digital_signature,
    complianceFrameworks: row.compliance_frameworks,
    auditOpinion: row.audit_opinion,
    lockReason: row.lock_reason,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  };
}

export function mapRowToTransfer(row: RawTransferRow): IntercompanyTransfer {
  return {
    id: row.id,
    transferReference: row.transfer_reference,
    originEntity: row.origin_entity,
    destinationEntity: row.destination_entity,
    transferType: row.transfer_type,
    currency: row.currency,
    grossAmountCents: Number(row.gross_amount_cents),
    withholdingTaxRegime: row.withholding_tax_regime,
    withholdingTaxRatePct: Number(row.withholding_tax_rate_pct),
    withholdingTaxAmountCents: Number(row.withholding_tax_amount_cents),
    netSettlementCents: Number(row.net_settlement_cents),
    settlementStatus: row.settlement_status,
    reconciliationLedgerId: row.reconciliation_ledger_id,
    approvedBy: row.approved_by,
    transferDate: row.transfer_date,
    settledAt: row.settled_at ? Number(row.settled_at) : null,
    supportingDocsHash: row.supporting_docs_hash,
    notes: row.notes,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  };
}
