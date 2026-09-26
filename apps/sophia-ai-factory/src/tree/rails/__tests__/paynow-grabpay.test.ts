/**
 * Unit & Adversarial Test Suite: PayNow & GrabPay Payment Rail
 *
 * Tests:
 * 1. Singapore SGQR EMVCo encoding (Tag 26 SG.PAYNOW, Tag 53 702 SGD)
 * 2. PayNow proxy types (UEN vs Mobile)
 * 3. GrabPay session generator & multi-currency support
 * 4. Error boundaries (negative amounts, zero amounts)
 *
 * Layer: tree/rails/__tests__
 */

import { describe, it, expect } from 'vitest';
import {
  generatePayNowQrPayload,
  createGrabPaySession,
} from '../paynow-grabpay';

describe('PayNow & GrabPay Payment Rail Suite', () => {
  // =========================================================================
  // 1. PayNow SGQR Payload Generation
  // =========================================================================
  describe('1. PayNow SGQR', () => {
    it('generates a valid SGQR EMVCo payload with Singapore UEN', () => {
      const payload = generatePayNowQrPayload({
        proxyType: 'uen',
        proxyValue: '202412345A',
        amount: 299.00,
        reference: 'SGREF999',
      });

      expect(payload.currency).toBe('SGD');
      expect(payload.amount).toBe(299.00);
      expect(payload.proxyType).toBe('uen');
      expect(payload.reference).toBe('SGREF999');

      const qr = payload.qrString;
      // Payload format indicator 000201
      expect(qr.startsWith('000201')).toBe(true);
      // Contains PayNow AID
      expect(qr).toContain('SG.PAYNOW');
      // Contains UEN
      expect(qr).toContain('202412345A');
      // Contains SGD currency code: 5303702
      expect(qr).toContain('5303702');
      // Contains amount: 5406299.00
      expect(qr).toContain('5406299.00');
      // Contains SG country code: 5802SG
      expect(qr).toContain('5802SG');
      // Ends with 6304 + 4 hex CRC
      expect(qr).toMatch(/6304[0-9A-F]{4}$/);
    });

    it('supports mobile number proxy with code 0', () => {
      const payload = generatePayNowQrPayload({
        proxyType: 'mobile',
        proxyValue: '+6591234567',
        amount: 50.00,
      });

      expect(payload.proxyType).toBe('mobile');
      expect(payload.qrString).toContain('+6591234567');
      expect(payload.qrString).toMatch(/6304[0-9A-F]{4}$/);
    });

    it('rejects zero or negative amounts', () => {
      expect(() => {
        generatePayNowQrPayload({
          proxyType: 'uen',
          proxyValue: '202412345A',
          amount: 0,
        });
      }).toThrow(/must be positive/);
    });
  });

  // =========================================================================
  // 2. GrabPay Session Adapter
  // =========================================================================
  describe('2. GrabPay Session Adapter', () => {
    it('creates an active GrabPay checkout session with redirect URL', () => {
      const session = createGrabPaySession({
        orgId: 'org_test_123',
        userId: 'usr_test_456',
        amount: 799.00,
        currency: 'SGD',
      });

      expect(session.paymentStatus).toBe('created');
      expect(session.amount).toBe(799.00);
      expect(session.currency).toBe('SGD');
      expect(session.sessionId).toContain('grab_sess_');
      expect(session.checkoutUrl).toContain('pay.grab.com');
      expect(session.expiresAt).toBeGreaterThan(Date.now());
    });

    it('rejects negative or zero amounts for GrabPay', () => {
      expect(() => {
        createGrabPaySession({
          orgId: 'org_test',
          userId: 'usr_test',
          amount: -50,
          currency: 'SGD',
        });
      }).toThrow(/greater than zero/);
    });
  });
});
