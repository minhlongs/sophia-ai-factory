/**
 * D1 Persistence helper for ASC 830 Multi-Entity CTA Consolidation
 *
 * Layer: land/ipo
 *
 * @module land/ipo/actions/consolidation-persistence
 */

import type { MultiEntityConsolidation } from '@/seed/types/ipo-filing';
import type { resolveDb } from './common';

type DbHandle = Extract<Awaited<ReturnType<typeof resolveDb>>, { ok: true }>['value'];

export async function persistConsolidationRecord(
  db: DbHandle,
  rec: MultiEntityConsolidation
): Promise<void> {
  await db
    .prepare(
      `INSERT OR REPLACE INTO multi_entity_consolidations (
        id, consolidation_batch_id, period_key, reporting_currency, entity_code, functional_currency,
        local_revenue_units, local_operating_expenses_units, local_net_income_units,
        local_total_assets_units, local_total_liabilities_units, local_equity_units,
        period_end_spot_rate, period_weighted_average_rate, historical_equity_rate,
        translated_revenue_cents, translated_expenses_cents, translated_net_income_cents,
        translated_assets_cents, translated_liabilities_cents, translated_equity_cents,
        intercompany_receivables_eliminated_cents, intercompany_payables_eliminated_cents,
        intercompany_revenue_eliminated_cents, intercompany_expense_eliminated_cents,
        cumulative_translation_adjustment_cents, cta_balance_type, elimination_balanced,
        zero_penny_leakage_verified, merkle_snapshot_hash, audited_by, status, notes,
        created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?,
        ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?
      )`
    )
    .bind(
      rec.id,
      rec.consolidationBatchId,
      rec.periodKey,
      rec.reportingCurrency,
      rec.entityCode,
      rec.functionalCurrency,
      rec.localRevenueUnits,
      rec.localOperatingExpensesUnits,
      rec.localNetIncomeUnits,
      rec.localTotalAssetsUnits,
      rec.localTotalLiabilitiesUnits,
      rec.localEquityUnits,
      rec.periodEndSpotRate,
      rec.periodWeightedAverageRate,
      rec.historicalEquityRate,
      rec.translatedRevenueCents,
      rec.translatedExpensesCents,
      rec.translatedNetIncomeCents,
      rec.translatedAssetsCents,
      rec.translatedLiabilitiesCents,
      rec.translatedEquityCents,
      rec.intercompanyReceivablesEliminatedCents,
      rec.intercompanyPayablesEliminatedCents,
      rec.intercompanyRevenueEliminatedCents,
      rec.intercompanyExpenseEliminatedCents,
      rec.cumulativeTranslationAdjustmentCents,
      rec.ctaBalanceType,
      rec.eliminationBalanced ? 1 : 0,
      rec.zeroPennyLeakageVerified ? 1 : 0,
      rec.merkleSnapshotHash,
      rec.auditedBy,
      rec.status,
      rec.notes,
      rec.createdAt,
      rec.updatedAt
    )
    .run();
}
