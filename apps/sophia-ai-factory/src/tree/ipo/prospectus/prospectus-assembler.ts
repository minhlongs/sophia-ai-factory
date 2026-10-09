/**
 * S-1 Prospectus Engine: Prospectus Document Assembler
 *
 * Assembles full SEC Form S-1 / F-1 prospectus package with Merkle anchoring.
 *
 * Layer: tree (Domain logic)
 *
 * @module tree/ipo/prospectus/prospectus-assembler
 */

import type { D1Database } from '@/seed/db/client';
import {
  CANONICAL_ENTITIES,
  type ConsolidationEntityCode,
  type FunctionalCurrency,
  type GaapFinancialsInput,
  type MultiEntityConsolidationResult,
  type S1ProspectusDocument,
  type IpoFilingPeriodRow,
  type MultiEntityConsolidationRow,
  mapRowToIpoFilingPeriod,
} from '@/seed/types/ipo-filing';
import {
  canonicalJson,
  sha256Hex,
  buildMerkleTree,
  hmacSha256Hex,
  DEFAULT_AUDIT_SECRET,
} from '@/tree/finance/merkle-audit-vault';
import { evaluateAllControls } from '@/tree/ipo/sox404-control-ledger';
import { computeNonGaapMetrics } from './non-gaap-metrics';
import { consolidateMultiEntityCta } from './cta-consolidation';
import { buildDefaultPeriod, buildCanonicalEntities } from './default-period-helper';

export async function generateS1ProspectusPackage(
  db: D1Database,
  periodKey: string
): Promise<S1ProspectusDocument> {
  const timestamp = Date.now();

  const periodRow = await db
    .prepare('SELECT * FROM ipo_filing_periods WHERE period_key = ?')
    .bind(periodKey)
    .first<IpoFilingPeriodRow>();

  const period = periodRow ? mapRowToIpoFilingPeriod(periodRow) : buildDefaultPeriod(periodKey, timestamp);

  const gaapFinancials: GaapFinancialsInput = {
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

  const nonGaapFinancials = computeNonGaapMetrics(gaapFinancials);

  const consolidationRows = await db
    .prepare('SELECT * FROM multi_entity_consolidations WHERE period_key = ?')
    .bind(periodKey)
    .all<MultiEntityConsolidationRow>();

  let consolidationSummary: MultiEntityConsolidationResult;
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
    consolidationSummary = await consolidateMultiEntityCta(entities, periodKey);
  } else {
    consolidationSummary = await consolidateMultiEntityCta(buildCanonicalEntities(), periodKey);
  }

  const sox404Evaluation = await evaluateAllControls(db);

  const scaleHash = await sha256Hex(
    canonicalJson({
      totalCustomers: period.totalCustomers,
      mrrCents: period.mrrCents,
      arrCents: period.arrCents,
      arpuCents: period.arpuCents,
      nrrPct: period.nrrPct,
    })
  );
  const gaapHash = await sha256Hex(canonicalJson(gaapFinancials));
  const nonGaapHash = await sha256Hex(canonicalJson(nonGaapFinancials));
  const consolidationHash = consolidationSummary.merkleSnapshotHash;
  const soxHash = sox404Evaluation.merkleRootHash;

  const prospectusMerkleTree = await buildMerkleTree([
    scaleHash,
    gaapHash,
    nonGaapHash,
    consolidationHash,
    soxHash,
  ]);
  const merkleRootHash = prospectusMerkleTree.rootHash;

  const secFilingSignature = await hmacSha256Hex(
    `${periodKey}:${period.filingType}:${merkleRootHash}:${sox404Evaluation.overallStatus}`,
    DEFAULT_AUDIT_SECRET
  );

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
      sox404Evaluation.overallStatus,
      nonGaapFinancials.adjustedEbitdaCents,
      nonGaapFinancials.adjustedEbitdaMarginPct,
      nonGaapFinancials.freeCashFlowCents,
      nonGaapFinancials.freeCashFlowMarginPct,
      nonGaapFinancials.magicNumber,
      nonGaapFinancials.ruleOf40Pct,
      nonGaapFinancials.yoyRevenueGrowthPct,
      timestamp,
      periodKey
    )
    .run();

  return {
    filingId: period.id,
    periodKey,
    filingType: period.filingType,
    targetExchanges: period.targetExchanges,
    status: period.status,
    scaleMetrics: {
      totalCustomers: period.totalCustomers,
      mrrCents: period.mrrCents,
      arrCents: period.arrCents,
      arpuCents: period.arpuCents,
      nrrPct: period.nrrPct,
      grossMarginPct: nonGaapFinancials.grossMarginPct,
    },
    gaapFinancials,
    nonGaapFinancials,
    consolidationSummary,
    sox404Evaluation,
    merkleRootHash,
    secFilingSignature,
    generatedAt: timestamp,
  };
}
