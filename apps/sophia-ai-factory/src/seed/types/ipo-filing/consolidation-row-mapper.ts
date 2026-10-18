/**
 * @file consolidation-row-mapper.ts
 * @description Safe database row mapper converting MultiEntityConsolidationRow to MultiEntityConsolidation.
 * @layer seed
 */

import type {
  ConsolidationEntityCode,
  ConsolidationStatus,
  CtaBalanceType,
  FunctionalCurrency,
} from './constants-enums';
import type { MultiEntityConsolidationRow } from './db-models';
import type { MultiEntityConsolidation } from './domain-models';

export function mapRowToMultiEntityConsolidation(
  row: MultiEntityConsolidationRow
): MultiEntityConsolidation {
  return {
    id: row.id,
    consolidationBatchId: row.consolidation_batch_id,
    periodKey: row.period_key,
    reportingCurrency: row.reporting_currency,
    entityCode: row.entity_code as ConsolidationEntityCode,
    functionalCurrency: row.functional_currency as FunctionalCurrency,
    localRevenueUnits: row.local_revenue_units,
    localOperatingExpensesUnits: row.local_operating_expenses_units,
    localNetIncomeUnits: row.local_net_income_units,
    localTotalAssetsUnits: row.local_total_assets_units,
    localTotalLiabilitiesUnits: row.local_total_liabilities_units,
    localEquityUnits: row.local_equity_units,
    periodEndSpotRate: row.period_end_spot_rate,
    periodWeightedAverageRate: row.period_weighted_average_rate,
    historicalEquityRate: row.historical_equity_rate,
    translatedRevenueCents: row.translated_revenue_cents,
    translatedExpensesCents: row.translated_expenses_cents,
    translatedNetIncomeCents: row.translated_net_income_cents,
    translatedAssetsCents: row.translated_assets_cents,
    translatedLiabilitiesCents: row.translated_liabilities_cents,
    translatedEquityCents: row.translated_equity_cents,
    intercompanyReceivablesEliminatedCents: row.intercompany_receivables_eliminated_cents,
    intercompanyPayablesEliminatedCents: row.intercompany_payables_eliminated_cents,
    intercompanyRevenueEliminatedCents: row.intercompany_revenue_eliminated_cents,
    intercompanyExpenseEliminatedCents: row.intercompany_expense_eliminated_cents,
    cumulativeTranslationAdjustmentCents: row.cumulative_translation_adjustment_cents,
    ctaBalanceType: row.cta_balance_type as CtaBalanceType,
    eliminationBalanced: Boolean(row.elimination_balanced),
    zeroPennyLeakageVerified: Boolean(row.zero_penny_leakage_verified),
    merkleSnapshotHash: row.merkle_snapshot_hash,
    auditedBy: row.audited_by,
    status: row.status as ConsolidationStatus,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
