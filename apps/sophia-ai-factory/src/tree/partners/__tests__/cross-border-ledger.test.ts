/**
 * Unit Tests for Cross-Border Affiliate Commission Ledger & Withholding Tax Engine
 *
 * Layer: tree/partners/__tests__
 * Validates statutory withholding tax formulas (VN FCT, US W-8, EU RC, SG NR),
 * dynamic FX conversion with +1.5% buffer reserve, integer vs minor-unit payout rounding,
 * dollar conservation invariance, and D1 database operations.
 */

import { describe, it, expect, vi } from 'vitest';
import type { D1Database } from '@cloudflare/workers-types';
import {
  calculateWithholdingTax,
} from '../withholding-tax-calculator';
import {
  calculateCrossBorderPayout,
  recordCrossBorderCommission,
  getCrossBorderLedgerByPartner,
  getCrossBorderLedgerSummary,
  settleCrossBorderPayout,
  BEDROCK_LEDGER_FX_RATES,
} from '../cross-border-ledger';
import {
  isZeroDecimalCurrency,
  type PartnerCrossBorderLedgerEntry,
} from '@/seed/types/cross-border-ledger';

describe('Withholding Tax Calculator', () => {
  describe('Vietnam Foreign Contractor Tax (VN_FCT)', () => {
    it('applies 10% FCT (5% CIT + 5% VAT) for corporate foreign contractors under Circular 103', () => {
      const result = calculateWithholdingTax({
        grossCents: 100_000, // $1,000.00
        jurisdiction: 'VN_FCT',
        isIndividual: false,
      });

      expect(result.ratePct).toBe(10.0);
      expect(result.withholdingCents).toBe(10_000); // $100.00
      expect(result.netCents).toBe(90_000); // $900.00
      expect(result.treatyApplied).toBe(false);
      expect(result.complianceNote).toContain('Circular 103/2014/TT-BTC');
    });

    it('applies 5% PIT for individual contractors under Circular 111', () => {
      const result = calculateWithholdingTax({
        grossCents: 100_000,
        jurisdiction: 'VN_FCT',
        isIndividual: true,
      });

      expect(result.ratePct).toBe(5.0);
      expect(result.withholdingCents).toBe(5_000); // $50.00
      expect(result.netCents).toBe(95_000); // $950.00
      expect(result.treatyApplied).toBe(false);
      expect(result.complianceNote).toContain('Circular 111/2013/TT-BTC');
    });

    it('applies 0% when tax exemption certificate is approved', () => {
      const result = calculateWithholdingTax({
        grossCents: 100_000,
        jurisdiction: 'VN_FCT',
        certificateStatus: 'exempt',
      });

      expect(result.ratePct).toBe(0.0);
      expect(result.withholdingCents).toBe(0);
      expect(result.netCents).toBe(100_000);
      expect(result.treatyApplied).toBe(true);
    });
  });

  describe('US IRS Form W-8BEN (US_W8)', () => {
    it('applies 30% statutory withholding when form is pending or rejected', () => {
      const pendingResult = calculateWithholdingTax({
        grossCents: 100_000,
        jurisdiction: 'US_W8',
        certificateStatus: 'pending',
      });

      expect(pendingResult.ratePct).toBe(30.0);
      expect(pendingResult.withholdingCents).toBe(30_000);
      expect(pendingResult.netCents).toBe(70_000);
      expect(pendingResult.treatyApplied).toBe(false);

      const rejectedResult = calculateWithholdingTax({
        grossCents: 100_000,
        jurisdiction: 'US_W8',
        certificateStatus: 'rejected',
      });

      expect(rejectedResult.ratePct).toBe(30.0);
      expect(rejectedResult.withholdingCents).toBe(30_000);
      expect(rejectedResult.netCents).toBe(70_000);
    });

    it('applies standard 10% treaty rate when W-8 is verified without custom override', () => {
      const result = calculateWithholdingTax({
        grossCents: 100_000,
        jurisdiction: 'US_W8',
        certificateStatus: 'verified',
      });

      expect(result.ratePct).toBe(10.0);
      expect(result.withholdingCents).toBe(10_000);
      expect(result.netCents).toBe(90_000);
      expect(result.treatyApplied).toBe(true);
      expect(result.complianceNote).toContain('Bilateral Double Taxation Treaty');
    });

    it('applies custom treaty rate (e.g. 0% software exemption or 15% rate) when verified', () => {
      const zeroTreaty = calculateWithholdingTax({
        grossCents: 100_000,
        jurisdiction: 'US_W8',
        certificateStatus: 'verified',
        customTreatyRatePct: 0.0,
      });

      expect(zeroTreaty.ratePct).toBe(0.0);
      expect(zeroTreaty.withholdingCents).toBe(0);
      expect(zeroTreaty.netCents).toBe(100_000);

      const fifteenTreaty = calculateWithholdingTax({
        grossCents: 100_000,
        jurisdiction: 'US_W8',
        certificateStatus: 'verified',
        customTreatyRatePct: 15.0,
      });

      expect(fifteenTreaty.ratePct).toBe(15.0);
      expect(fifteenTreaty.withholdingCents).toBe(15_000);
      expect(fifteenTreaty.netCents).toBe(85_000);
    });
  });

  describe('EU Reverse Charge & Singapore Non-Resident', () => {
    it('applies 0% withholding for EU B2B reverse charge under Article 196', () => {
      const result = calculateWithholdingTax({
        grossCents: 100_000,
        jurisdiction: 'EU_RC',
      });

      expect(result.ratePct).toBe(0.0);
      expect(result.withholdingCents).toBe(0);
      expect(result.netCents).toBe(100_000);
      expect(result.treatyApplied).toBe(true);
      expect(result.complianceNote).toContain('Article 196 VAT Directive');
    });

    it('applies 15% withholding for Singapore non-resident agency fee under Section 45', () => {
      const result = calculateWithholdingTax({
        grossCents: 100_000,
        jurisdiction: 'SG_NR',
      });

      expect(result.ratePct).toBe(15.0);
      expect(result.withholdingCents).toBe(15_000);
      expect(result.netCents).toBe(85_000);
      expect(result.complianceNote).toContain('Singapore IRAS Section 45');
    });

    it('applies 0% for Standard Zero domestic jurisdiction', () => {
      const result = calculateWithholdingTax({
        grossCents: 50_000,
        jurisdiction: 'STANDARD_ZERO',
      });

      expect(result.ratePct).toBe(0.0);
      expect(result.withholdingCents).toBe(0);
      expect(result.netCents).toBe(50_000);
    });
  });

  describe('Edge Cases and Invariants', () => {
    it('preserves exact dollar conservation (net + wht === gross)', () => {
      const testCases = [
        { gross: 333, rate: 'VN_FCT' as const },
        { gross: 777, rate: 'US_W8' as const },
        { gross: 12345, rate: 'SG_NR' as const },
        { gross: 99999, rate: 'VN_FCT' as const, isIndividual: true },
      ];

      for (const tc of testCases) {
        const res = calculateWithholdingTax({
          grossCents: tc.gross,
          jurisdiction: tc.rate,
          isIndividual: tc.isIndividual,
        });
        expect(res.netCents + res.withholdingCents).toBe(tc.gross);
        expect(res.withholdingCents).toBeGreaterThanOrEqual(0);
        expect(res.netCents).toBeGreaterThanOrEqual(0);
      }
    });

    it('safely clamps negative amounts to 0', () => {
      const result = calculateWithholdingTax({
        grossCents: -5000,
        jurisdiction: 'VN_FCT',
      });
      expect(result.grossCents).toBe(0);
      expect(result.withholdingCents).toBe(0);
      expect(result.netCents).toBe(0);
    });
  });
});

describe('Cross-Border Multi-Currency Payout Engine', () => {
  describe('Zero-Decimal Currencies (VND, JPY)', () => {
    it('correctly identifies zero-decimal currencies', () => {
      expect(isZeroDecimalCurrency('VND')).toBe(true);
      expect(isZeroDecimalCurrency('JPY')).toBe(true);
      expect(isZeroDecimalCurrency('USD')).toBe(false);
      expect(isZeroDecimalCurrency('EUR')).toBe(false);
      expect(isZeroDecimalCurrency('GBP')).toBe(false);
    });

    it('computes integer VND payout with 10% FCT and +1.5% volatility buffer', () => {
      // 100,000 cents ($1,000)
      // 10% FCT = 10,000 cents ($100), net = 90,000 cents ($900)
      // Base FX rate: 25,450 VND / USD
      // Effective FX rate = 25,450 * (1 - 0.015) = 25,068.25
      // Net payout = floor(900 * 25,068.25) = 22,561,425 VND
      const { tax, payout } = calculateCrossBorderPayout({
        grossCents: 100_000,
        jurisdiction: 'VN_FCT',
        targetCurrency: 'VND',
        baseFxRate: 25_450.0,
      });

      expect(tax.withholdingCents).toBe(10_000);
      expect(tax.netCents).toBe(90_000);
      expect(payout.hedgingBufferPct).toBe(1.5);
      expect(payout.effectiveFxRate).toBeCloseTo(25_068.25, 2);
      expect(payout.localPayoutAmount).toBe(22_561_425);
      expect(payout.isZeroDecimalCurrency).toBe(true);
    });

    it('computes integer JPY payout with verified W-8 treaty rate and +1.5% buffer', () => {
      // 100,000 cents ($1,000)
      // Verified W-8 10% treaty = 10,000 cents, net = 90,000 cents ($900)
      // Base FX rate: 155.0 JPY / USD
      // Effective FX rate = 155.0 * 0.985 = 152.675
      // Net payout = floor(900 * 152.675) = 137,407 JPY
      const { tax, payout } = calculateCrossBorderPayout({
        grossCents: 100_000,
        jurisdiction: 'US_W8',
        targetCurrency: 'JPY',
        certificateStatus: 'verified',
        baseFxRate: 155.0,
      });

      expect(tax.netCents).toBe(90_000);
      expect(payout.effectiveFxRate).toBeCloseTo(152.675, 3);
      expect(payout.localPayoutAmount).toBe(137_407);
      expect(payout.isZeroDecimalCurrency).toBe(true);
    });
  });

  describe('Decimal Currencies (EUR, GBP, SGD, USD)', () => {
    it('computes minor-unit EUR cents with EU reverse charge and buffer reserve', () => {
      // 100,000 cents ($1,000)
      // EU RC 0% = net 100,000 cents
      // Base FX rate: 0.92 EUR / USD
      // Effective FX rate = 0.92 * 0.985 = 0.9062
      // Local payout = floor(100,000 * 0.9062) = 90,620 EUR cents (€906.20)
      const { tax, payout } = calculateCrossBorderPayout({
        grossCents: 100_000,
        jurisdiction: 'EU_RC',
        targetCurrency: 'EUR',
        baseFxRate: 0.92,
      });

      expect(tax.withholdingCents).toBe(0);
      expect(tax.netCents).toBe(100_000);
      expect(payout.effectiveFxRate).toBeCloseTo(0.9062, 4);
      expect(payout.localPayoutAmount).toBe(90_620);
      expect(payout.isZeroDecimalCurrency).toBe(false);
    });

    it('computes minor-unit GBP pence with statutory 30% W-8 and buffer reserve', () => {
      // 100,000 cents ($1,000)
      // 30% statutory = 30,000 cents, net = 70,000 cents
      // Base FX rate: 0.78 GBP / USD
      // Effective FX rate = 0.78 * 0.985 = 0.7683
      // Local payout = floor(70,000 * 0.7683) = 53,781 GBP pence (£537.81)
      const { tax, payout } = calculateCrossBorderPayout({
        grossCents: 100_000,
        jurisdiction: 'US_W8',
        targetCurrency: 'GBP',
        certificateStatus: 'pending',
        baseFxRate: 0.78,
      });

      expect(tax.withholdingCents).toBe(30_000);
      expect(tax.netCents).toBe(70_000);
      expect(payout.effectiveFxRate).toBeCloseTo(0.7683, 4);
      expect(payout.localPayoutAmount).toBe(53_781);
    });

    it('falls back to bedrock rates when baseFxRate is omitted', () => {
      const { payout } = calculateCrossBorderPayout({
        grossCents: 10_000,
        jurisdiction: 'STANDARD_ZERO',
        targetCurrency: 'SGD',
      });

      expect(payout.baseFxRate).toBe(BEDROCK_LEDGER_FX_RATES.SGD);
      expect(payout.effectiveFxRate).toBeCloseTo(BEDROCK_LEDGER_FX_RATES.SGD * 0.985, 3);
    });
  });

  describe('D1 Database Persistence & Ledger Lifecycle', () => {
    it('records a new cross-border commission entry into D1', async () => {
      const mockRun = vi.fn().mockResolvedValue({ meta: { changes: 1 } });
      const mockBind = vi.fn().mockReturnValue({ run: mockRun });
      const mockPrepare = vi.fn().mockReturnValue({ bind: mockBind });

      const mockDb = {
        prepare: mockPrepare,
      } as unknown as D1Database;

      const entry = await recordCrossBorderCommission(mockDb, {
        partnerId: 'partner-vn-01',
        orderId: 'order-12345',
        grossCents: 100_000,
        whtJurisdiction: 'VN_FCT',
        payoutCurrency: 'VND',
        baseFxRate: 25_450.0,
      });

      expect(entry.partner_id).toBe('partner-vn-01');
      expect(entry.order_id).toBe('order-12345');
      expect(entry.gross_commission_cents).toBe(100_000);
      expect(entry.wht_amount_cents).toBe(10_000);
      expect(entry.net_commission_cents).toBe(90_000);
      expect(entry.net_payout_local_amount).toBe(22_561_425);
      expect(entry.status).toBe('accrued');

      expect(mockPrepare).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO partner_cross_border_ledger'));
      expect(mockRun).toHaveBeenCalledTimes(1);
    });

    it('retrieves ledger history and computes partner financial summary', async () => {
      const mockEntries: PartnerCrossBorderLedgerEntry[] = [
        {
          id: 'cb_1',
          partner_id: 'partner-1',
          order_id: 'ord_1',
          payout_batch_id: 'batch_1',
          gross_commission_cents: 100_000,
          wht_jurisdiction: 'VN_FCT',
          wht_rate_pct: 10,
          wht_amount_cents: 10_000,
          net_commission_cents: 90_000,
          payout_currency: 'VND',
          applied_fx_rate: 25068.25,
          hedging_buffer_pct: 1.5,
          net_payout_local_amount: 22_561_425,
          tax_id_number: '0123456789',
          tax_certificate_status: 'verified',
          status: 'settled',
          created_at: 1000,
          settled_at: 2000,
        },
        {
          id: 'cb_2',
          partner_id: 'partner-1',
          order_id: 'ord_2',
          payout_batch_id: null,
          gross_commission_cents: 50_000,
          wht_jurisdiction: 'VN_FCT',
          wht_rate_pct: 10,
          wht_amount_cents: 5_000,
          net_commission_cents: 45_000,
          payout_currency: 'VND',
          applied_fx_rate: 25068.25,
          hedging_buffer_pct: 1.5,
          net_payout_local_amount: 11_280_712,
          tax_id_number: '0123456789',
          tax_certificate_status: 'verified',
          status: 'accrued',
          created_at: 3000,
          settled_at: null,
        },
      ];

      const mockAll = vi.fn().mockResolvedValue({ results: mockEntries });
      const mockBind = vi.fn().mockReturnValue({ all: mockAll });
      const mockPrepare = vi.fn().mockReturnValue({ bind: mockBind });

      const mockDb = {
        prepare: mockPrepare,
      } as unknown as D1Database;

      const entries = await getCrossBorderLedgerByPartner(mockDb, 'partner-1');
      expect(entries).toHaveLength(2);

      const summary = await getCrossBorderLedgerSummary(mockDb, 'partner-1');
      expect(summary.totalGrossCents).toBe(150_000);
      expect(summary.totalWithheldCents).toBe(15_000);
      expect(summary.totalNetCents).toBe(135_000);
      expect(summary.accruedCount).toBe(1);
      expect(summary.settledCount).toBe(1);
      expect(summary.totalSettledLocalAmounts['VND']).toBe(22_561_425);
    });

    it('settles an accrued ledger entry', async () => {
      const settledEntry: PartnerCrossBorderLedgerEntry = {
        id: 'cb_accrued',
        partner_id: 'partner-1',
        order_id: 'ord_1',
        payout_batch_id: 'batch_new',
        gross_commission_cents: 50_000,
        wht_jurisdiction: 'EU_RC',
        wht_rate_pct: 0,
        wht_amount_cents: 0,
        net_commission_cents: 50_000,
        payout_currency: 'EUR',
        applied_fx_rate: 0.9062,
        hedging_buffer_pct: 1.5,
        net_payout_local_amount: 45_310,
        tax_id_number: 'FR12345678901',
        tax_certificate_status: 'verified',
        status: 'settled',
        created_at: 1000,
        settled_at: 5000,
      };

      const mockRun = vi.fn().mockResolvedValue({ meta: { changes: 1 } });
      const mockFirst = vi.fn().mockResolvedValue(settledEntry);

      const mockPrepare = vi.fn((sql: string) => {
        if (sql.includes('UPDATE')) {
          return { bind: vi.fn().mockReturnValue({ run: mockRun }) };
        }
        return { bind: vi.fn().mockReturnValue({ first: mockFirst }) };
      });

      const mockDb = { prepare: mockPrepare } as unknown as D1Database;

      const result = await settleCrossBorderPayout(mockDb, 'cb_accrued', 'batch_new');
      expect(result.status).toBe('settled');
      expect(result.payout_batch_id).toBe('batch_new');
    });

    it('throws error when settling a non-existent or already settled entry', async () => {
      const mockRun = vi.fn().mockResolvedValue({ meta: { changes: 0 } });
      const mockPrepare = vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({ run: mockRun }),
      });
      const mockDb = { prepare: mockPrepare } as unknown as D1Database;

      await expect(
        settleCrossBorderPayout(mockDb, 'non_existent', 'batch_1')
      ).rejects.toThrow(/not found or not in 'accrued' state/);
    });
  });
});
