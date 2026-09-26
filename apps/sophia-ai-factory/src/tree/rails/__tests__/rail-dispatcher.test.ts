/**
 * Unit & Integration Test Suite: Unified Payment Rail Dispatcher
 *
 * Tests:
 * 1. Dispatching across all 6 localized payment rails:
 *    - SEPA_DIRECT_DEBIT (EU)
 *    - PROMPTPAY (TH)
 *    - PAYNOW (SG)
 *    - GRABPAY (SEA)
 *    - PAYOS_VIETQR (VN)
 *    - NOWPAYMENTS_CRYPTO (Global)
 * 2. Multi-currency coverage across all 10 currencies (USD, EUR, GBP, JPY, SGD, AUD, CAD, VND, THB, IDR)
 * 3. Dynamic FX hedging +1.5% buffer reserve integration
 * 4. Automated multi-jurisdiction tax integration (EU VAT MOSS, SG GST, VN TT78)
 * 5. Annual commitment discount (10 months price) vs Monthly billing
 *
 * Layer: tree/rails/__tests__
 */

import { describe, it, expect } from 'vitest';
import {
  dispatchLocalizedPaymentIntent,
  resolveTierPriceCents,
} from '../rail-dispatcher';
import { ALL_SUPPORTED_CURRENCIES } from '@/seed/types/enterprise-billing';

describe('Unified Payment Rail Dispatcher Suite', () => {
  // =========================================================================
  // 1. Tier Pricing and Annual Discount
  // =========================================================================
  describe('1. resolveTierPriceCents', () => {
    it('returns exact base monthly pricing for tiers in USD cents', () => {
      expect(resolveTierPriceCents('BASIC', 'monthly')).toBe(9900);      // $99.00
      expect(resolveTierPriceCents('PREMIUM', 'monthly')).toBe(29900);   // $299.00
      expect(resolveTierPriceCents('ENTERPRISE', 'monthly')).toBe(79900);// $799.00
      expect(resolveTierPriceCents('MASTER', 'monthly')).toBe(199900);   // $1999.00
    });

    it('applies 2 months free (10x monthly price) for annual commitment', () => {
      expect(resolveTierPriceCents('BASIC', 'annual')).toBe(99000);      // $990.00
      expect(resolveTierPriceCents('PREMIUM', 'annual')).toBe(299000);   // $2990.00
      expect(resolveTierPriceCents('ENTERPRISE', 'annual')).toBe(799000);// $7990.00
    });
  });

  // =========================================================================
  // 2. Localized Rail Dispatching
  // =========================================================================
  describe('2. Rail Dispatching', () => {
    it('dispatches SEPA Direct Debit intent with validated mandate reference', async () => {
      const result = await dispatchLocalizedPaymentIntent({
        orgId: 'org_eu',
        userId: 'usr_eu',
        tier: 'PREMIUM',
        billingCycle: 'monthly',
        rail: 'SEPA_DIRECT_DEBIT',
        currency: 'EUR',
        customerEmail: 'hans@example.de',
        customerName: 'Hans Müller',
        billingCountry: 'DE',
        customerType: 'B2B',
        taxId: 'DE123456789',
        iban: 'DE89370400440532013000',
        bic: 'DEUTDEDD',
      });

      expect(result.status).toBe('pending');
      expect(result.rail).toBe('SEPA_DIRECT_DEBIT');
      expect(result.currency).toBe('EUR');
      expect(result.mandateReference).toBeDefined();
      expect(result.mandateReference).toContain('SAF-SEPA-');
      expect(result.taxJurisdiction).toBe('EU_MOSS');
      expect(result.taxRate).toBe(0.0); // B2B Reverse charge
      expect(result.bufferReserveCents).toBeGreaterThan(0);
    });

    it('requires IBAN for SEPA Direct Debit', async () => {
      await expect(
        dispatchLocalizedPaymentIntent({
          orgId: 'org_eu',
          userId: 'usr_eu',
          tier: 'PREMIUM',
          billingCycle: 'monthly',
          rail: 'SEPA_DIRECT_DEBIT',
          currency: 'EUR',
          customerEmail: 'test@example.de',
          customerName: 'Test',
          billingCountry: 'DE',
          customerType: 'B2C',
        }),
      ).rejects.toThrow(/IBAN is required/);
    });

    it('dispatches PromptPay Thai QR with valid EMVCo QR code string', async () => {
      const result = await dispatchLocalizedPaymentIntent({
        orgId: 'org_th',
        userId: 'usr_th',
        tier: 'BASIC',
        billingCycle: 'monthly',
        rail: 'PROMPTPAY',
        currency: 'THB',
        customerEmail: 'somchai@example.co.th',
        customerName: 'Somchai Prasert',
        billingCountry: 'TH',
        customerType: 'B2C',
        mobileNumber: '0812345678',
      });

      expect(result.status).toBe('pending');
      expect(result.rail).toBe('PROMPTPAY');
      expect(result.currency).toBe('THB');
      expect(result.qrPayload).toBeDefined();
      expect(result.qrPayload?.startsWith('000201')).toBe(true);
      expect(result.qrPayload).toContain('A000000677010111'); // PromptPay AID
      expect(result.qrImageUrl).toContain('api.qrserver.com');
      expect(result.totalAmount).toBeGreaterThan(0);
    });

    it('dispatches PayNow SGQR with valid Singapore QR code string', async () => {
      const result = await dispatchLocalizedPaymentIntent({
        orgId: 'org_sg',
        userId: 'usr_sg',
        tier: 'GROWTH',
        billingCycle: 'monthly',
        rail: 'PAYNOW',
        currency: 'SGD',
        customerEmail: 'tan@example.sg',
        customerName: 'Tan Ah Kow',
        billingCountry: 'SG',
        customerType: 'B2B',
        taxId: '202412345A',
      });

      expect(result.status).toBe('pending');
      expect(result.rail).toBe('PAYNOW');
      expect(result.currency).toBe('SGD');
      expect(result.qrPayload).toBeDefined();
      expect(result.qrPayload).toContain('SG.PAYNOW');
      expect(result.qrImageUrl).toBeDefined();
      expect(result.taxJurisdiction).toBe('SG_GST');
      expect(result.taxRate).toBe(0.0); // B2B Reverse charge
    });

    it('dispatches GrabPay checkout session with redirect URL', async () => {
      const result = await dispatchLocalizedPaymentIntent({
        orgId: 'org_sg',
        userId: 'usr_sg',
        tier: 'CREATOR',
        billingCycle: 'monthly',
        rail: 'GRABPAY',
        currency: 'SGD',
        customerEmail: 'lee@example.sg',
        customerName: 'Lee Wei',
        billingCountry: 'SG',
        customerType: 'B2C',
      });

      expect(result.status).toBe('pending');
      expect(result.rail).toBe('GRABPAY');
      expect(result.checkoutUrl).toBeDefined();
      expect(result.checkoutUrl).toContain('pay.grab.com');
      expect(result.taxJurisdiction).toBe('SG_GST');
      expect(result.taxRate).toBe(0.09); // B2C 9% GST
    });

    it('dispatches PayOS VietQR for Vietnam customers with software tax exemption', async () => {
      const result = await dispatchLocalizedPaymentIntent({
        orgId: 'org_vn',
        userId: 'usr_vn',
        tier: 'BASIC',
        billingCycle: 'monthly',
        rail: 'PAYOS_VIETQR',
        currency: 'VND',
        customerEmail: 'nguyen@example.vn',
        customerName: 'Nguyen Van A',
        billingCountry: 'VN',
        customerType: 'B2B',
        taxId: '0101234567',
      });

      expect(result.status).toBe('pending');
      expect(result.rail).toBe('PAYOS_VIETQR');
      expect(result.currency).toBe('VND');
      expect(result.qrPayload).toBeDefined();
      expect(result.qrImageUrl).toContain('vietqr.io');
      expect(result.taxJurisdiction).toBe('VN_TT78');
      expect(result.taxRate).toBe(0.0); // Software exempt
      expect(result.totalAmount % 1000).toBe(0); // 1,000 VND bank note rounding
    });

    it('dispatches NOWPayments crypto for international multi-currency settlement', async () => {
      const result = await dispatchLocalizedPaymentIntent({
        orgId: 'org_global',
        userId: 'usr_global',
        tier: 'ENTERPRISE',
        billingCycle: 'annual',
        rail: 'NOWPAYMENTS_CRYPTO',
        currency: 'USD',
        customerEmail: 'crypto@example.com',
        customerName: 'Global Corp',
        billingCountry: 'US',
        customerType: 'B2B',
      });

      expect(result.status).toBe('pending');
      expect(result.rail).toBe('NOWPAYMENTS_CRYPTO');
      expect(result.checkoutUrl).toContain('nowpayments.io');
      expect(result.baseAmountCents).toBe(799000); // 10x monthly
    });
  });

  // =========================================================================
  // 3. Multi-Currency Hedging Across All 10 Currencies
  // =========================================================================
  describe('3. Multi-Currency Dispatch Invariance', () => {
    it('successfully calculates payment intent across all 10 supported currencies', async () => {
      for (const currency of ALL_SUPPORTED_CURRENCIES) {
        const result = await dispatchLocalizedPaymentIntent({
          orgId: 'org_test',
          userId: 'usr_test',
          tier: 'BASIC',
          billingCycle: 'monthly',
          rail: 'NOWPAYMENTS_CRYPTO',
          currency,
          customerEmail: 'tester@example.com',
          customerName: 'Tester',
          billingCountry: 'US',
          customerType: 'B2B',
        });

        expect(result.totalAmount).toBeGreaterThan(0);
        expect(result.hedgedRate).toBeGreaterThan(0);
        expect(result.marketRate).toBeGreaterThan(0);

        // Zero-decimal currencies must have integer amounts
        if (currency === 'JPY' || currency === 'VND' || currency === 'IDR') {
          expect(Number.isInteger(result.totalAmount)).toBe(true);
        }
      }
    });
  });
});
