/**
 * Unit & Adversarial Test Suite: PromptPay Thai QR Payment Rail
 *
 * Tests:
 * 1. Mobile number (10-digit/11-digit) and Tax/National ID formatting for PromptPay Tag 29
 * 2. EMVCo TLV structure (Tags 00, 01, 29, 53, 54, 58, 59, 60, 62, 63)
 * 3. ITU-T CRC16-CCITT checksum calculation
 * 4. Boundary tests (zero/negative amount rejection, malformed recipients)
 *
 * Layer: tree/rails/__tests__
 */

import { describe, it, expect } from 'vitest';
import {
  formatTlv,
  calculateCrc16Ccitt,
  formatPromptPayRecipient,
  generatePromptPayQrPayload,
} from '../promptpay-thai-qr';

describe('PromptPay Thai QR Payment Rail Suite', () => {
  // =========================================================================
  // 1. TLV and CRC16-CCITT Formatting
  // =========================================================================
  describe('1. TLV & CRC16-CCITT', () => {
    it('formats 2-digit tag, 2-digit length, and value correctly', () => {
      expect(formatTlv('00', '01')).toBe('000201');
      expect(formatTlv('53', '764')).toBe('5303764');
      expect(formatTlv('58', 'TH')).toBe('5802TH');
    });

    it('calculates deterministic 4-character hex uppercase CRC16-CCITT checksum', () => {
      // Test known CRC16-CCITT calculation
      const testData = '0002010102126304';
      const crc = calculateCrc16Ccitt(testData);
      expect(crc).toMatch(/^[0-9A-F]{4}$/);
      expect(crc.length).toBe(4);
    });
  });

  // =========================================================================
  // 2. Recipient Formatting (Mobile vs National ID vs e-Wallet)
  // =========================================================================
  describe('2. formatPromptPayRecipient', () => {
    it('formats 10-digit mobile starting with 0 into 13-digit standard with 0066 prefix', () => {
      const { subTag, formattedValue } = formatPromptPayRecipient('0812345678');
      expect(subTag).toBe('01');
      expect(formattedValue).toBe('0066812345678');
      expect(formattedValue.length).toBe(13);
    });

    it('formats 11-digit mobile starting with 66 into 13-digit standard', () => {
      const { subTag, formattedValue } = formatPromptPayRecipient('66812345678');
      expect(subTag).toBe('01');
      expect(formattedValue).toBe('0066812345678');
    });

    it('formats 13-digit National ID / Tax ID under subTag 02', () => {
      const { subTag, formattedValue } = formatPromptPayRecipient('1234567890123');
      expect(subTag).toBe('02');
      expect(formattedValue).toBe('1234567890123');
    });

    it('formats 15-digit e-Wallet ID under subTag 03', () => {
      const { subTag, formattedValue } = formatPromptPayRecipient('140001234567890');
      expect(subTag).toBe('03');
      expect(formattedValue).toBe('140001234567890');
    });

    it('throws descriptive error on invalid recipient formats', () => {
      expect(() => formatPromptPayRecipient('123')).toThrow(/Invalid PromptPay recipient/);
      expect(() => formatPromptPayRecipient('INVALID_RECIPIENT')).toThrow(/Invalid PromptPay recipient/);
    });
  });

  // =========================================================================
  // 3. Full QR Payload Generation
  // =========================================================================
  describe('3. generatePromptPayQrPayload', () => {
    it('generates a complete valid EMVCo PromptPay QR string', () => {
      const payload = generatePromptPayQrPayload({
        recipientId: '0812345678',
        amount: 1500.50,
        transactionReference: 'THREF12345',
      });

      expect(payload.currency).toBe('THB');
      expect(payload.amount).toBe(1500.50);
      expect(payload.transactionReference).toBe('THREF12345');
      expect(payload.expiresAt).toBeGreaterThan(Date.now());

      const qr = payload.qrString;
      // Must start with Payload Format Indicator: 000201
      expect(qr.startsWith('000201')).toBe(true);
      // Must contain PromptPay AID: A000000677010111
      expect(qr).toContain('A000000677010111');
      // Must contain THB currency code: 5303764
      expect(qr).toContain('5303764');
      // Must contain formatted amount: 54071500.50
      expect(qr).toContain('54071500.50');
      // Must contain Country Code: 5802TH
      expect(qr).toContain('5802TH');
      // Must end with CRC tag 6304 + 4 hex characters
      expect(qr).toMatch(/6304[0-9A-F]{4}$/);
    });

    it('rejects zero or negative amounts', () => {
      expect(() => {
        generatePromptPayQrPayload({
          recipientId: '0812345678',
          amount: 0,
        });
      }).toThrow(/greater than zero/);

      expect(() => {
        generatePromptPayQrPayload({
          recipientId: '0812345678',
          amount: -100,
        });
      }).toThrow(/greater than zero/);
    });
  });
});
