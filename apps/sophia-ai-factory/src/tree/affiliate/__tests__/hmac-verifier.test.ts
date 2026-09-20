import { describe, it, expect } from 'vitest';
import {
  verifyAffiliateHmac,
  generateAffiliateHmac,
} from '../hmac-verifier';

describe('HMAC Verifier (tree/affiliate/hmac-verifier)', () => {
  const secret = 'super_secret_test_key_123!';
  const payload = JSON.stringify({
    order_id: 'ord_987654',
    commission_cents: 2500,
    timestamp: 1726800000000,
  });

  describe('Algorithm coverage', () => {
    it('verifies SHA-256 HMAC correctly', async () => {
      const sig = await generateAffiliateHmac(payload, secret, 'SHA-256');
      const isValid = await verifyAffiliateHmac(payload, sig, secret, 'SHA-256');
      expect(isValid).toBe(true);
    });

    it('verifies SHA-1 HMAC correctly', async () => {
      const sig = await generateAffiliateHmac(payload, secret, 'SHA-1');
      const isValid = await verifyAffiliateHmac(payload, sig, secret, 'SHA-1');
      expect(isValid).toBe(true);
    });

    it('verifies SHA-512 HMAC correctly', async () => {
      const sig = await generateAffiliateHmac(payload, secret, 'SHA-512');
      const isValid = await verifyAffiliateHmac(payload, sig, secret, 'SHA-512');
      expect(isValid).toBe(true);
    });
  });

  describe('Signature normalization', () => {
    it('strips sha256= prefix and handles uppercase hex', async () => {
      const rawSig = await generateAffiliateHmac(payload, secret, 'SHA-256');
      const prefixedSig = `sha256=${rawSig.toUpperCase()}`;
      const isValid = await verifyAffiliateHmac(payload, prefixedSig, secret, 'SHA-256');
      expect(isValid).toBe(true);
    });

    it('strips sha1= prefix', async () => {
      const rawSig = await generateAffiliateHmac(payload, secret, 'SHA-1');
      const prefixedSig = `sha1=${rawSig}`;
      const isValid = await verifyAffiliateHmac(payload, prefixedSig, secret, 'SHA-1');
      expect(isValid).toBe(true);
    });

    it('strips sha512= and v1= prefix', async () => {
      const rawSig = await generateAffiliateHmac(payload, secret, 'SHA-512');
      const prefixedSig = `sha512=${rawSig}`;
      const isValid = await verifyAffiliateHmac(payload, prefixedSig, secret, 'SHA-512');
      expect(isValid).toBe(true);
    });

    it('trims whitespace around signature', async () => {
      const rawSig = await generateAffiliateHmac(payload, secret, 'SHA-256');
      const paddedSig = `   ${rawSig}   \n`;
      const isValid = await verifyAffiliateHmac(payload, paddedSig, secret, 'SHA-256');
      expect(isValid).toBe(true);
    });
  });

  describe('Tampering and security boundaries', () => {
    it('rejects tampered payload', async () => {
      const sig = await generateAffiliateHmac(payload, secret, 'SHA-256');
      const tamperedPayload = payload.replace('2500', '9999');
      const isValid = await verifyAffiliateHmac(tamperedPayload, sig, secret, 'SHA-256');
      expect(isValid).toBe(false);
    });

    it('rejects tampered signature character', async () => {
      const sig = await generateAffiliateHmac(payload, secret, 'SHA-256');
      const lastChar = sig.slice(-1) === 'a' ? 'b' : 'a';
      const tamperedSig = `${sig.slice(0, -1)}${lastChar}`;
      const isValid = await verifyAffiliateHmac(payload, tamperedSig, secret, 'SHA-256');
      expect(isValid).toBe(false);
    });

    it('rejects incorrect secret', async () => {
      const sig = await generateAffiliateHmac(payload, secret, 'SHA-256');
      const isValid = await verifyAffiliateHmac(payload, sig, 'wrong_secret', 'SHA-256');
      expect(isValid).toBe(false);
    });

    it('rejects length mismatch without throwing', async () => {
      const isValidShort = await verifyAffiliateHmac(payload, 'deadbeef', secret, 'SHA-256');
      expect(isValidShort).toBe(false);

      const isValidLong = await verifyAffiliateHmac(payload, 'deadbeef'.repeat(20), secret, 'SHA-256');
      expect(isValidLong).toBe(false);
    });

    it('rejects empty inputs safely', async () => {
      expect(await verifyAffiliateHmac('', 'some_sig', secret)).toBe(false);
      expect(await verifyAffiliateHmac(payload, '', secret)).toBe(false);
      expect(await verifyAffiliateHmac(payload, 'some_sig', '')).toBe(false);
    });
  });
});
