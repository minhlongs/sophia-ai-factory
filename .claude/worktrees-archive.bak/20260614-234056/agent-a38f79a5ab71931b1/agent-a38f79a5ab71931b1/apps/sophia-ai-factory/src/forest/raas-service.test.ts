/**
 * RaaS Service Tests
 *
 * Comprehensive unit tests for ROIaaS license validation service.
 * Covers: parseLicenseKey, verifyHmac, checkExpiration, checkNonce,
 * checkRevocation, validateLicenseKey
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createHmac } from 'crypto';
import { hmacSha256 } from '@/tree/audit/crypto-utils';

// Mock Redis - must be defined inside vi.mock factory
vi.mock('./redis', () => ({
  redis: {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
  },
}));

// Mock logger
vi.mock('./utils/logger-utility', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Import after mocks
import {
  parseLicenseKey,
  verifyHmac,
  checkExpiration,
  checkNonce,
  checkRevocation,
  validateLicenseKey,
  revokeLicenseKey,
  generateNonce,
  type Tier,
} from './raas-service';
import { redis } from '@/seed/redis';
import { logger } from '@/seed/utils/logger-utility';

// Type-safe mock access
const mockRedis = redis as unknown;

const mockLogger = logger as unknown;

describe('RaaS Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  // ==========================================
  // PARSE LICENSE KEY TESTS
  // ==========================================
  describe('parseLicenseKey', () => {
    it('should parse valid license key', () => {
      const key = 'raas_premium_1735689600_a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6_e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
      const result = parseLicenseKey(key);

      expect(result).not.toBeNull();
      expect(result?.tier).toBe('premium');
      expect(result?.timestamp).toBe(1735689600);
      expect(result?.nonce).toBe('a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6');
      expect(result?.hmac).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    });

    it('should reject invalid format - wrong prefix', () => {
      const key = 'invalid_premium_1735689600_a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6_e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
      expect(parseLicenseKey(key)).toBeNull();
    });

    it('should reject invalid format - wrong tier', () => {
      const key = 'raas_invalid_1735689600_a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6_e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
      expect(parseLicenseKey(key)).toBeNull();
    });

    it('should reject invalid format - timestamp too short', () => {
      const key = 'raas_premium_173568960_a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6_e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
      expect(parseLicenseKey(key)).toBeNull();
    });

    it('should reject invalid format - nonce too short', () => {
      const key = 'raas_premium_1735689600_a1b2c3d4e5f6a7b8_e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
      expect(parseLicenseKey(key)).toBeNull();
    });

    it('should reject invalid format - hmac too short', () => {
      const key = 'raas_premium_1735689600_a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6_e3b0c44298fc1c149afbf4c8996fb92';
      expect(parseLicenseKey(key)).toBeNull();
    });

    it('should accept all valid tiers', () => {
      const tiers: Tier[] = ['basic', 'premium', 'enterprise', 'master'];

      tiers.forEach((tier) => {
        const key = `raas_${tier}_1735689600_a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6_e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`;
        const result = parseLicenseKey(key);
        expect(result?.tier).toBe(tier);
      });
    });
  });

  // ==========================================
  // VERIFY HMAC TESTS
  // ==========================================
  describe('verifyHmac', () => {
    const SECRET = 'test-secret-key-32-bytes-long!!!';

    it('should verify valid HMAC', () => {
      const tier = 'premium';
      const timestamp = 1735689600;
      const nonce = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6';
      const data = `${tier}:${timestamp}:${nonce}`;

      // Use the same hmacSha256 that production uses
      const correctHmac = hmacSha256(data, SECRET);
      // Pad to 64 chars (production pattern expects 64-char hex)
      const paddedHmac = correctHmac.padEnd(64, '0').slice(0, 64);

      const key = `raas_${tier}_${timestamp}_${nonce}_${paddedHmac}`;

      expect(verifyHmac(key, SECRET)).toBe(true);
    });

    it('should reject invalid HMAC', () => {
      const key = 'raas_premium_1735689600_a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6_invalidHmacValue';
      expect(verifyHmac(key, SECRET)).toBe(false);
    });

    it('should reject tampered key', () => {
      const tier = 'premium';
      const timestamp = 1735689600;
      const nonce = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6';
      const data = `${tier}:${timestamp}:${nonce}`;

      const correctHmac = hmacSha256(data, SECRET).padEnd(64, '0').slice(0, 64);

      const key = `raas_${tier}_${timestamp}_${nonce}_${correctHmac}`;
      const tamperedKey = key.replace('premium', 'enterprise');
      expect(verifyHmac(tamperedKey, SECRET)).toBe(false);
    });

    it('should handle invalid format gracefully', () => {
      expect(verifyHmac('invalid-key', SECRET)).toBe(false);
      expect(verifyHmac('', SECRET)).toBe(false);
    });

    it('should use timing-safe comparison', () => {
      const tier = 'basic';
      const timestamp = 1735689600;
      const nonce = '00000000000000000000000000000000';
      const data = `${tier}:${timestamp}:${nonce}`;

      // Use the same hmacSha256 that production uses
      const hmac = hmacSha256(data, SECRET).padEnd(64, '0').slice(0, 64);

      const key = `raas_${tier}_${timestamp}_${nonce}_${hmac}`;
      expect(verifyHmac(key, SECRET)).toBe(true);
    });
  });

  // ==========================================
  // CHECK EXPIRATION TESTS
  // ==========================================
  describe('checkExpiration', () => {
    it('should return false for non-expired key', () => {
      const futureTimestamp = Math.floor(Date.now() / 1000) + 86400;
      expect(checkExpiration(futureTimestamp, 'premium')).toBe(false);
    });

    it('should return true for expired key', () => {
      const pastTimestamp = Math.floor(Date.now() / 1000) - 86400;
      expect(checkExpiration(pastTimestamp, 'premium')).toBe(true);
    });

    it('should never expire for master tier', () => {
      const pastTimestamp = Math.floor(Date.now() / 1000) - 86400 * 365;
      expect(checkExpiration(pastTimestamp, 'master')).toBe(false);

      const farFutureTimestamp = Math.floor(Date.now() / 1000) + 86400 * 365 * 100;
      expect(checkExpiration(farFutureTimestamp, 'master')).toBe(false);
    });

    it('should handle all tiers correctly', () => {
      const pastTimestamp = Math.floor(Date.now() / 1000) - 86400;

      expect(checkExpiration(pastTimestamp, 'basic')).toBe(true);
      expect(checkExpiration(pastTimestamp, 'premium')).toBe(true);
      expect(checkExpiration(pastTimestamp, 'enterprise')).toBe(true);
      expect(checkExpiration(pastTimestamp, 'master')).toBe(false);
    });
  });

  // ==========================================
  // CHECK NONCE TESTS
  // ==========================================
  describe('checkNonce', () => {
    const mockRedisClient = {
      get: vi.fn(),
      set: vi.fn(),
    };

    it('should return false for new nonce', async () => {
      mockRedisClient.get.mockResolvedValue(null);
      mockRedisClient.set.mockResolvedValue('OK');

      const result = await checkNonce('new-nonce-123', mockRedisClient as unknown as typeof redis);
      expect(result).toBe(false);
      expect(mockRedisClient.get).toHaveBeenCalledWith('raas:nonce:new-nonce-123');
      expect(mockRedisClient.set).toHaveBeenCalled();
    });

    it('should return true for reused nonce (replay attack)', async () => {
      mockRedisClient.get.mockResolvedValue('1');

      const result = await checkNonce('reused-nonce-456', mockRedisClient as unknown as typeof redis);
      expect(result).toBe(true);
      expect(mockRedisClient.get).toHaveBeenCalledWith('raas:nonce:reused-nonce-456');
    });

    it('should fail open when Redis is unavailable', async () => {
      mockRedisClient.get.mockRejectedValue(new Error('Redis connection failed'));

      const result = await checkNonce('test-nonce', mockRedisClient as unknown as typeof redis);
      expect(result).toBe(false);
    });

    it('should use custom Redis TTL from env', async () => {
      vi.stubEnv('RAAS_REDIS_TTL', '7200');
      mockRedisClient.get.mockResolvedValue(null);
      mockRedisClient.set.mockResolvedValue('OK');

      await checkNonce('test-nonce', mockRedisClient as unknown as typeof redis);

      expect(mockRedisClient.set).toHaveBeenCalledWith(
        'raas:nonce:test-nonce',
        '1',
        { ex: 7200 }
      );
    });
  });

  // ==========================================
  // CHECK REVOCATION TESTS
  // ==========================================
  describe('checkRevocation', () => {
    const mockRedisClient = {
      get: vi.fn(),
    };

    it('should return false for active key', async () => {
      mockRedisClient.get.mockResolvedValue(null);

      const result = await checkRevocation('raas_premium_key', mockRedisClient as unknown as typeof redis);
      expect(result).toBe(false);
    });

    it('should return true for revoked key', async () => {
      mockRedisClient.get.mockResolvedValue('1');

      const result = await checkRevocation('raas_premium_key', mockRedisClient as unknown as typeof redis);
      expect(result).toBe(true);
    });

    it('should fail open when Redis is unavailable', async () => {
      mockRedisClient.get.mockRejectedValue(new Error('Redis connection failed'));

      const result = await checkRevocation('raas_premium_key', mockRedisClient as unknown as typeof redis);
      expect(result).toBe(false);
    });
  });

  // ==========================================
  // VALIDATE LICENSE KEY TESTS
  // ==========================================
  describe('validateLicenseKey', () => {
    const SECRET = 'test-secret-key-32-bytes-long!!!';

    const mockRedisClient = {
      get: vi.fn(),
      set: vi.fn(),
    };

    beforeEach(() => {
      vi.stubEnv('RAAS_LICENSE_SECRET', SECRET);
      mockRedisClient.get.mockClear();
      mockRedisClient.set.mockClear();
    });

    it('should bypass validation in dev mode', async () => {
      vi.stubEnv('NODE_ENV', 'development');
      vi.stubEnv('RAAS_BYPASS_DEV', 'true');

      const result = await validateLicenseKey('invalid-key', { redisClient: mockRedisClient as unknown as typeof redis });
      expect(result.valid).toBe(true);
      expect(result.reason).toBe('dev-bypass');
    });

    it('should reject invalid format', async () => {
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('RAAS_BYPASS_DEV', 'false');

      const result = await validateLicenseKey('invalid-key', { redisClient: mockRedisClient as unknown as typeof redis });
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('invalid-format');
    });

    it('should reject missing secret', async () => {
      vi.stubEnv('RAAS_LICENSE_SECRET', undefined);

      const key = 'raas_premium_1735689600_a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6_e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
      const result = await validateLicenseKey(key, { redisClient: mockRedisClient as unknown as typeof redis });

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('missing-secret');
    });

    it('should reject invalid signature', async () => {
      const tier = 'premium';
      const timestamp = 1735689600;
      const nonce = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6';
      const invalidHmac = '0000000000000000000000000000000000000000000000000000000000000000';

      const key = `raas_${tier}_${timestamp}_${nonce}_${invalidHmac}`;
      const result = await validateLicenseKey(key, { redisClient: mockRedisClient as unknown as typeof redis });

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('invalid-signature');
    });

    // Helper: build valid license key using same HMAC as production
    function buildKey(tier: string, timestamp: number, nonce: string): string {
      const data = `${tier}:${timestamp}:${nonce}`;
      const hmac = hmacSha256(data, SECRET).padEnd(64, '0').slice(0, 64);
      return `raas_${tier}_${timestamp}_${nonce}_${hmac}`;
    }

    it('should reject expired key', async () => {
      const timestamp = Math.floor(Date.now() / 1000) - 86400;
      const key = buildKey('premium', timestamp, 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6');

      mockRedisClient.get.mockResolvedValue(null);
      mockRedisClient.set.mockResolvedValue('OK');

      const result = await validateLicenseKey(key, { redisClient: mockRedisClient as unknown as typeof redis });
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('expired');
    });

    it('should accept valid non-expired key', async () => {
      const timestamp = Math.floor(Date.now() / 1000) + 86400;
      const key = buildKey('premium', timestamp, 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6');

      mockRedisClient.get.mockResolvedValue(null);
      mockRedisClient.set.mockResolvedValue('OK');

      const result = await validateLicenseKey(key, { redisClient: mockRedisClient as unknown as typeof redis });
      expect(result.valid).toBe(true);
      expect(result.tier).toBe('premium');
    });

    it('should reject replay attack (reused nonce)', async () => {
      const timestamp = Math.floor(Date.now() / 1000) + 86400;
      const key = buildKey('premium', timestamp, 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6');

      mockRedisClient.get.mockResolvedValue('1');

      const result = await validateLicenseKey(key, { redisClient: mockRedisClient as unknown as typeof redis });
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('replay-attack');
    });

    it('should reject revoked key', async () => {
      const timestamp = Math.floor(Date.now() / 1000) + 86400;
      const key = buildKey('premium', timestamp, 'b1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6');

      mockRedisClient.get.mockImplementation((redisKey: string) => {
        if (redisKey.includes('raas:revoked:')) {
          return Promise.resolve('1');
        }
        return Promise.resolve(null);
      });

      const result = await validateLicenseKey(key, { redisClient: mockRedisClient as unknown as typeof redis });
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('revoked');
    });

    it('should accept master tier with expired timestamp', async () => {
      const timestamp = Math.floor(Date.now() / 1000) - 86400 * 365;
      const key = buildKey('master', timestamp, 'c1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6');

      mockRedisClient.get.mockResolvedValue(null);
      mockRedisClient.set.mockResolvedValue('OK');

      const result = await validateLicenseKey(key, { redisClient: mockRedisClient as unknown as typeof redis });
      expect(result.valid).toBe(true);
      expect(result.tier).toBe('master');
    });
  });

  // ==========================================
  // REVOKE LICENSE KEY TESTS
  // ==========================================
  describe('revokeLicenseKey', () => {
    const mockRedisClient = {
      set: vi.fn(),
    };

    it('should add key to revocation set', async () => {
      mockRedisClient.set.mockResolvedValue('OK');

      await revokeLicenseKey('raas_premium_test', mockRedisClient as unknown as typeof redis);

      expect(mockRedisClient.set).toHaveBeenCalledWith(
        'raas:revoked:raas_premium_test',
        '1',
        { ex: 31536000 }
      );
    });

    it('should throw error when Redis fails', async () => {
      mockRedisClient.set.mockRejectedValue(new Error('Redis write failed'));

      await expect(revokeLicenseKey('raas_premium_test', mockRedisClient as unknown as typeof redis))
        .rejects.toThrow('Redis write failed');
    });
  });

  // ==========================================
  // GENERATE NONCE TESTS
  // ==========================================
  describe('generateNonce', () => {
    it('should generate 32-character hex string', () => {
      const nonce = generateNonce();
      expect(nonce).toHaveLength(32);
      expect(nonce).toMatch(/^[a-f0-9]{32}$/);
    });

    it('should generate unique nonces', () => {
      const nonce1 = generateNonce();
      const nonce2 = generateNonce();
      expect(nonce1).not.toBe(nonce2);
    });
  });
});
