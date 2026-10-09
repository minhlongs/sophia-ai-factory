/**
 * S-1 Prospectus Engine: Non-GAAP Financial Metrics (SEC Regulation G)
 *
 * Implements SEC Regulation G and Item 10(e) reconciliations:
 * - Adjusted EBITDA and Margin
 * - Free Cash Flow and Margin
 * - SaaS Magic Number
 * - Rule of 40
 *
 * Layer: tree (Domain logic)
 *
 * @module tree/ipo/prospectus/non-gaap-metrics
 */

import { GATE10_SCALE_TARGETS } from '@/seed/types/ipo-filing';
import type { GaapFinancialsInput, NonGaapReconciliationResult } from './types';

/**
 * Computes SEC Regulation G and Item 10(e) compliant Non-GAAP financial metrics.
 * Reconciles GAAP Net Income to Adjusted EBITDA, Operating Cash Flow to Free Cash Flow,
 * and derives Magic Number and Rule of 40.
 */
export function computeNonGaapMetrics(
  gaap: GaapFinancialsInput
): NonGaapReconciliationResult {
  const notes: string[] = [];

  // GAAP Gross Profit & Margin
  const gaapGrossProfitCents = gaap.revenueCents - gaap.costOfRevenueCents;
  const grossMarginPct =
    gaap.revenueCents > 0
      ? Number(((gaapGrossProfitCents / gaap.revenueCents) * 100).toFixed(2))
      : 0.0;

  // GAAP Operating Income
  const gaapOperatingIncomeCents = gaapGrossProfitCents - gaap.operatingExpensesCents;

  // Adjusted EBITDA Reconciliation
  const sbc = gaap.stockBasedCompensationCents || 0;
  const da = gaap.depreciationAmortizationCents || 0;
  const fx = gaap.unrealizedFxGainLossCents || 0;
  const restructuring = gaap.oneTimeMnaRestructuringCents || 0;

  const adjustedEbitdaCents = gaap.netIncomeCents + da + sbc + fx + restructuring;
  const adjustedEbitdaMarginPct =
    gaap.revenueCents > 0
      ? Number(((adjustedEbitdaCents / gaap.revenueCents) * 100).toFixed(2))
      : 0.0;

  notes.push(
    `Adjusted EBITDA reconciled from GAAP Net Income ($${(gaap.netIncomeCents / 100).toLocaleString()}) ` +
      `by adding back SBC ($${(sbc / 100).toLocaleString()}), D&A ($${(da / 100).toLocaleString()}), ` +
      `unrealized FX ($${(fx / 100).toLocaleString()}), and M&A/restructuring ($${(restructuring / 100).toLocaleString()}).`
  );

  // Free Cash Flow Reconciliation
  const freeCashFlowCents = gaap.operatingCashFlowCents - gaap.capexCents;
  const freeCashFlowMarginPct =
    gaap.revenueCents > 0
      ? Number(((freeCashFlowCents / gaap.revenueCents) * 100).toFixed(2))
      : 0.0;

  notes.push(
    `Free Cash Flow reconciled from GAAP Operating Cash Flow ($${(gaap.operatingCashFlowCents / 100).toLocaleString()}) ` +
      `less CapEx ($${(gaap.capexCents / 100).toLocaleString()}) = $${(freeCashFlowCents / 100).toLocaleString()} ` +
      `(${freeCashFlowMarginPct}% FCF Margin).`
  );

  // SaaS Magic Number (Sales Efficiency)
  let magicNumber = 0.0;
  let magicNumberPassed = false;

  if (
    gaap.priorQuarterRevenueCents !== undefined &&
    gaap.priorQuarterSmExpenseCents !== undefined &&
    gaap.priorQuarterSmExpenseCents > 0
  ) {
    const deltaQuarterlyRevenueCents = gaap.revenueCents - gaap.priorQuarterRevenueCents;
    const annualizedDeltaRevenueCents = deltaQuarterlyRevenueCents * 4;
    magicNumber = Number((annualizedDeltaRevenueCents / gaap.priorQuarterSmExpenseCents).toFixed(4));
    magicNumberPassed = magicNumber > GATE10_SCALE_TARGETS.MIN_MAGIC_NUMBER;

    notes.push(
      `SaaS Magic Number: ${magicNumber} (Target > ${GATE10_SCALE_TARGETS.MIN_MAGIC_NUMBER}) ` +
        `[Annualized Net New Revenue: $${(annualizedDeltaRevenueCents / 100).toLocaleString()} / Prior S&M: $${(gaap.priorQuarterSmExpenseCents / 100).toLocaleString()}].`
    );
  } else {
    notes.push('Magic Number omitted: insufficient quarterly historical S&M baseline.');
  }

  // YoY Revenue Growth Rate
  let yoyRevenueGrowthPct = 0.0;
  if (gaap.priorYearRevenueCents !== undefined && gaap.priorYearRevenueCents > 0) {
    yoyRevenueGrowthPct = Number(
      (((gaap.revenueCents - gaap.priorYearRevenueCents) / gaap.priorYearRevenueCents) * 100).toFixed(2)
    );
  }

  // Rule of 40 = YoY Revenue Growth % + Free Cash Flow Margin %
  const ruleOf40Pct = Number((yoyRevenueGrowthPct + freeCashFlowMarginPct).toFixed(2));
  const ruleOf40Passed = ruleOf40Pct >= GATE10_SCALE_TARGETS.MIN_RULE_OF_40_PCT;

  notes.push(
    `Rule of 40: ${ruleOf40Pct}% (Growth: ${yoyRevenueGrowthPct}% + FCF Margin: ${freeCashFlowMarginPct}%) ` +
      `[Target >= ${GATE10_SCALE_TARGETS.MIN_RULE_OF_40_PCT}%: ${ruleOf40Passed ? 'COMPLIANT' : 'DEFICIENT'}].`
  );

  return {
    gaapGrossProfitCents,
    grossMarginPct,
    gaapOperatingIncomeCents,
    adjustedEbitdaCents,
    adjustedEbitdaMarginPct,
    freeCashFlowCents,
    freeCashFlowMarginPct,
    magicNumber,
    magicNumberPassed,
    yoyRevenueGrowthPct,
    ruleOf40Pct,
    ruleOf40Passed,
    reconciliationNotes: notes,
  };
}
