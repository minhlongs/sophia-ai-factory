/**
 * Tests for RaaS License Key Generator
 * Validates key generation, parsing, and revocation functionality
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createHmac } from 'crypto';
import {
  generateLicenseKey,
  generateMasterKey,
  revokeKey,
  parseKey,
} from './raas-key-generator';

describe('RaaS Key Generator', () => {
  const TEST_SECRET = 'test-secret-key-min-16-chars';
  const TEST_SECRET_SHORT = 'short';

  describe('generateLicenseKey', () => {
    it('should generate valid license key format', () => {
      const expiresAt = new Date('2027-01-01');
      const key = generateLicenseKey('PREMIUM', expiresAt, TEST_SECRET);

      // Format: raas_{tier}_{timestamp}_{nonce}_{hmac}
      const parts = key.split('_');
      expect(parts).toHaveLength(5);
      expect(parts[0]).toBe('raas');
      expect(parts[1]).toBe('premium'); // lowercase
      expect(parts[2]).toMatch(/^\d+$/); // timestamp
      expect(parts[3]).toHaveLength(32); // nonce (32 hex chars)
      expect(parts[4]).toHaveLength(64); // hmac (64 hex chars)
    });

    it('should use correct expiration timestamp', () => {
      const expiresAt = new Date('2027-01-01T00:00:00Z');
      const key = generateLicenseKey('BASIC', expiresAt, TEST_SECRET);
      const parts = key.split('_');
      const timestamp = parseInt(parts[2], 10);

      // Expected: Math.floor(new Date('2027-01-01T00:00:00Z').getTime() / 1000)
      const expected = Math.floor(expiresAt.getTime() / 1000);
      expect(timestamp).toBe(expected);
    });

    it('should generate unique keys for same inputs (random nonce)', () => {
      const expiresAt = new Date('2027-01-01');
      const key1 = generateLicenseKey('PREMIUM', expiresAt, TEST_SECRET);
      const key2 = generateLicenseKey('PREMIUM', expiresAt, TEST_SECRET);

      expect(key1).not.toBe(key2);
    });

    it('should handle all tier types', () => {
      const expiresAt = new Date('2027-01-01');
      const tiers: Array<'BASIC' | 'PREMIUM' | 'ENTERPRISE' | 'MASTER'> = [
        'BASIC',
        'PREMIUM',
        'ENTERPRISE',
        'MASTER',
      ];

      tiers.forEach((tier) => {
        const key = generateLicenseKey(tier, expiresAt, TEST_SECRET);
        expect(key).toMatch(/^raas_[a-z]+_\d+_[a-f0-9]{32}_[a-f0-9]{64}$/);
        expect(key.split('_')[1]).toBe(tier.toLowerCase());
      });
    });

    it('should throw error for short secret', () => {
      const expiresAt = new Date('2027-01-01');

      expect(() =>
        generateLicenseKey('PREMIUM', expiresAt, TEST_SECRET_SHORT)
      ).toThrow('RAAS_LICENSE_SECRET must be at least 16 characters');
    });

    it('should throw error for empty secret', () => {
      const expiresAt = new Date('2027-01-01');

      expect(() =>
        generateLicenseKey('PREMIUM', expiresAt, '')
      ).toThrow('RAAS_LICENSE_SECRET must be at least 16 characters');
    });
  });

  describe('generateMasterKey', () => {
    it('should generate perpetual master key with timestamp = 0', () => {
      const key = generateMasterKey('MASTER', TEST_SECRET);
      const parts = key.split('_');

      expect(parts[0]).toBe('raas');
      expect(parts[1]).toBe('master');
      expect(parts[2]).toBe('0'); // perpetual = timestamp 0
      expect(parts[3]).toHaveLength(32); // nonce
      expect(parts[4]).toHaveLength(64); // hmac
    });

    it('should generate unique keys for same tier', () => {
      const key1 = generateMasterKey('MASTER', TEST_SECRET);
      const key2 = generateMasterKey('MASTER', TEST_SECRET);

      expect(key1).not.toBe(key2);
    });

    it('should work for all tier types', () => {
      const tiers: Array<'BASIC' | 'PREMIUM' | 'ENTERPRISE' | 'MASTER'> = [
        'BASIC',
        'PREMIUM',
        'ENTERPRISE',
        'MASTER',
      ];

      tiers.forEach((tier) => {
        const key = generateMasterKey(tier, TEST_SECRET);
        const parts = key.split('_');
        expect(parts[2]).toBe('0');
        expect(parts[1]).toBe(tier.toLowerCase());
      });
    });

    it('should throw error for short secret', () => {
      expect(() => generateMasterKey('MASTER', TEST_SECRET_SHORT)).toThrow(
        'RAAS_LICENSE_SECRET must be at least 16 characters'
      );
    });
  });

  describe('parseKey', () => {
    it('should parse valid license key', () => {
      const expiresAt = new Date('2027-01-01');
      const key = generateLicenseKey('PREMIUM', expiresAt, TEST_SECRET);
      const parsed = parseKey(key);

      expect(parsed).not.toBeNull();
      expect(parsed?.tier).toBe('premium');
      expect(parsed?.timestamp).toBe(Math.floor(expiresAt.getTime() / 1000));
      expect(parsed?.nonce).toHaveLength(32);
      expect(parsed?.hmac).toHaveLength(64);
    });

    it('should parse master key with timestamp 0', () => {
      const key = generateMasterKey('MASTER', TEST_SECRET);
      const parsed = parseKey(key);

      expect(parsed).not.toBeNull();
      expect(parsed?.tier).toBe('master');
      expect(parsed?.timestamp).toBe(0);
    });

    it('should return null for invalid prefix', () => {
      expect(parseKey('invalid_raas_premium_123_abc_def')).toBeNull();
    });

    it('should return null for wrong number of parts', () => {
      expect(parseKey('raas_premium_123_abc')).toBeNull(); // missing hmac
      expect(parseKey('raas_premium_123_abc_def_ghi')).toBeNull(); // extra part
    });

    it('should return null for invalid timestamp', () => {
      expect(parseKey('raas_premium_nan_abcdef1234567890abcdef1234567890_abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890')).toBeNull();
    });

    it('should return null for short nonce', () => {
      expect(parseKey('raas_premium_1234567890_abc_def')).toBeNull();
    });

    it('should return null for short hmac', () => {
      expect(parseKey('raas_premium_1234567890_abcdef1234567890abcdef1234567890_short')).toBeNull();
    });
  });

  describe('revokeKey', () => {
    let mockRedis: { sAdd: (key: string, value: string) => Promise<number> };

    beforeEach(() => {
      mockRedis = {
        sAdd: vi.fn().mockResolvedValue(1),
      };
    });

    it('should add key to revoked keys set', async () => {
      const key = generateLicenseKey('PREMIUM', new Date('2027-01-01'), TEST_SECRET);

      await revokeKey(key, mockRedis as unknown as typeof mockRedis);

      expect(mockRedis.sAdd).toHaveBeenCalledWith(
        'raas:revoked_keys',
        key
      );
    });

    it('should throw error if Redis operation fails', async () => {
      const key = 'raas_premium_1234567890_abcdef1234567890abcdef1234567890_abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';
      mockRedis.sAdd.mockRejectedValue(new Error('Redis connection failed'));

      await expect(revokeKey(key, mockRedis as unknown as typeof mockRedis)).rejects.toThrow(
        'Failed to revoke key: Redis connection failed'
      );
    });
  });

  describe('Integration: Generate + Parse', () => {
    it('should generate key and parse it back correctly', () => {
      const expiresAt = new Date('2027-06-15T12:30:00Z');
      const key = generateLicenseKey('ENTERPRISE', expiresAt, TEST_SECRET);
      const parsed = parseKey(key);

      expect(parsed?.tier).toBe('enterprise');
      expect(parsed?.timestamp).toBe(Math.floor(expiresAt.getTime() / 1000));
      expect(parsed?.nonce).toHaveLength(32);
      expect(parsed?.hmac).toHaveLength(64);
    });

    it('should verify HMAC integrity', () => {
      const key = generateLicenseKey('PREMIUM', new Date('2027-01-01'), TEST_SECRET);
      const parsed = parseKey(key);

      // Recompute HMAC
      const data = `${parsed?.tier}:${parsed?.timestamp}:${parsed?.nonce}`;
      const expectedHmac = createHmac('sha256', TEST_SECRET)
        .update(data)
        .digest('hex');

      expect(parsed?.hmac).toBe(expectedHmac);
    });
  });
});
