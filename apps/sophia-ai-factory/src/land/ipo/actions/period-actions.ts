/**
 * IPO Filing Period Lifecycle & Prospectus Generation Actions
 *
 * Layer: land/ipo
 *
 * @module land/ipo/actions/period-actions
 */

'use server';

import { success, failure } from '@/seed/types/result';
import { logger } from '@/seed/utils/logger-utility';
import {
  type IpoFilingPeriod,
  type S1ProspectusDocument,
  type CreateIpoPeriodInput,
  type IpoFilingPeriodRow,
  mapRowToIpoFilingPeriod,
} from '@/seed/types/ipo-filing';
import {
  computeNonGaapMetrics,
  generateS1ProspectusPackage,
} from '@/tree/ipo/s1-prospectus-engine';
import {
  type ActionResult,
  assertIpoAdminAccess,
  resolveDb,
  normalizeErrorArg,
} from './common';

/**
 * Creates a new SEC Form S-1 / F-1 filing period.
 */
export async function createIpoFilingPeriodAction(
  input: CreateIpoPeriodInput
): Promise<ActionResult<IpoFilingPeriod>> {
  const authRes = await assertIpoAdminAccess();
  if (!authRes.ok) return authRes;

  const dbRes = await resolveDb();
  if (!dbRes.ok) return dbRes;
  const db = dbRes.value;

  try {
    const timestamp = Date.now();
    const filingDate = new Date().toISOString().split('T')[0];
    const targetExchanges = (input.targetExchanges || ['NASDAQ', 'SGX']).join(',');

    // Calculate Non-GAAP metrics
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
        )`
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
        timestamp
      )
      .run();

    const createdRow = await db
      .prepare('SELECT * FROM ipo_filing_periods WHERE period_key = ?')
      .bind(input.periodKey)
      .first<IpoFilingPeriodRow>();

    if (!createdRow) {
      return failure({ code: 'CREATION_FAILED', message: 'Filing period was not found after insertion.' });
    }

    return success(mapRowToIpoFilingPeriod(createdRow));
  } catch (err) {
    logger.error('Failed to create IPO filing period', normalizeErrorArg(err));
    return failure({ code: 'DB_ERROR', message: `Database insertion error: ${String(err)}` });
  }
}

/**
 * Retrieves an IPO filing period by period key.
 */
export async function getIpoFilingPeriodAction(
  periodKey: string
): Promise<ActionResult<IpoFilingPeriod>> {
  const authRes = await assertIpoAdminAccess();
  if (!authRes.ok) return authRes;

  const dbRes = await resolveDb();
  if (!dbRes.ok) return dbRes;
  const db = dbRes.value;

  try {
    const row = await db
      .prepare('SELECT * FROM ipo_filing_periods WHERE period_key = ?')
      .bind(periodKey)
      .first<IpoFilingPeriodRow>();

    if (!row) {
      return failure({ code: 'NOT_FOUND', message: `Filing period '${periodKey}' does not exist.` });
    }

    return success(mapRowToIpoFilingPeriod(row));
  } catch (err) {
    logger.error('Failed to query IPO filing period', normalizeErrorArg(err));
    return failure({ code: 'DB_ERROR', message: `Query error: ${String(err)}` });
  }
}

/**
 * Generates an end-to-end Form S-1 / F-1 Prospectus document package.
 */
export async function generateS1ProspectusPackageAction(
  periodKey: string
): Promise<ActionResult<S1ProspectusDocument>> {
  const authRes = await assertIpoAdminAccess();
  if (!authRes.ok) return authRes;

  const dbRes = await resolveDb();
  if (!dbRes.ok) return dbRes;
  const db = dbRes.value;

  try {
    const doc = await generateS1ProspectusPackage(db, periodKey);
    return success(doc);
  } catch (err) {
    logger.error('Failed to generate S-1 prospectus package', normalizeErrorArg(err));
    return failure({ code: 'PROSPECTUS_ERROR', message: `Prospectus engine failure: ${String(err)}` });
  }
}
