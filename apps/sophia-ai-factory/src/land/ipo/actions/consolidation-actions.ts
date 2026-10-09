/**
 * ASC 830 Multi-Entity CTA Consolidation Actions
 *
 * Layer: land/ipo
 *
 * @module land/ipo/actions/consolidation-actions
 */

'use server';

import { success, failure } from '@/seed/types/result';
import { logger } from '@/seed/utils/logger-utility';
import {
  type MultiEntityConsolidation,
  type MultiEntityConsolidationResult,
  type ConsolidateCtaInput,
  type MultiEntityConsolidationRow,
  mapRowToMultiEntityConsolidation,
} from '@/seed/types/ipo-filing';
import { consolidateMultiEntityCta } from '@/tree/ipo/s1-prospectus-engine';
import {
  type ActionResult,
  assertIpoAdminAccess,
  resolveDb,
  normalizeErrorArg,
} from './common';

/**
 * Executes and persists an ASC 830 Multi-Entity CTA consolidation batch.
 */
export async function consolidateMultiEntityCtaAction(
  input: ConsolidateCtaInput
): Promise<ActionResult<MultiEntityConsolidationResult>> {
  const authRes = await assertIpoAdminAccess();
  if (!authRes.ok) return authRes;

  const dbRes = await resolveDb();
  if (!dbRes.ok) return dbRes;
  const db = dbRes.value;

  try {
    const result = await consolidateMultiEntityCta(input.entities, input.periodKey);

    // Persist all entity records and consolidated group to D1
    const allRecords = [...result.entities, result.consolidatedGroup];
    for (const rec of allRecords) {
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

    return success(result);
  } catch (err) {
    logger.error('Failed to execute multi-entity consolidation', normalizeErrorArg(err));
    return failure({ code: 'CONSOLIDATION_ERROR', message: `Consolidation error: ${String(err)}` });
  }
}

/**
 * Retrieves the historical consolidation batch records for a specific period.
 */
export async function getConsolidationHistoryAction(
  periodKey: string
): Promise<ActionResult<MultiEntityConsolidation[]>> {
  const authRes = await assertIpoAdminAccess();
  if (!authRes.ok) return authRes;

  const dbRes = await resolveDb();
  if (!dbRes.ok) return dbRes;
  const db = dbRes.value;

  try {
    const rows = await db
      .prepare('SELECT * FROM multi_entity_consolidations WHERE period_key = ? ORDER BY created_at DESC')
      .bind(periodKey)
      .all<MultiEntityConsolidationRow>();

    const items = (rows.results || []).map(mapRowToMultiEntityConsolidation);
    return success(items);
  } catch (err) {
    logger.error('Failed to query consolidation history', normalizeErrorArg(err));
    return failure({ code: 'DB_ERROR', message: `Query error: ${String(err)}` });
  }
}
