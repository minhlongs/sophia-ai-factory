/**
 * S-1 Prospectus Engine: Section Builders & Persistence Helpers
 *
 * Layer: tree (Domain logic)
 *
 * @module tree/ipo/prospectus/prospectus-section-builders
 */

import type { D1Database } from '@/seed/db/client';
import {
  CANONICAL_ENTITIES,
  type ConsolidationEntityCode,
  type FunctionalCurrency,
  type GaapFinancialsInput,
  type IpoFilingPeriod,
  type MultiEntityConsolidationResult,
  type MultiEntityConsolidationRow,
  type NonGaapReconciliationResult,
} from '@/seed/types/ipo-filing';
import { consolidateMultiEntityCta } from './cta-consolidation';
import { buildCanonicalEntities } from './default-period-helper';

export function buildGaapFinancialsFromPeriod(period: IpoFilingPeriod): GaapFinancialsInput {
  return {
    revenueCents: period.gaapRevenueCents,
    costOfRevenueCents: period.gaapCostOfRevenueCents,
    operatingExpensesCents: period.gaapOperatingExpensesCents,
    netIncomeCents: period.gaapNetIncomeCents,
    operatingCashFlowCents: period.gaapOperatingCashFlowCents,
    capexCents: period.capexCents,
    stockBasedCompensationCents: period.stockBasedCompensationCents,
    depreciationAmortizationCents: period.depreciationAmortizationCents,
    unrealizedFxGainLossCents: period.unrealizedFxGainLossCents,
    oneTimeMnaRestructuringCents: period.oneTimeMnaRestructuringCents,
    priorQuarterRevenueCents: 7_500_000_00,
    priorQuarterSmExpenseCents: 15_000_000_00,
    priorYearRevenueCents: 10_000_000_00,
  };
}

export async function resolveMultiEntityConsolidation(
  db: D1Database,
  periodKey: string,
): Promise<MultiEntityConsolidationResult> {
  const consolidationRows = await db
    .prepare('SELECT * FROM multi_entity_consolidations WHERE period_key = ?')
    .bind(periodKey)
    .all<MultiEntityConsolidationRow>();

  if (consolidationRows.results && consolidationRows.results.length > 0) {
    const entities = consolidationRows.results
      .filter((r) => r.entity_code !== CANONICAL_ENTITIES.CONSOLIDATED)
      .map((r) => ({
        entityCode: r.entity_code as ConsolidationEntityCode,
        functionalCurrency: r.functional_currency as FunctionalCurrency,
        localRevenueUnits: r.local_revenue_units,
        localOperatingExpensesUnits: r.local_operating_expenses_units,
        localNetIncomeUnits: r.local_net_income_units,
        localTotalAssetsUnits: r.local_total_assets_units,
        localTotalLiabilitiesUnits: r.local_total_liabilities_units,
        localEquityUnits: r.local_equity_units,
        periodEndSpotRate: r.period_end_spot_rate,
        periodWeightedAverageRate: r.period_weighted_average_rate,
        historicalEquityRate: r.historical_equity_rate,
        intercompanyReceivablesEliminatedCents: r.intercompany_receivables_eliminated_cents,
        intercompanyPayablesEliminatedCents: r.intercompany_payables_eliminated_cents,
        intercompanyRevenueEliminatedCents: r.intercompany_revenue_eliminated_cents,
        intercompanyExpenseEliminatedCents: r.intercompany_expense_eliminated_cents,
      }));
    return consolidateMultiEntityCta(entities, periodKey);
  }

  return consolidateMultiEntityCta(buildCanonicalEntities(), periodKey);
}

export async function persistProspectusPeriodMetrics(
  db: D1Database,
  periodKey: string,
  merkleRootHash: string,
  secFilingSignature: string,
  sox404Status: string,
  nonGaapFinancials: NonGaapReconciliationResult,
  timestamp: number,
): Promise<void> {
  await db
    .prepare(
      `UPDATE ipo_filing_periods SET
        merkle_root_hash = ?,
        sec_filing_signature = ?,
        sox_404_status = ?,
        adjusted_ebitda_cents = ?,
        adjusted_ebitda_margin_pct = ?,
        free_cash_flow_cents = ?,
        free_cash_flow_margin_pct = ?,
        magic_number = ?,
        rule_of_40_pct = ?,
        yoy_revenue_growth_pct = ?,
        updated_at = ?
      WHERE period_key = ?`
    )
    .bind(
      merkleRootHash,
      secFilingSignature,
      sox404Status,
      nonGaapFinancials.adjustedEbitdaCents,
      nonGaapFinancials.adjustedEbitdaMarginPct,
      nonGaapFinancials.freeCashFlowCents,
      nonGaapFinancials.freeCashFlowMarginPct,
      nonGaapFinancials.magicNumber,
      nonGaapFinancials.ruleOf40Pct,
      nonGaapFinancials.yoyRevenueGrowthPct,
      timestamp,
      periodKey,
    )
    .run();
}
