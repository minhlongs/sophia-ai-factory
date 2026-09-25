/**
 * Unit Test Suite: Enterprise Volume Discount Calculator & Contract Terms
 *
 * Verifies 50K–500K MCU/month tiered capacity pricing, 17% annual savings,
 * 99.9% SLA uptime calculation, permitted downtime (43m 49s), service credit remedies,
 * and bilingual legal terms generation.
 */

import { describe, it, expect } from 'vitest';
import {
  getVolumeDiscountBracket,
  calculateEnterpriseVolumeDiscount,
  calculateOverageUnitPriceCents,
} from '@/tree/contracts/volume-discount-calculator';
import {
  calculateMonthlyPermittedDowntime,
  resolveSlaServiceCredit,
  generateContractLegalTerms,
  generateContractHtml,
  PERMITTED_MONTHLY_DOWNTIME_FORMATTED,
} from '@/tree/contracts/contract-generator';
import type { EnterpriseContract } from '@/seed/types/enterprise-contracts';

describe('Volume Discount Calculator', () => {
  describe('getVolumeDiscountBracket', () => {
    it('resolves SCALE_50K (20% discount) for 50,000 to 99,999 MCU', () => {
      const b50k = getVolumeDiscountBracket(50_000);
      expect(b50k.code).toBe('SCALE_50K');
      expect(b50k.discountPercent).toBe(0.20);
      expect(b50k.effectivePricePerMcuCents).toBe(4.0);

      const b75k = getVolumeDiscountBracket(75_000);
      expect(b75k.code).toBe('SCALE_50K');

      const b99k = getVolumeDiscountBracket(99_999);
      expect(b99k.code).toBe('SCALE_50K');
    });

    it('resolves SCALE_100K (30% discount) for 100,000 to 249,999 MCU', () => {
      const b100k = getVolumeDiscountBracket(100_000);
      expect(b100k.code).toBe('SCALE_100K');
      expect(b100k.discountPercent).toBe(0.30);
      expect(b100k.effectivePricePerMcuCents).toBe(3.5);

      const b200k = getVolumeDiscountBracket(200_000);
      expect(b200k.code).toBe('SCALE_100K');

      const b249k = getVolumeDiscountBracket(249_999);
      expect(b249k.code).toBe('SCALE_100K');
    });

    it('resolves SCALE_250K (45% discount) for 250,000 to 499,999 MCU', () => {
      const b250k = getVolumeDiscountBracket(250_000);
      expect(b250k.code).toBe('SCALE_250K');
      expect(b250k.discountPercent).toBe(0.45);
      expect(b250k.effectivePricePerMcuCents).toBe(2.75);

      const b400k = getVolumeDiscountBracket(400_000);
      expect(b400k.code).toBe('SCALE_250K');
    });

    it('resolves SCALE_500K (60% discount) for 500,000+ MCU', () => {
      const b500k = getVolumeDiscountBracket(500_000);
      expect(b500k.code).toBe('SCALE_500K');
      expect(b500k.discountPercent).toBe(0.60);
      expect(b500k.effectivePricePerMcuCents).toBe(2.0);

      const b1m = getVolumeDiscountBracket(1_000_000);
      expect(b1m.code).toBe('SCALE_500K');
      expect(b1m.effectivePricePerMcuCents).toBe(2.0);
    });

    it('throws when requested capacity is below 50,000 MCU minimum', () => {
      expect(() => getVolumeDiscountBracket(49_999)).toThrow(/Minimum enterprise commitment/);
      expect(() => getVolumeDiscountBracket(0)).toThrow();
      expect(() => getVolumeDiscountBracket(-100)).toThrow();
      expect(() => getVolumeDiscountBracket(Number.NaN)).toThrow();
    });
  });

  describe('calculateEnterpriseVolumeDiscount', () => {
    it('calculates monthly billing commitments accurately without annual discount', () => {
      // 50,000 MCU at 4.0 cents = $2,000 / month
      const res50k = calculateEnterpriseVolumeDiscount(50_000, 'monthly');
      expect(res50k.unitPricePerMcuCents).toBe(4.0);
      expect(res50k.monthlyCommitmentCents).toBe(200_000);
      expect(res50k.monthlyCommitmentUsd).toBe(2_000);
      expect(res50k.annualCommitmentCents).toBe(2_400_000);
      expect(res50k.annualSavingsCents).toBe(0);

      // 100,000 MCU at 3.5 cents = $3,500 / month
      const res100k = calculateEnterpriseVolumeDiscount(100_000, 'monthly');
      expect(res100k.unitPricePerMcuCents).toBe(3.5);
      expect(res100k.monthlyCommitmentCents).toBe(350_000);
      expect(res100k.monthlyCommitmentUsd).toBe(3_500);

      // 250,000 MCU at 2.75 cents = $6,875 / month
      const res250k = calculateEnterpriseVolumeDiscount(250_000, 'monthly');
      expect(res250k.unitPricePerMcuCents).toBe(2.75);
      expect(res250k.monthlyCommitmentCents).toBe(687_500);
      expect(res250k.monthlyCommitmentUsd).toBe(6_875);

      // 500,000 MCU at 2.0 cents = $10,000 / month
      const res500k = calculateEnterpriseVolumeDiscount(500_000, 'monthly');
      expect(res500k.unitPricePerMcuCents).toBe(2.0);
      expect(res500k.monthlyCommitmentCents).toBe(1_000_000);
      expect(res500k.monthlyCommitmentUsd).toBe(10_000);
    });

    it('calculates 17% annual prepay savings accurately for all brackets', () => {
      // 50K Annual: 12 * $2,000 = $24,000. 17% savings = $4,080. Annual total = $19,920
      const res50kAnnual = calculateEnterpriseVolumeDiscount(50_000, 'annual');
      expect(res50kAnnual.monthlyCommitmentCents).toBe(200_000);
      expect(res50kAnnual.annualSavingsCents).toBe(408_000); // $4,080.00
      expect(res50kAnnual.annualCommitmentCents).toBe(1_992_000); // $19,920.00
      expect(res50kAnnual.annualCommitmentUsd).toBe(19_920);

      // 100K Annual: 12 * $3,500 = $42,000. 17% savings = $7,140. Annual total = $34,860
      const res100kAnnual = calculateEnterpriseVolumeDiscount(100_000, 'annual');
      expect(res100kAnnual.annualSavingsCents).toBe(714_000);
      expect(res100kAnnual.annualCommitmentCents).toBe(3_486_000);
      expect(res100kAnnual.annualCommitmentUsd).toBe(34_860);

      // 250K Annual: 12 * $6,875 = $82,500. 17% savings = $14,025. Annual total = $68,475
      const res250kAnnual = calculateEnterpriseVolumeDiscount(250_000, 'annual');
      expect(res250kAnnual.annualSavingsCents).toBe(1_402_500);
      expect(res250kAnnual.annualCommitmentCents).toBe(6_847_500);
      expect(res250kAnnual.annualCommitmentUsd).toBe(68_475);

      // 500K Annual: 12 * $10,000 = $120,000. 17% savings = $20,400. Annual total = $99,600
      const res500kAnnual = calculateEnterpriseVolumeDiscount(500_000, 'annual');
      expect(res500kAnnual.annualSavingsCents).toBe(2_040_000);
      expect(res500kAnnual.annualCommitmentCents).toBe(9_960_000);
      expect(res500kAnnual.annualCommitmentUsd).toBe(99_600);
    });
  });

  describe('calculateOverageUnitPriceCents', () => {
    it('returns contracted effective unit rate for burst compute overage', () => {
      expect(calculateOverageUnitPriceCents(50_000)).toBe(4.0);
      expect(calculateOverageUnitPriceCents(100_000)).toBe(3.5);
      expect(calculateOverageUnitPriceCents(250_000)).toBe(2.75);
      expect(calculateOverageUnitPriceCents(500_000)).toBe(2.0);
    });
  });
});

describe('Enterprise SLA Terms & Remedies Generator', () => {
  it('calculates 99.9% permitted downtime as exactly 43m 49s per month', () => {
    const downtime = calculateMonthlyPermittedDowntime();
    expect(downtime.formatted).toBe(PERMITTED_MONTHLY_DOWNTIME_FORMATTED);
    expect(downtime.formatted).toBe('43m 49s');
    expect(downtime.totalMinutes).toBe(43830);
    expect(downtime.permittedDowntimeMinutes).toBeCloseTo(43.83, 2);
  });

  it('resolves correct service credit remedy tier according to availability schedule', () => {
    // Normal SLA target met (>= 99.90%)
    expect(resolveSlaServiceCredit(100.0).creditPercent).toBe(0);
    expect(resolveSlaServiceCredit(99.95).creditPercent).toBe(0);
    expect(resolveSlaServiceCredit(99.90).creditPercent).toBe(0);

    // Minor degradation (99.00% - 99.89%) -> 10% credit
    expect(resolveSlaServiceCredit(99.85).creditPercent).toBe(10);
    expect(resolveSlaServiceCredit(99.00).creditPercent).toBe(10);

    // Moderate degradation (95.00% - 98.99%) -> 25% credit
    expect(resolveSlaServiceCredit(98.50).creditPercent).toBe(25);
    expect(resolveSlaServiceCredit(95.00).creditPercent).toBe(25);

    // Critical degradation (< 95.00%) -> 50% credit
    expect(resolveSlaServiceCredit(94.99).creditPercent).toBe(50);
    expect(resolveSlaServiceCredit(85.00).creditPercent).toBe(50);
    expect(resolveSlaServiceCredit(0.0).creditPercent).toBe(50);
  });

  it('generates bilingual VI/EN legal contract terms with all commitments', () => {
    const contract: EnterpriseContract = {
      id: 'ec_test_123',
      orgId: 'org_acme_corp',
      contractNumber: 'CNT-20260925-ABCD',
      status: 'pending_signature',
      slaUptimePercent: 99.9,
      mcuCapacityMonthly: 100_000,
      billingCycle: 'annual',
      unitPricePerMcuCents: 3.5,
      volumeDiscountPercent: 0.30,
      monthlyCommitmentCents: 350_000,
      annualCommitmentCents: 3_486_000,
      currency: 'USD',
      contractSha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      termsVersion: '2026.1-ENTERPRISE-SLA',
      effectiveDate: '2026-10-01',
      expirationDate: '2027-10-01',
      customerSignerName: 'Nguyen Van A',
      customerSignerEmail: 'a@acme.com',
      customerSignerTitle: 'Chief Technology Officer',
      createdAt: 1727280000,
      updatedAt: 1727280000,
    };

    // Vietnamese terms
    const viTerms = generateContractLegalTerms(contract, 'vi');
    expect(viTerms).toContain('HỢP ĐỒNG DỊCH VỤ ĐIỆN TOÁN DOANH NGHIỆP');
    expect(viTerms).toContain('CNT-20260925-ABCD');
    expect(viTerms).toContain('100.000 MCU');
    expect(viTerms).toContain('$0.0350/MCU');
    expect(viTerms).toContain('30%');
    expect(viTerms).toContain('43m 49s');
    expect(viTerms).toContain('99.9%');
    expect(viTerms).toContain('10%');
    expect(viTerms).toContain('25%');
    expect(viTerms).toContain('50%');

    // English terms
    const enTerms = generateContractLegalTerms(contract, 'en');
    expect(enTerms).toContain('ENTERPRISE COMPUTE SERVICE AGREEMENT');
    expect(enTerms).toContain('CNT-20260925-ABCD');
    expect(enTerms).toContain('100,000 MCU');
    expect(enTerms).toContain('43m 49s');
    expect(enTerms).toContain('99.9%');

    // HTML document
    const html = generateContractHtml(contract, 'vi');
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('CNT-20260925-ABCD');
    expect(html).toContain('43m 49s');
    expect(html).toContain('Nguyen Van A');
  });
});
