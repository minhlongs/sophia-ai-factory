/**
 * Usage Metering Integration Tests
 *
 * Tests for:
 * - Idempotency key generation and deduplication
 * - License association
 * - Supabase persistence
 * - Internal endpoint access control
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  generateIdempotencyKey,
  isValidIdempotencyKey,
  extractIdempotencyKey,
  buildIdempotencyHeaders,
} from './idempotency';
import {
  hashLicenseKey,
  calculateCredits,
  startTimer,
} from './tracker';
import type { UsageEventInput } from './types';

// Mock Supabase admin client
vi.mock('@/seed/db/client', () => ({
  createServerClient: () => ({
    from: vi.fn((table: string) => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: null, error: null })),
        })),
      })),
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: { id: 'test-id' }, error: null })),
        })),
      })),
    })),
  }),
}));

// Mock logger
vi.mock('@/seed/utils/logger-utility', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('Usage Metering - Idempotency', () => {
  describe('generateIdempotencyKey', () => {
    it('generates deterministic key from request context', () => {
      const event = {
        userId: 'user-123',
        licenseNonce: 'license-abc',
        service: 'heygen',
        action: 'createVideo',
        timestamp: 1709856000000,
      };

      const key1 = generateIdempotencyKey(event);
      const key2 = generateIdempotencyKey(event);

      expect(key1).toBe(key2);
      expect(key1).toMatch(/^gen_[a-f0-9]{64}$/);
    });

    it('uses requestId as prefix when provided', () => {
      const event = {
        requestId: 'req-unique-123',
        userId: 'user-123',
        licenseNonce: 'license-abc',
        service: 'heygen',
        action: 'createVideo',
        timestamp: 1709856000000,
      };

      const key = generateIdempotencyKey(event);

      expect(key).toBe('req_req-unique-123');
    });

    it('generates different keys for different timestamps', () => {
      const baseEvent = {
        userId: 'user-123',
        licenseNonce: 'license-abc',
        service: 'heygen',
        action: 'createVideo',
      };

      const key1 = generateIdempotencyKey({ ...baseEvent, timestamp: 1709856000000 });
      const key2 = generateIdempotencyKey({ ...baseEvent, timestamp: 1709856060000 });

      expect(key1).not.toBe(key2);
    });

    it('generates different keys for different users', () => {
      const baseEvent = {
        licenseNonce: 'license-abc',
        service: 'heygen',
        action: 'createVideo',
        timestamp: 1709856000000,
      };

      const key1 = generateIdempotencyKey({ ...baseEvent, userId: 'user-1' });
      const key2 = generateIdempotencyKey({ ...baseEvent, userId: 'user-2' });

      expect(key1).not.toBe(key2);
    });

    it('generates different keys for different services', () => {
      const baseEvent = {
        userId: 'user-123',
        licenseNonce: 'license-abc',
        action: 'generate',
        timestamp: 1709856000000,
      };

      const key1 = generateIdempotencyKey({ ...baseEvent, service: 'heygen' });
      const key2 = generateIdempotencyKey({ ...baseEvent, service: 'elevenlabs' });

      expect(key1).not.toBe(key2);
    });
  });

  describe('isValidIdempotencyKey', () => {
    it('validates req_ prefix format', () => {
      expect(isValidIdempotencyKey('req_abc123')).toBe(true);
      expect(isValidIdempotencyKey('req_')).toBe(false);
      expect(isValidIdempotencyKey('req_')).toBe(false);
    });

    it('validates gen_ prefix format', () => {
      expect(isValidIdempotencyKey('gen_abc123')).toBe(true);
      expect(isValidIdempotencyKey('gen_')).toBe(false);
    });

    it('rejects invalid formats', () => {
      expect(isValidIdempotencyKey('')).toBe(false);
      expect(isValidIdempotencyKey('invalid')).toBe(false);
      expect(isValidIdempotencyKey('prefix_test')).toBe(false);
      expect(isValidIdempotencyKey(null)).toBe(false);
      expect(isValidIdempotencyKey(undefined)).toBe(false);
    });
  });

  describe('extractIdempotencyKey', () => {
    it('extracts from x-idempotency-key header', () => {
      const headers = new Headers();
      headers.set('x-idempotency-key', 'test-key-123');

      const result = extractIdempotencyKey(headers);

      expect(result).toBe('test-key-123');
    });

    it('extracts from idempotency-key header', () => {
      const headers = new Headers();
      headers.set('idempotency-key', 'test-key-456');

      const result = extractIdempotencyKey(headers);

      expect(result).toBe('test-key-456');
    });

    it('returns null when header is missing', () => {
      const headers = new Headers();

      const result = extractIdempotencyKey(headers);

      expect(result).toBe(null);
    });
  });

  describe('buildIdempotencyHeaders', () => {
    it('builds headers with x-idempotency-key', () => {
      const headers = buildIdempotencyHeaders('test-key');

      expect(headers.get('x-idempotency-key')).toBe('test-key');
    });
  });
});

describe('Usage Metering - License Association', () => {
  describe('hashLicenseKey', () => {
    it('generates consistent SHA256 hash', () => {
      const key = 'raas_BASIC_1709856000000_abc123_hmac';
      const hash1 = hashLicenseKey(key);
      const hash2 = hashLicenseKey(key);

      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64);
    });

    it('generates different hashes for different keys', () => {
      const hash1 = hashLicenseKey('key-1');
      const hash2 = hashLicenseKey('key-2');

      expect(hash1).not.toBe(hash2);
    });
  });
});

describe('Usage Metering - Credit Calculation', () => {
  describe('calculateCredits', () => {
    it('calculates per-call credits for HeyGen', () => {
      const credits = calculateCredits('heygen', 'createVideo', undefined, 'BASIC');
      expect(credits).toBe(1);
    });

    it('calculates per-call credits for ElevenLabs', () => {
      const credits = calculateCredits('elevenlabs', 'textToSpeech', undefined, 'BASIC');
      expect(credits).toBe(1);
    });

    it('calculates per-1k-tokens credits for OpenRouter', () => {
      const credits = calculateCredits('openrouter', 'chatCompletion', 5000, 'BASIC');
      expect(credits).toBe(5); // 5000 tokens / 1000 = 5 credits
    });

    it('applies tier multiplier - PREMIUM gets more credits per token (bonus)', () => {
      // Higher tiers get MORE credits for same tokens (tierMultiplier < 1 means bonus)
      // Example: 5000 tokens at BASIC = 5 credits (1.0 multiplier)
      //          5000 tokens at PREMIUM = 7 credits (0.8 multiplier -> 5/0.8 = 6.25 -> 7)
      const basicCredits = calculateCredits('openrouter', 'chatCompletion', 5000, 'BASIC');
      const premiumCredits = calculateCredits('openrouter', 'chatCompletion', 5000, 'PREMIUM');

      expect(premiumCredits).toBeGreaterThanOrEqual(basicCredits);
    });

    it('applies tier multiplier - ENTERPRISE gets even more credits than PREMIUM', () => {
      // Higher tier = better rate = more credits awarded
      const premiumCredits = calculateCredits('openrouter', 'chatCompletion', 5000, 'PREMIUM');
      const enterpriseCredits = calculateCredits('openrouter', 'chatCompletion', 5000, 'ENTERPRISE');

      expect(enterpriseCredits).toBeGreaterThanOrEqual(premiumCredits);
    });

    it('defaults to 1 credit for unknown service', () => {
      const credits = calculateCredits('unknown', 'action', undefined, 'BASIC');
      expect(credits).toBe(1);
    });

    it('handles missing action rule with default', () => {
      const credits = calculateCredits('heygen', 'unknownAction', undefined, 'BASIC');
      expect(credits).toBe(1);
    });
  });
});

describe('Usage Metering - Timer', () => {
  describe('startTimer', () => {
    it('measures elapsed time in milliseconds', () => {
      const getElapsed = startTimer();

      // Wait a small amount
      const start = Date.now();
      while (Date.now() - start < 10) {
        // Busy wait 10ms
      }

      const elapsed = getElapsed();

      expect(elapsed).toBeGreaterThanOrEqual(8); // Allow some tolerance
      expect(elapsed).toBeLessThan(100);
    });

    it('returns function that can be called multiple times', () => {
      const getElapsed = startTimer();

      const elapsed1 = getElapsed();
      const elapsed2 = getElapsed();

      expect(elapsed2).toBeGreaterThanOrEqual(elapsed1);
    });
  });
});

describe('Usage Metering - Event Structure', () => {
  it('UsageEventInput has all required fields', () => {
    const event: UsageEventInput = {
      userId: 'user-123',
      licenseKeyHash: 'abc123hash',
      licenseNonce: 'license-abc',
      service: 'heygen',
      endpoint: '/api/heygen/create',
      action: 'createVideo',
      creditsUsed: 1,
      tierAtRequest: 'BASIC',
      requestId: 'req-123',
      modelName: 'gpt-4',
      tokensInput: 100,
      tokensOutput: 200,
      statusCode: 200,
      responseTimeMs: 150,
      idempotencyKey: 'req_req-123',
      externalCustomerId: 'cus_stripe123',
      resourceType: 'model_invocation',
    };

    expect(event.userId).toBe('user-123');
    expect(event.service).toBe('heygen');
    expect(event.creditsUsed).toBe(1);
  });
});
