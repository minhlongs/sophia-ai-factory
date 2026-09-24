import { describe, it, expect } from 'vitest';
import {
  calculateAnnualCommitmentQuote,
  calculateProratedUpgrade,
  normalizeTierKey,
} from '../annual-commitment-engine';
import type { FxRateMap } from '@/seed/types/enterprise-billing';

describe('tree/billing/annual-commitment-engine', () => {
  describe('normalizeTierKey', () => {
    it('normalizes tier names and recognized aliases', () => {
      expect(normalizeTierKey('starter')).toBe('STARTER');
      expect(normalizeTierKey('basic')).toBe('STARTER');
      expect(normalizeTierKey('creator')).toBe('CREATOR');
      expect(normalizeTierKey('growth')).toBe('CREATOR');
      expect(normalizeTierKey('premium')).toBe('CREATOR');
      expect(normalizeTierKey('pro')).toBe('PRO');
      expect(normalizeTierKey('agency')).toBe('AGENCY');
      expect(normalizeTierKey('enterprise')).toBe('ENTERPRISE');
      expect(normalizeTierKey('master')).toBe('MASTER');
    });
  });

  describe('calculateAnnualCommitmentQuote', () => {
    it('calculates 20% discount (2 months free) on STARTER tier', () => {
      const quote = calculateAnnualCommitmentQuote('STARTER');
      expect(quote.tier).toBe('STARTER');
      expect(quote.billingCycle).toBe('annual');
      expect(quote.currency).toBe('USD');
      expect(quote.monthlyPriceCents).toBe(19900); // $199
      expect(quote.annualPriceCents).toBe(199000); // 10 * $199 = $1,990
      expect(quote.savingsCents).toBe(39800); // 2 * $199 = $398
      expect(quote.monthsFree).toBe(2);
      expect(quote.discountPercentage).toBe(20);
      expect(quote.convertedAnnualPrice).toBe('$1,990.00');
      expect(quote.convertedSavings).toBe('$398.00');
    });

    it('calculates 20% discount (2 months free) on CREATOR tier', () => {
      const quote = calculateAnnualCommitmentQuote('CREATOR');
      expect(quote.tier).toBe('CREATOR');
      expect(quote.monthlyPriceCents).toBe(39900);
      expect(quote.annualPriceCents).toBe(399000);
      expect(quote.savingsCents).toBe(79800);
      expect(quote.convertedAnnualPrice).toBe('$3,990.00');
    });

    it('calculates 20% discount on PRO, AGENCY, ENTERPRISE tiers', () => {
      const pro = calculateAnnualCommitmentQuote('PRO');
      expect(pro.annualPriceCents).toBe(499000);
      expect(pro.savingsCents).toBe(99800);

      const agency = calculateAnnualCommitmentQuote('AGENCY');
      expect(agency.annualPriceCents).toBe(699000);
      expect(agency.savingsCents).toBe(139800);

      const ent = calculateAnnualCommitmentQuote('ENTERPRISE');
      expect(ent.annualPriceCents).toBe(799000);
      expect(ent.savingsCents).toBe(159800);
    });

    it('supports multi-currency conversion for quotes (VND, EUR, JPY, SGD)', () => {
      const vndQuote = calculateAnnualCommitmentQuote('STARTER', 'VND');
      expect(vndQuote.currency).toBe('VND');
      expect(vndQuote.fxRate).toBe(25450.0);
      // 1,990 USD * 25,450 = 50,645,500 VND
      expect(vndQuote.convertedAnnualPrice).toContain('50.645.500');

      const eurQuote = calculateAnnualCommitmentQuote('CREATOR', 'EUR');
      expect(eurQuote.currency).toBe('EUR');
      expect(eurQuote.fxRate).toBe(0.92);
      // 3,990 USD * 0.92 = 3,670.80 EUR (formatted as 3.670,80 € in de-DE)
      expect(eurQuote.convertedAnnualPrice).toContain('3.670,80');
    });

    it('throws error for unrecognized tier', () => {
      expect(() => calculateAnnualCommitmentQuote('UNKNOWN_PLAN')).toThrowError(
        /Unknown tier: "UNKNOWN_PLAN"/,
      );
    });
  });

  describe('calculateProratedUpgrade', () => {
    it('calculates mid-cycle upgrade from STARTER to CREATOR (15 of 30 days remaining)', () => {
      const proration = calculateProratedUpgrade('STARTER', 'CREATOR', 15, 30);
      expect(proration.isUpgrade).toBe(true);
      expect(proration.daysRemainingInCycle).toBe(15);
      expect(proration.totalDaysInCycle).toBe(30);

      // Remaining ratio = 15/30 = 0.5
      // Unused STARTER: 0.5 * 19900 = 9950
      expect(proration.unusedAmountCents).toBe(9950);
      // Prorated CREATOR: 0.5 * 39900 = 19950
      expect(proration.proratedNewTierCents).toBe(19950);
      // Net due: 19950 - 9950 = 10000 cents ($100.00)
      expect(proration.netAmountDueCents).toBe(10000);
      expect(proration.creditCents).toBe(0);
    });

    it('calculates downgrade from ENTERPRISE to PRO with account credit', () => {
      const proration = calculateProratedUpgrade('ENTERPRISE', 'PRO', 15, 30);
      expect(proration.isUpgrade).toBe(false);

      // Unused ENTERPRISE: 0.5 * 79900 = 39950
      expect(proration.unusedAmountCents).toBe(39950);
      // Prorated PRO: 0.5 * 49900 = 24950
      expect(proration.proratedNewTierCents).toBe(24950);
      // Net due: 0
      expect(proration.netAmountDueCents).toBe(0);
      // Credit: 39950 - 24950 = 15000 cents ($150.00)
      expect(proration.creditCents).toBe(15000);
    });

    it('handles leap-year cycle proration (366 days)', () => {
      // 183 days remaining in a 366-day leap year (exactly half year)
      const proration = calculateProratedUpgrade('STARTER', 'ENTERPRISE', 183, 366);
      expect(proration.isUpgrade).toBe(true);
      expect(proration.totalDaysInCycle).toBe(366);
      expect(proration.daysRemainingInCycle).toBe(183);

      // Ratio = 183 / 366 = 0.5
      expect(proration.unusedAmountCents).toBe(9950);
      expect(proration.proratedNewTierCents).toBe(39950);
      expect(proration.netAmountDueCents).toBe(30000);
    });

    it('handles zero days remaining (end of cycle)', () => {
      const proration = calculateProratedUpgrade('STARTER', 'CREATOR', 0, 30);
      expect(proration.daysRemainingInCycle).toBe(0);
      expect(proration.unusedAmountCents).toBe(0);
      expect(proration.proratedNewTierCents).toBe(0);
      expect(proration.netAmountDueCents).toBe(0);
      expect(proration.creditCents).toBe(0);
    });

    it('clamps negative days remaining to zero', () => {
      const proration = calculateProratedUpgrade('STARTER', 'CREATOR', -5, 30);
      expect(proration.daysRemainingInCycle).toBe(0);
      expect(proration.netAmountDueCents).toBe(0);
    });

    it('caps days remaining if greater than total days in cycle', () => {
      const proration = calculateProratedUpgrade('STARTER', 'CREATOR', 45, 30);
      expect(proration.daysRemainingInCycle).toBe(30);
      // Ratio = 1.0
      expect(proration.unusedAmountCents).toBe(19900);
      expect(proration.proratedNewTierCents).toBe(39900);
      expect(proration.netAmountDueCents).toBe(20000);
    });

    it('throws error when totalDaysInCycle is zero or negative', () => {
      expect(() => calculateProratedUpgrade('STARTER', 'CREATOR', 10, 0)).toThrowError(
        /Invalid totalDaysInCycle/,
      );
      expect(() => calculateProratedUpgrade('STARTER', 'CREATOR', 10, -30)).toThrowError(
        /Invalid totalDaysInCycle/,
      );
    });

    it('converts proration amounts into requested currency (e.g. VND)', () => {
      const customRates: FxRateMap = {
        base: 'USD',
        rates: {
          USD: 1.0,
          VND: 25000.0,
          EUR: 0.92,
          JPY: 155.0,
          SGD: 1.35,
        },
        fetchedAt: Date.now(),
        ttlSeconds: 3600,
      };

      const proration = calculateProratedUpgrade('STARTER', 'CREATOR', 15, 30, 'VND', customRates);
      expect(proration.currency).toBe('VND');
      expect(proration.fxRate).toBe(25000.0);
      // Net due in USD was 10,000 cents ($100.00) -> in VND cents: 10,000 * 25,000 = 250,000,000 cents
      expect(proration.netAmountDueCents).toBe(250000000);
    });
  });
});
