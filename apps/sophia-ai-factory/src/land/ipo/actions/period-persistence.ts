/**
 * IPO Filing Period D1 Persistence Helper
 *
 * Layer: land/ipo
 *
 * @module land/ipo/actions/period-persistence
 */

import {
  type IpoFilingPeriod,
  type CreateIpoPeriodInput,
  type IpoFilingPeriodRow,
  mapRowToIpoFilingPeriod,
} from '@/seed/types/ipo-filing';
import { computeNonGaapMetrics } from '@/tree/ipo/s1-prospectus-engine';

export async function insertIpoFilingPeriodRow(
  db: D1Database,
  input: CreateIpoPeriodInput,
): Promise<IpoFilingPeriod | null> {
  const timestamp = Date.now();
  const filingDate = new Date().toISOString().split('T')[0];
  const targetExchanges = (input.targetExchanges || ['NASDAQ', 'SGX']).join(',');
  const nonGaap = computeNonGaapMetrics(input.gaapFinancials);

  await db
    .prepare(
      `INSERT INTO ipo_filing_periods (
        period_key, filing_type, target_exchanges, status, filing_date,
        total_customers, mrr_cents, arr_cents, arpu_cents, nrr_pct, gross_margin_pct,
        gaap_revenue_cents, gaap_cost_of_revenue_cents, gaap_gross_profit_cents,
        gaap_operating_expenses_cents, gaap_operating_income_cents, gaap_net_income_cents,
        gaap_operating_cash_flow_cents, capex_cents,
        stock_based_compensation_cents, depreciation_amortization_cents,
        unrealized_fx_gain_loss_cents, one_time_mna_restructuring_cents,
        adjusted_ebitda_cents, adjusted_ebitda_margin_pct,
        free_cash_flow_cents, free_cash_flow_margin_pct,
        magic_number, rule_of_40_pct, yoy_revenue_growth_pct,
        sox_404_status, prospectus_metadata_json, created_at, updated_at
      ) VALUES (
        ?, ?, ?, 'draft', ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?,
        ?, ?,
        ?, ?,
        ?, ?,
        ?, ?,
        ?, ?, ?,
        'untested', ?, ?, ?
      )`,
    )
    .bind(
      input.periodKey,
      input.filingType,
      targetExchanges,
      filingDate,
      input.totalCustomers,
      input.mrrCents,
      input.arrCents,
      input.arpuCents,
      input.nrrPct,
      nonGaap.grossMarginPct,
      input.gaapFinancials.revenueCents,
      input.gaapFinancials.costOfRevenueCents,
      nonGaap.gaapGrossProfitCents,
      input.gaapFinancials.operatingExpensesCents,
      nonGaap.gaapOperatingIncomeCents,
      input.gaapFinancials.netIncomeCents,
      input.gaapFinancials.operatingCashFlowCents,
      input.gaapFinancials.capexCents,
      input.gaapFinancials.stockBasedCompensationCents,
      input.gaapFinancials.depreciationAmortizationCents,
      input.gaapFinancials.unrealizedFxGainLossCents || 0,
      input.gaapFinancials.oneTimeMnaRestructuringCents || 0,
      nonGaap.adjustedEbitdaCents,
      nonGaap.adjustedEbitdaMarginPct,
      nonGaap.freeCashFlowCents,
      nonGaap.freeCashFlowMarginPct,
      nonGaap.magicNumber,
      nonGaap.ruleOf40Pct,
      nonGaap.yoyRevenueGrowthPct,
      JSON.stringify(input.prospectusMetadata || {}),
      timestamp,
      timestamp,
    )
    .run();

  const createdRow = await db
    .prepare('SELECT * FROM ipo_filing_periods WHERE period_key = ?')
    .bind(input.periodKey)
    .first<IpoFilingPeriodRow>();

  return createdRow ? mapRowToIpoFilingPeriod(createdRow) : null;
}
