/** @vitest-environment node */

import { describe, it, expect, beforeEach } from 'vitest';
import { createRequire } from 'node:module';
import { makeD1 } from '@/__tests__/integration/shared-d1-shim';
import type { D1Database } from '@cloudflare/workers-types';
import { GATE_11_CONSTANTS, type BepsComputationInput } from '@/seed/types/dual-listing';
import { DualListingEngine } from '../dual-listing-engine';

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

describe('DualListingEngine — Unit Tests', () => {
  let db: D1Database;

  beforeEach(() => {
    const rawDb = new DatabaseSync(':memory:');
    rawDb.exec(`
      CREATE TABLE IF NOT EXISTS dual_listing_periods (
        id TEXT PRIMARY KEY,
        period_name TEXT NOT NULL,
        fiscal_year INTEGER NOT NULL,
        fiscal_quarter INTEGER,
        filing_type TEXT NOT NULL,
        us_cik TEXT NOT NULL,
        sgx_ticker TEXT NOT NULL,
        currency TEXT NOT NULL,
        consolidated_revenue_cents INTEGER NOT NULL,
        consolidated_ebitda_cents INTEGER NOT NULL,
        adjusted_ebitda_cents INTEGER NOT NULL,
        free_cash_flow_cents INTEGER NOT NULL,
        net_income_cents INTEGER NOT NULL,
        paid_customers_count INTEGER NOT NULL,
        arpu_cents INTEGER NOT NULL,
        nrr_percentage INTEGER NOT NULL,
        rule_of_forty_percentage INTEGER NOT NULL,
        audit_firm_name TEXT NOT NULL,
        audit_opinion_type TEXT NOT NULL,
        ixbrl_document_uri TEXT,
        sec_edgar_submission_id TEXT,
        sgx_net_announcement_id TEXT,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT '2026-09-27T00:00:00Z',
        updated_at TEXT NOT NULL DEFAULT '2026-09-27T00:00:00Z'
      );
    `);
    db = makeD1(rawDb) as unknown as D1Database;
  });

  describe('1. OECD BEPS Pillar Two GloBE 15% Calculation', () => {
    it('calculates 0 top-up tax when Effective Tax Rate >= 15%', () => {
      const input: BepsComputationInput = {
        jurisdictionCode: 'US',
        coveredTaxesCents: 21_000_000_00, // $21M taxes
        globeIncomeCents: 100_000_000_00, // $100M income -> ETR = 21% (2100 bps)
      };

      const result = DualListingEngine.calculateBepsPillarTwo(input);
      expect(result.effectiveTaxRateBps).toBe(2100);
      expect(result.topUpTaxPercentageBps).toBe(0);
      expect(result.netTopUpTaxCents).toBe(0);
      expect(result.isCompliant).toBe(true);
    });

    it('calculates exact top-up tax when Effective Tax Rate < 15%', () => {
      const input: BepsComputationInput = {
        jurisdictionCode: 'SG',
        coveredTaxesCents: 2_500_000_00, // $2.5M taxes
        globeIncomeCents: 25_000_000_00, // $25M income -> ETR = 10% (1000 bps)
        substanceCarveOutCents: 5_000_000_00, // $5M carve-out
      };

      const result = DualListingEngine.calculateBepsPillarTwo(input);
      expect(result.effectiveTaxRateBps).toBe(1000);
      // Top-up tax rate = 1500 - 1000 = 500 bps (5%)
      expect(result.topUpTaxPercentageBps).toBe(500);
      // Net top-up tax = 5% of ($25M - $5M) = 5% of $20M = $1,000,000 (100,000,000 cents)
      expect(result.netTopUpTaxCents).toBe(100_000_000);
      expect(result.isCompliant).toBe(true);
    });

    it('handles zero or negative income safely', () => {
      const input: BepsComputationInput = {
        jurisdictionCode: 'KY',
        coveredTaxesCents: 0,
        globeIncomeCents: 0,
      };

      const result = DualListingEngine.calculateBepsPillarTwo(input);
      expect(result.netTopUpTaxCents).toBe(0);
      expect(result.isCompliant).toBe(true);
    });
  });

  describe('2. iXBRL Taxonomy Tagging', () => {
    it('generates standard financial tags with valid context and units', () => {
      const period = DualListingEngine.createGate11FilingPeriod(2026, 'SEC_10K');
      const tags = DualListingEngine.generateIxbrlTags(period);

      expect(tags.length).toBeGreaterThanOrEqual(4);
      const revTag = tags.find((t) => t.tagName === 'Revenues');
      expect(revTag).toBeDefined();
      expect(revTag?.standard).toBe('US_GAAP_2026');
      expect(revTag?.valueNumeric).toBe(period.consolidatedRevenueCents);
      expect(revTag?.contextRef).toContain('SEC_10K');
    });

    it('uses SFRS_I_2026 standard for SGX filings', () => {
      const period = DualListingEngine.createGate11FilingPeriod(2026, 'SGX_ANNUAL');
      const tags = DualListingEngine.generateIxbrlTags(period);
      expect(tags[0].standard).toBe('SFRS_I_2026');
    });
  });

  describe('3. Gate 11 Scale Invariants', () => {
    it('verifies $10M MRR ($120M ARR) scale metrics in filing period', () => {
      const period = DualListingEngine.createGate11FilingPeriod(2026);
      expect(period.consolidatedRevenueCents).toBe(GATE_11_CONSTANTS.TARGET_MRR_CENTS * 12);
      expect(period.paidCustomersCount).toBe(40_000);
      expect(period.arpuCents).toBe(25_000);
      expect(period.nrrPercentage).toBeGreaterThanOrEqual(145);
      expect(period.ruleOfFortyPercentage).toBeGreaterThanOrEqual(70);
    });

    it('assembles consolidated package with deterministic SHA-256 package hash', () => {
      const period = DualListingEngine.createGate11FilingPeriod(2026);
      const bepsInputs: BepsComputationInput[] = [
        { jurisdictionCode: 'US', coveredTaxesCents: 15_000_000_00, globeIncomeCents: 75_000_000_00 },
        { jurisdictionCode: 'SG', coveredTaxesCents: 2_500_000_00, globeIncomeCents: 25_000_000_00 },
      ];

      const pkg = DualListingEngine.assembleConsolidatedPackage(period, bepsInputs);
      expect(pkg.overallCompliant).toBe(true);
      expect(pkg.packageHash).toHaveLength(64);
      expect(pkg.bepsAllocations).toHaveLength(2);
      expect(pkg.ixbrlEntries.length).toBeGreaterThanOrEqual(4);
    });
  });

  describe('4. D1 Database Persistence', () => {
    it('persists and retrieves filing period from D1', async () => {
      const period = DualListingEngine.createGate11FilingPeriod(2026);
      await DualListingEngine.persistFilingPeriod(db, period);

      const retrieved = await DualListingEngine.getFilingPeriod(db, period.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe(period.id);
      expect(retrieved?.consolidatedRevenueCents).toBe(period.consolidatedRevenueCents);
      expect(retrieved?.status).toBe('BOARD_APPROVED');
    });
  });
});
