/** @vitest-environment node */

/**
 * Unit Test Suite: SEC Form S-1/F-1 Prospectus Engine & ASC 830 CTA Consolidation
 *
 * Validates:
 * 1. SEC Regulation G & Item 10(e) Non-GAAP Financial Metrics (Adjusted EBITDA, FCF, Margins)
 * 2. SaaS Magic Number Sales Efficiency (> 1.5 target, edge cases, zero S&M guard)
 * 3. Rule of 40 Invariant (YoY Growth + FCF Margin >= 65% target)
 * 4. ASC 830 Multi-Entity Consolidation with Zero-Penny Leakage Verification
 * 5. Cumulative Translation Adjustment (CTA) balancing and classification (CREDIT / DEBIT / ZERO)
 * 6. Intercompany elimination debit/credit balancing and tamper detection
 * 7. End-to-end S-1 Prospectus document generation with SHA-256 Merkle root anchoring
 *
 * @module tree/ipo/__tests__/s1-prospectus-engine.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createRequire } from 'node:module';
import { makeD1 } from '@/__tests__/integration/shared-d1-shim';
import type { D1Database } from '@cloudflare/workers-types';
import {
  GATE10_SCALE_TARGETS,
  CANONICAL_ENTITIES,
  type GaapFinancialsInput,
  type EntityFinancialInput,
} from '@/seed/types/ipo-filing';
import {
  computeNonGaapMetrics,
  consolidateMultiEntityCta,
  generateS1ProspectusPackage,
  normalizeToDirectRate,
  translateUnitsToUsdCents,
} from '../s1-prospectus-engine';

const req = createRequire(import.meta.url);
const { DatabaseSync } = req('node:sqlite') as {
  DatabaseSync: new (path: string) => {
    exec(sql: string): void;
    prepare(sql: string): {
      get(...params: unknown[]): unknown;
      all(...params: unknown[]): unknown[];
      run(...params: unknown[]): { lastInsertRowid: bigint; changes: number };
    };
  };
};

describe('SEC Form S-1/F-1 Prospectus Engine & ASC 830 CTA — Unit Tests', () => {
  describe('1. FX Translation Utilities (ASC 830)', () => {
    it('normalizes direct and indirect exchange rates accurately', () => {
      expect(normalizeToDirectRate('USD', 1.0)).toBe(1.0);
      expect(normalizeToDirectRate('SGD', 0.74)).toBe(0.74);
      // Indirect 1.35 SGD per USD
      expect(normalizeToDirectRate('SGD', 1.35)).toBeCloseTo(0.74074, 4);
      // Indirect 25,400 VND per USD
      expect(normalizeToDirectRate('VND', 25400)).toBeCloseTo(0.00003937, 7);
      expect(normalizeToDirectRate('VND', 0.00003929)).toBe(0.00003929);
    });

    it('translates local currency units to USD cents with exact integer rounding', () => {
      // $10M USD -> 1,000,000,000 cents
      expect(translateUnitsToUsdCents('USD', 10_000_000, 1.0)).toBe(1_000_000_000);
      // 4M SGD at direct 0.75 -> $3,000,000 -> 300,000,000 cents
      expect(translateUnitsToUsdCents('SGD', 4_000_000, 0.75)).toBe(300_000_000);
      // 25.4B VND at 25400 VND/USD -> $1,000,000 -> 100,000,000 cents
      expect(translateUnitsToUsdCents('VND', 25_400_000_000, 25400)).toBe(100_000_000);
    });
  });

  describe('2. Non-GAAP Regulation G & Item 10(e) Metrics', () => {
    it('calculates Adjusted EBITDA and FCF with exact margins', () => {
      const gaap: GaapFinancialsInput = {
        revenueCents: 15_000_000_00,       // $15,000,000
        costOfRevenueCents: 2_625_000_00, // $2,625,000
        operatingExpensesCents: 8_500_000_00,
        netIncomeCents: 3_100_000_00,     // $3,100,000 GAAP Net Income
        operatingCashFlowCents: 4_200_000_00, // $4,200,000 GAAP OCF
        capexCents: 450_000_00,           // $450,000 CapEx
        stockBasedCompensationCents: 500_000_00,
        depreciationAmortizationCents: 350_000_00,
        unrealizedFxGainLossCents: -50_000_00,
        oneTimeMnaRestructuringCents: 100_000_00,
        priorQuarterRevenueCents: 7_500_000_00,
        priorQuarterSmExpenseCents: 15_000_000_00,
        priorYearRevenueCents: 10_000_000_00,
      };

      const result = computeNonGaapMetrics(gaap);

      // Gross profit = 15,000,000 - 2,625,000 = 12,375,000
      expect(result.gaapGrossProfitCents).toBe(12_375_000_00);
      expect(result.grossMarginPct).toBe(82.5);

      // Adjusted EBITDA = 3,100,000 + 350,000 + 500,000 - 50,000 + 100,000 = 4,000,000
      expect(result.adjustedEbitdaCents).toBe(4_000_000_00);
      expect(result.adjustedEbitdaMarginPct).toBe(26.67);

      // Free Cash Flow = 4,200,000 - 450,000 = 3,750,000
      expect(result.freeCashFlowCents).toBe(3_750_000_00);
      expect(result.freeCashFlowMarginPct).toBe(25.0);

      // Magic Number: ((15M - 7.5M) * 4) / 15M = (7.5M * 4) / 15M = 30M / 15M = 2.0
      expect(result.magicNumber).toBe(2.0);
      expect(result.magicNumberPassed).toBe(true);

      // YoY Growth: ((15M - 10M) / 10M) * 100 = 50%
      expect(result.yoyRevenueGrowthPct).toBe(50.0);

      // Rule of 40: 50% + 25% = 75% >= 65% target
      expect(result.ruleOf40Pct).toBe(75.0);
      expect(result.ruleOf40Passed).toBe(true);
      expect(result.reconciliationNotes.length).toBeGreaterThan(0);
    });

    it('enforces Magic Number > 1.5 and Rule of 40 >= 65% thresholds with deficiency flags', () => {
      const gaapLow: GaapFinancialsInput = {
        revenueCents: 10_000_000_00,
        costOfRevenueCents: 5_000_000_00,
        operatingExpensesCents: 6_000_000_00,
        netIncomeCents: -1_000_000_00,
        operatingCashFlowCents: 500_000_00,
        capexCents: 300_000_00,
        stockBasedCompensationCents: 100_000_00,
        depreciationAmortizationCents: 50_000_00,
        priorQuarterRevenueCents: 9_000_000_00,   // Δ = 1M -> annualized 4M
        priorQuarterSmExpenseCents: 4_000_000_00, // Magic Number = 4M / 4M = 1.0 <= 1.5
        priorYearRevenueCents: 9_000_000_00,     // YoY = 11.11%
      };

      const result = computeNonGaapMetrics(gaapLow);

      expect(result.magicNumber).toBe(1.0);
      expect(result.magicNumberPassed).toBe(false); // Fails Gate 10 > 1.5 threshold

      // FCF = 500k - 300k = 200k on 10M = 2.0%
      expect(result.freeCashFlowMarginPct).toBe(2.0);
      // Rule of 40 = 11.11% + 2.0% = 13.11% < 65%
      expect(result.ruleOf40Passed).toBe(false);
    });

    it('handles zero or negative prior S&M spend gracefully without returning NaN', () => {
      const gaapZeroSm: GaapFinancialsInput = {
        revenueCents: 10_000_000_00,
        costOfRevenueCents: 2_000_000_00,
        operatingExpensesCents: 3_000_000_00,
        netIncomeCents: 5_000_000_00,
        operatingCashFlowCents: 5_000_000_00,
        capexCents: 1_000_000_00,
        stockBasedCompensationCents: 0,
        depreciationAmortizationCents: 0,
        priorQuarterRevenueCents: 8_000_000_00,
        priorQuarterSmExpenseCents: 0, // Zero S&M
      };

      const result = computeNonGaapMetrics(gaapZeroSm);
      expect(result.magicNumber).toBe(0);
      expect(result.magicNumberPassed).toBe(false);
      expect(Number.isNaN(result.magicNumber)).toBe(false);
    });
  });

  describe('3. ASC 830 Multi-Entity Consolidation & Cumulative Translation Adjustment (CTA)', () => {
    it('executes 3-entity consolidation with zero-penny leakage and balanced debits/credits', async () => {
      const entities: EntityFinancialInput[] = [
        {
          entityCode: CANONICAL_ENTITIES.US_INC,
          functionalCurrency: 'USD',
          localRevenueUnits: 10_000_000,
          localOperatingExpensesUnits: 6_000_000,
          localNetIncomeUnits: 4_000_000,
          localTotalAssetsUnits: 25_000_000,
          localTotalLiabilitiesUnits: 10_000_000,
          localEquityUnits: 11_000_000,
          periodEndSpotRate: 1.0,
          periodWeightedAverageRate: 1.0,
          historicalEquityRate: 1.0,
          intercompanyReceivablesEliminatedCents: 500_000_00, // US Inc holds 500k receivable from SG
          intercompanyPayablesEliminatedCents: 0,
          intercompanyRevenueEliminatedCents: 200_000_00,
          intercompanyExpenseEliminatedCents: 0,
        },
        {
          entityCode: CANONICAL_ENTITIES.SG_PTE_LTD,
          functionalCurrency: 'SGD',
          localRevenueUnits: 4_000_000,
          localOperatingExpensesUnits: 2_500_000,
          localNetIncomeUnits: 1_500_000,
          localTotalAssetsUnits: 10_000_000,
          localTotalLiabilitiesUnits: 4_000_000,
          localEquityUnits: 4_500_000,
          periodEndSpotRate: 0.74,
          periodWeightedAverageRate: 0.75,
          historicalEquityRate: 0.72,
          intercompanyReceivablesEliminatedCents: 0,
          intercompanyPayablesEliminatedCents: 500_000_00, // SG owes 500k payable to US
          intercompanyRevenueEliminatedCents: 0,
          intercompanyExpenseEliminatedCents: 200_000_00,
        },
        {
          entityCode: CANONICAL_ENTITIES.VN_CO_LTD,
          functionalCurrency: 'VND',
          localRevenueUnits: 50_000_000_000,
          localOperatingExpensesUnits: 30_000_000_000,
          localNetIncomeUnits: 20_000_000_000,
          localTotalAssetsUnits: 100_000_000_000,
          localTotalLiabilitiesUnits: 40_000_000_000,
          localEquityUnits: 40_000_000_000,
          periodEndSpotRate: 0.00003929,
          periodWeightedAverageRate: 0.00003937,
          historicalEquityRate: 0.00004000,
          intercompanyReceivablesEliminatedCents: 0,
          intercompanyPayablesEliminatedCents: 0,
          intercompanyRevenueEliminatedCents: 0,
          intercompanyExpenseEliminatedCents: 0,
        },
      ];

      const result = await consolidateMultiEntityCta(entities, '2026-Q3');

      expect(result.entities).toHaveLength(3);
      expect(result.consolidatedGroup.entityCode).toBe(CANONICAL_ENTITIES.CONSOLIDATED);

      // Verify zero-penny leakage for all individual subsidiaries
      for (const e of result.entities) {
        expect(e.zeroPennyLeakageVerified).toBe(true);
        const formulaSum =
          e.translatedLiabilitiesCents +
          e.translatedEquityCents +
          e.translatedNetIncomeCents +
          e.cumulativeTranslationAdjustmentCents;
        expect(e.translatedAssetsCents).toBe(formulaSum);
      }

      // Verify intercompany eliminations balanced
      expect(result.intercompanyEliminationsBalanced).toBe(true);

      // Verify zero-penny leakage on consolidated group level
      expect(result.zeroPennyLeakageVerified).toBe(true);

      const group = result.consolidatedGroup;
      const groupFormulaSum =
        group.translatedLiabilitiesCents +
        group.translatedEquityCents +
        group.translatedNetIncomeCents +
        group.cumulativeTranslationAdjustmentCents;
      expect(group.translatedAssetsCents).toBe(groupFormulaSum);

      // Verify CTA is recorded with valid balance type (CREDIT, DEBIT, or ZERO)
      expect(['CREDIT', 'DEBIT', 'ZERO']).toContain(result.ctaBalanceType);

      // Verify Merkle snapshot hash exists and is a 64-character SHA-256 string
      expect(result.merkleSnapshotHash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('detects unbalanced intercompany eliminations and flags violation', async () => {
      const unbalancedEntities: EntityFinancialInput[] = [
        {
          entityCode: CANONICAL_ENTITIES.US_INC,
          functionalCurrency: 'USD',
          localRevenueUnits: 10_000_000,
          localOperatingExpensesUnits: 6_000_000,
          localNetIncomeUnits: 4_000_000,
          localTotalAssetsUnits: 20_000_000,
          localTotalLiabilitiesUnits: 8_000_000,
          localEquityUnits: 8_000_000,
          periodEndSpotRate: 1.0,
          periodWeightedAverageRate: 1.0,
          historicalEquityRate: 1.0,
          intercompanyReceivablesEliminatedCents: 500_000_00, // 500k receivables eliminated
          intercompanyPayablesEliminatedCents: 0,
        },
        {
          entityCode: CANONICAL_ENTITIES.SG_PTE_LTD,
          functionalCurrency: 'SGD',
          localRevenueUnits: 2_000_000,
          localOperatingExpensesUnits: 1_000_000,
          localNetIncomeUnits: 1_000_000,
          localTotalAssetsUnits: 5_000_000,
          localTotalLiabilitiesUnits: 2_000_000,
          localEquityUnits: 2_000_000,
          periodEndSpotRate: 0.74,
          periodWeightedAverageRate: 0.75,
          historicalEquityRate: 0.72,
          intercompanyReceivablesEliminatedCents: 0,
          intercompanyPayablesEliminatedCents: 300_000_00, // Only 300k payables eliminated -> MISMATCH!
        },
      ];

      const result = await consolidateMultiEntityCta(unbalancedEntities, '2026-Q3');

      expect(result.intercompanyEliminationsBalanced).toBe(false);
      expect(result.zeroPennyLeakageVerified).toBe(false);
      expect(result.consolidatedGroup.status).toBe('draft');
    });
  });

  describe('4. S-1 Prospectus Document Package Generation with D1 Database', () => {
    let rawDb: InstanceType<typeof DatabaseSync>;
    let d1: D1Database;

    beforeEach(() => {
      rawDb = new DatabaseSync(':memory:');
      rawDb.exec(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          email TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS ipo_filing_periods (
          id TEXT PRIMARY KEY,
          period_key TEXT NOT NULL UNIQUE,
          filing_type TEXT NOT NULL,
          target_exchanges TEXT NOT NULL DEFAULT 'NASDAQ,SGX',
          status TEXT NOT NULL DEFAULT 'draft',
          filing_date TEXT,
          effective_date TEXT,
          total_customers INTEGER NOT NULL DEFAULT 0,
          mrr_cents INTEGER NOT NULL DEFAULT 0,
          arr_cents INTEGER NOT NULL DEFAULT 0,
          arpu_cents INTEGER NOT NULL DEFAULT 0,
          nrr_pct REAL NOT NULL DEFAULT 0.0,
          gross_margin_pct REAL NOT NULL DEFAULT 0.0,
          gaap_revenue_cents INTEGER NOT NULL DEFAULT 0,
          gaap_cost_of_revenue_cents INTEGER NOT NULL DEFAULT 0,
          gaap_gross_profit_cents INTEGER NOT NULL DEFAULT 0,
          gaap_operating_expenses_cents INTEGER NOT NULL DEFAULT 0,
          gaap_operating_income_cents INTEGER NOT NULL DEFAULT 0,
          gaap_net_income_cents INTEGER NOT NULL DEFAULT 0,
          gaap_operating_cash_flow_cents INTEGER NOT NULL DEFAULT 0,
          capex_cents INTEGER NOT NULL DEFAULT 0,
          stock_based_compensation_cents INTEGER NOT NULL DEFAULT 0,
          depreciation_amortization_cents INTEGER NOT NULL DEFAULT 0,
          unrealized_fx_gain_loss_cents INTEGER NOT NULL DEFAULT 0,
          one_time_mna_restructuring_cents INTEGER NOT NULL DEFAULT 0,
          adjusted_ebitda_cents INTEGER NOT NULL DEFAULT 0,
          adjusted_ebitda_margin_pct REAL NOT NULL DEFAULT 0.0,
          free_cash_flow_cents INTEGER NOT NULL DEFAULT 0,
          free_cash_flow_margin_pct REAL NOT NULL DEFAULT 0.0,
          magic_number REAL NOT NULL DEFAULT 0.0,
          rule_of_40_pct REAL NOT NULL DEFAULT 0.0,
          yoy_revenue_growth_pct REAL NOT NULL DEFAULT 0.0,
          sox_404_status TEXT NOT NULL DEFAULT 'untested',
          merkle_root_hash TEXT,
          sec_filing_signature TEXT,
          certified_by TEXT,
          certified_at INTEGER,
          prospectus_metadata_json TEXT NOT NULL DEFAULT '{}',
          created_at INTEGER NOT NULL DEFAULT 1700000000000,
          updated_at INTEGER NOT NULL DEFAULT 1700000000000
        );

        CREATE TABLE IF NOT EXISTS sox_404_control_matrix (
          id TEXT PRIMARY KEY,
          control_id TEXT NOT NULL UNIQUE,
          control_name TEXT NOT NULL,
          control_category TEXT NOT NULL,
          control_description_en TEXT NOT NULL,
          control_description_vi TEXT NOT NULL,
          coso_framework_pillar TEXT NOT NULL,
          assertion_tested TEXT NOT NULL,
          control_frequency TEXT NOT NULL,
          automation_level TEXT NOT NULL,
          is_preventive INTEGER NOT NULL DEFAULT 1,
          last_evaluated_at INTEGER,
          last_evaluation_status TEXT NOT NULL DEFAULT 'not_tested',
          unauthorized_attempts_detected INTEGER NOT NULL DEFAULT 0,
          quarantined_entries_count INTEGER NOT NULL DEFAULT 0,
          test_evidence_hash TEXT,
          last_tested_by TEXT NOT NULL DEFAULT 'SYSTEM_AUDITOR',
          remediation_plan TEXT,
          remediation_owner TEXT,
          remediation_deadline INTEGER,
          status TEXT NOT NULL DEFAULT 'active',
          metadata_json TEXT NOT NULL DEFAULT '{}',
          created_at INTEGER NOT NULL DEFAULT 1700000000000,
          updated_at INTEGER NOT NULL DEFAULT 1700000000000
        );

        CREATE TABLE IF NOT EXISTS multi_entity_consolidations (
          id TEXT PRIMARY KEY,
          consolidation_batch_id TEXT NOT NULL,
          period_key TEXT NOT NULL,
          reporting_currency TEXT NOT NULL DEFAULT 'USD',
          entity_code TEXT NOT NULL,
          functional_currency TEXT NOT NULL,
          local_revenue_units REAL NOT NULL DEFAULT 0.0,
          local_operating_expenses_units REAL NOT NULL DEFAULT 0.0,
          local_net_income_units REAL NOT NULL DEFAULT 0.0,
          local_total_assets_units REAL NOT NULL DEFAULT 0.0,
          local_total_liabilities_units REAL NOT NULL DEFAULT 0.0,
          local_equity_units REAL NOT NULL DEFAULT 0.0,
          period_end_spot_rate REAL NOT NULL DEFAULT 1.0,
          period_weighted_average_rate REAL NOT NULL DEFAULT 1.0,
          historical_equity_rate REAL NOT NULL DEFAULT 1.0,
          translated_revenue_cents INTEGER NOT NULL DEFAULT 0,
          translated_expenses_cents INTEGER NOT NULL DEFAULT 0,
          translated_net_income_cents INTEGER NOT NULL DEFAULT 0,
          translated_assets_cents INTEGER NOT NULL DEFAULT 0,
          translated_liabilities_cents INTEGER NOT NULL DEFAULT 0,
          translated_equity_cents INTEGER NOT NULL DEFAULT 0,
          intercompany_receivables_eliminated_cents INTEGER NOT NULL DEFAULT 0,
          intercompany_payables_eliminated_cents INTEGER NOT NULL DEFAULT 0,
          intercompany_revenue_eliminated_cents INTEGER NOT NULL DEFAULT 0,
          intercompany_expense_eliminated_cents INTEGER NOT NULL DEFAULT 0,
          cumulative_translation_adjustment_cents INTEGER NOT NULL DEFAULT 0,
          cta_balance_type TEXT NOT NULL DEFAULT 'CREDIT',
          elimination_balanced INTEGER NOT NULL DEFAULT 1,
          zero_penny_leakage_verified INTEGER NOT NULL DEFAULT 1,
          merkle_snapshot_hash TEXT NOT NULL,
          audited_by TEXT,
          status TEXT NOT NULL DEFAULT 'draft',
          notes TEXT,
          created_at INTEGER NOT NULL DEFAULT 1700000000000,
          updated_at INTEGER NOT NULL DEFAULT 1700000000000,
          UNIQUE(consolidation_batch_id, entity_code)
        );

        -- Seed initial Gate 10 filing period
        INSERT INTO ipo_filing_periods (
          id, period_key, filing_type, target_exchanges, status,
          total_customers, mrr_cents, arr_cents, arpu_cents, nrr_pct, gross_margin_pct,
          gaap_revenue_cents, gaap_cost_of_revenue_cents, gaap_gross_profit_cents,
          gaap_operating_expenses_cents, gaap_operating_income_cents, gaap_net_income_cents,
          gaap_operating_cash_flow_cents, capex_cents,
          stock_based_compensation_cents, depreciation_amortization_cents,
          unrealized_fx_gain_loss_cents, one_time_mna_restructuring_cents
        ) VALUES (
          'ifp_gate10_q3', '2026-Q3', 'S-1', 'NASDAQ,SGX', 'review_pending',
          20000, 500000000, 6000000000, 25000, 142.5, 82.5,
          1500000000, 262500000, 1237500000,
          850000000, 387500000, 310000000,
          420000000, 45000000,
          50000000, 35000000,
          -5000000, 10000000
        );
      `);

      d1 = makeD1(rawDb) as unknown as D1Database;
    });

    it('generates Form S-1 Prospectus document anchored with Merkle root and digital signature', async () => {
      const doc = await generateS1ProspectusPackage(d1, '2026-Q3');

      expect(doc.periodKey).toBe('2026-Q3');
      expect(doc.filingType).toBe('S-1');
      expect(doc.targetExchanges).toEqual(['NASDAQ', 'SGX']);

      // Gate 10 scale targets verified
      expect(doc.scaleMetrics.totalCustomers).toBe(GATE10_SCALE_TARGETS.TOTAL_CUSTOMERS);
      expect(doc.scaleMetrics.mrrCents).toBe(GATE10_SCALE_TARGETS.MRR_CENTS);
      expect(doc.scaleMetrics.arrCents).toBe(GATE10_SCALE_TARGETS.ARR_CENTS);
      expect(doc.scaleMetrics.arpuCents).toBe(GATE10_SCALE_TARGETS.ARPU_CENTS);

      // Non-GAAP reconciliation verified
      expect(doc.nonGaapFinancials.adjustedEbitdaCents).toBe(4_000_000_00);
      expect(doc.nonGaapFinancials.freeCashFlowCents).toBe(3_750_000_00);
      expect(doc.nonGaapFinancials.magicNumberPassed).toBe(true);
      expect(doc.nonGaapFinancials.ruleOf40Passed).toBe(true);

      // Multi-entity CTA consolidation verified
      expect(doc.consolidationSummary.zeroPennyLeakageVerified).toBe(true);
      expect(doc.consolidationSummary.intercompanyEliminationsBalanced).toBe(true);

      // SOX 404 audit evaluation verified
      expect(doc.sox404Evaluation.overallStatus).toBe('certified_clean');
      expect(doc.sox404Evaluation.totalControlsTested).toBe(6);

      // Cryptographic anchoring
      expect(doc.merkleRootHash).toMatch(/^[a-f0-9]{64}$/);
      expect(doc.secFilingSignature).toMatch(/^[a-f0-9]{64}$/);

      // Verify D1 row was updated with cryptographic hashes
      const updatedRow = (rawDb
        .prepare('SELECT * FROM ipo_filing_periods WHERE period_key = ?')
        .get('2026-Q3')) as Record<string, unknown>;

      expect(updatedRow.merkle_root_hash).toBe(doc.merkleRootHash);
      expect(updatedRow.sec_filing_signature).toBe(doc.secFilingSignature);
      expect(updatedRow.sox_404_status).toBe('certified_clean');
    });
  });
});
