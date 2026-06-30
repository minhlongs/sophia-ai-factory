/**
 * Unit tests for enrichment-logger
 * @module forest/worker/__tests__/enrichment-logger.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createEnrichmentLog, getPendingLogCount } from '../lib/enrichment-logger';

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

describe('createEnrichmentLog', () => {
  const baseInput = {
    licenseNonce: 'lic_abc123',
    userId: 'user_1',
    tier: 'PREMIUM',
    features: ['video-gen', 'text-to-speech'],
    quotaLimits: { dailyCredits: 1000, hourlyCredits: 100, monthlyCredits: 10000 },
    source: 'database' as const,
    cacheHit: false,
    processingTimeMs: 45,
  };

  it('creates an enrichment log entry without optional fields', () => {
    const log = createEnrichmentLog(
      baseInput.licenseNonce,
      baseInput.userId,
      baseInput.tier,
      baseInput.features,
      baseInput.quotaLimits,
      baseInput.source,
      baseInput.cacheHit,
      baseInput.processingTimeMs,
    );

    expect(log.licenseNonce).toBe('lic_abc123');
    expect(log.userId).toBe('user_1');
    expect(log.tier).toBe('PREMIUM');
    expect(log.features).toEqual(['video-gen', 'text-to-speech']);
    expect(log.quotaLimits).toEqual(baseInput.quotaLimits);
    expect(log.enrichmentSource).toBe('database');
    expect(log.cacheHit).toBe(false);
    expect(log.processingTimeMs).toBe(45);
    expect(log.requestId).toBeUndefined();
    expect(log.userAgent).toBeUndefined();
    expect(log.ipHash).toBeUndefined();
  });

  it('includes optional fields when provided', () => {
    const log = createEnrichmentLog(
      baseInput.licenseNonce,
      baseInput.userId,
      baseInput.tier,
      baseInput.features,
      baseInput.quotaLimits,
      'cache',
      true,
      12,
      'req_001',
      'Mozilla/5.0',
      '192.168.1.1',
    );

    expect(log.requestId).toBe('req_001');
    expect(log.userAgent).toBe('Mozilla/5.0');
    expect(log.ipHash).toMatch(/^[0-9a-f]{8}$/);
  });

  it('sets cacheHit to true when source is cache', () => {
    const log = createEnrichmentLog(
      baseInput.licenseNonce,
      baseInput.userId,
      baseInput.tier,
      baseInput.features,
      baseInput.quotaLimits,
      'cache',
      true,
      5,
    );

    expect(log.enrichmentSource).toBe('cache');
    expect(log.cacheHit).toBe(true);
  });

  it('sets source to fallback', () => {
    const log = createEnrichmentLog(
      baseInput.licenseNonce,
      baseInput.userId,
      baseInput.tier,
      baseInput.features,
      baseInput.quotaLimits,
      'fallback',
      false,
      200,
    );

    expect(log.enrichmentSource).toBe('fallback');
  });
});

describe('getPendingLogCount', () => {
  it('returns 0 when no logs have been added', () => {
    expect(getPendingLogCount()).toBe(0);
  });
});
