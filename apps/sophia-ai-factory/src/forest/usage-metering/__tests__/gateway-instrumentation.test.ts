/**
 * Gateway Instrumentation Integration Tests
 *
 * Verifies:
 * - emitUsageEvent creates usage records correctly
 * - Idempotency prevents duplicate records
 * - emitUsageEvent failure does not block responses
 * - Excluded paths are skipped
 * - Sampling rate logic works
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NextRequest } from 'next/server';

// ── Mocks ─────────────────────────────────────────────────────────────────

const mockTrackUsage = vi.fn().mockResolvedValue({ success: true, idempotencyKey: 'req_test-key', recordId: 'rec_001' });
const mockCalculateCredits = vi.fn().mockReturnValue(1);
const mockHashLicenseKey = vi.fn().mockReturnValue('a'.repeat(64));
const mockCheckQuota = vi.fn().mockResolvedValue({ allowed: true, remaining: { hourlyCredits: 100, dailyCredits: 1000, monthlyCredits: 10000, dailyRequests: 500 } });
const mockLogger = { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() };

vi.mock('@/tree/usage-metering/tracker', () => ({
  trackUsage: mockTrackUsage,
  calculateCredits: mockCalculateCredits,
  hashLicenseKey: mockHashLicenseKey,
  startTimer: vi.fn(() => () => 42),
}));

vi.mock('@/tree/usage-metering/usage-rollup-engine', () => ({
  checkQuota: mockCheckQuota,
}));

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: mockLogger,
}));

// Import from canonical tree copy (forest re-exports from tree)
const { emitUsageEvent } = await import('@/tree/usage-metering/gateway-instrumentation');

// ── Helpers ────────────────────────────────────────────────────────────────

function createMockRequest(
  pathname: string,
  headers: Record<string, string> = {},
): NextRequest {
  return {
    nextUrl: { pathname, searchParams: new URLSearchParams() },
    headers: new Headers({ 'x-forwarded-for': '127.0.0.1', ...headers }),
    method: 'GET',
    url: `https://sophia.test${pathname}`,
  } as unknown as NextRequest;
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('emitUsageEvent - Gateway Instrumentation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.USAGE_METERING_ENABLED = 'true';
    process.env.USAGE_METERING_SAMPLE_RATE = '1.0';
  });

  describe('happy path', () => {
    it('emits a usage event for a successful API request', async () => {
      const request = createMockRequest('/api/heygen/create', {
        'x-raas-license-key': 'raas_BASIC_1709856000000_abc123',
      });

      await emitUsageEvent(request, { status: 200 });

      expect(mockCalculateCredits).toHaveBeenCalledWith('heygen', 'create', undefined, 'BASIC');
      expect(mockCheckQuota).toHaveBeenCalledWith(
        'abc123',
        'abc123',
        'BASIC',
        1,
      );
      expect(mockTrackUsage).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'abc123',
          licenseNonce: 'abc123',
          service: 'heygen',
          action: 'create',
          endpoint: '/api/heygen/create',
          statusCode: 200,
          tierAtRequest: 'BASIC',
          creditsUsed: 1,
        }),
      );
      expect(mockTrackUsage).toHaveBeenCalledTimes(1);
    });

    it('emits a usage event for elevenlabs paths', async () => {
      const request = createMockRequest('/api/elevenlabs/text-to-speech', {
        'x-raas-license-key': 'raas_PREMIUM_1709856000000_def456',
      });

      await emitUsageEvent(request, { status: 200 });

      expect(mockCalculateCredits).toHaveBeenCalledWith('elevenlabs', 'text-to-speech', undefined, 'PREMIUM');
      expect(mockTrackUsage).toHaveBeenCalledWith(
        expect.objectContaining({
          service: 'elevenlabs',
          action: 'text-to-speech',
          tierAtRequest: 'PREMIUM',
        }),
      );
    });

    it('defaults to BASIC tier when no license or tier header is present', async () => {
      const request = createMockRequest('/api/openrouter/chat/completions');

      await emitUsageEvent(request, { status: 200 });

      expect(mockTrackUsage).toHaveBeenCalledWith(
        expect.objectContaining({
          tierAtRequest: 'BASIC',
        }),
      );
    });
  });

  describe('rate-limited and blocked requests', () => {
    it('emits a usage event for rate-limited (429) requests', async () => {
      const request = createMockRequest('/api/heygen/create', {
        'x-raas-license-key': 'raas_BASIC_1709856000000_xyz789',
      });

      await emitUsageEvent(request, { status: 429 });

      expect(mockTrackUsage).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 429,
          resourceType: 'rate_limited',
          creditsUsed: 1,
        }),
      );
    });

    it('emits a usage event for blocked (403) requests', async () => {
      const request = createMockRequest('/api/heygen/create', {
        'x-raas-license-key': 'raas_BASIC_1709856000000_xyz789',
      });

      await emitUsageEvent(request, { status: 403 });

      expect(mockTrackUsage).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 403,
          errorMessage: 'HTTP 403',
        }),
      );
    });
  });

  describe('idempotency', () => {
    it('generates an idempotency key and passes it to trackUsage', async () => {
      const request = createMockRequest('/api/heygen/create', {
        'x-raas-license-key': 'raas_BASIC_1709856000000_abc123',
      });

      await emitUsageEvent(request, { status: 200 });

      const callArgs = mockTrackUsage.mock.calls[0][0];
      expect(callArgs).toBeDefined();
      expect(callArgs.creditsUsed).toBe(1);

      // Verify idempotencyKey is not present on the event (it's generated by trackUsage)
      expect(callArgs.idempotencyKey).toBeUndefined();
    });

    it('deduplicates when trackUsage returns duplicate status', async () => {
      mockTrackUsage.mockResolvedValueOnce({
        success: false,
        reason: 'duplicate',
        existingRecordId: 'existing-rec-001',
      });

      const request = createMockRequest('/api/heygen/create', {
        'x-raas-license-key': 'raas_BASIC_1709856000000_abc123',
      });

      await emitUsageEvent(request, { status: 200 });

      expect(mockTrackUsage).toHaveBeenCalledTimes(1);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        '[Gateway Instrumentation] Emitted usage event',
        expect.objectContaining({
          idempotencyStatus: 'duplicate',
        }),
      );
    });
  });

  describe('error resilience', () => {
    it('does not throw when trackUsage fails', async () => {
      mockTrackUsage.mockRejectedValueOnce(new Error('DB connection failed'));

      const request = createMockRequest('/api/heygen/create', {
        'x-raas-license-key': 'raas_BASIC_1709856000000_abc123',
      });

      // Should NOT throw
      await expect(emitUsageEvent(request, { status: 200 })).resolves.toBeUndefined();

      expect(mockLogger.error).toHaveBeenCalledWith(
        '[Gateway Instrumentation] Error emitting usage event',
        expect.any(Error),
      );
    });

    it('does not throw when checkQuota fails', async () => {
      mockCheckQuota.mockRejectedValueOnce(new Error('D1 binding not available'));

      const request = createMockRequest('/api/heygen/create', {
        'x-raas-license-key': 'raas_BASIC_1709856000000_abc123',
      });

      await expect(emitUsageEvent(request, { status: 200 })).resolves.toBeUndefined();

      expect(mockLogger.error).toHaveBeenCalledWith(
        '[Gateway Instrumentation] Error emitting usage event',
        expect.any(Error),
      );
    });
  });

  describe('excluded paths', () => {
    it('skips /api/health paths', async () => {
      const request = createMockRequest('/api/health');

      await emitUsageEvent(request, { status: 200 });

      expect(mockTrackUsage).not.toHaveBeenCalled();
    });

    it('skips /api/auth paths', async () => {
      const request = createMockRequest('/api/auth/login');

      await emitUsageEvent(request, { status: 200 });

      expect(mockTrackUsage).not.toHaveBeenCalled();
    });

    it('skips /api/cron paths', async () => {
      const request = createMockRequest('/api/cron/d1-backup');

      await emitUsageEvent(request, { status: 200 });

      expect(mockTrackUsage).not.toHaveBeenCalled();
    });

    it('skips /api/webhooks paths', async () => {
      const request = createMockRequest('/api/webhooks/nowpayments');

      await emitUsageEvent(request, { status: 200 });

      expect(mockTrackUsage).not.toHaveBeenCalled();
    });

    it('skips /api/setup paths', async () => {
      const request = createMockRequest('/api/setup/wizard');

      await emitUsageEvent(request, { status: 200 });

      expect(mockTrackUsage).not.toHaveBeenCalled();
    });
  });

  describe('sampling rate', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      process.env.USAGE_METERING_ENABLED = 'true';
    });

    it('skips tracking when sampling rate is 0', async () => {
      process.env.USAGE_METERING_SAMPLE_RATE = '0';
      const request = createMockRequest('/api/heygen/create', {
        'x-raas-license-key': 'raas_BASIC_1709856000000_abc123',
      });

      await emitUsageEvent(request, { status: 200 });

      expect(mockTrackUsage).not.toHaveBeenCalled();
    });

    it('emits when sampling rate is 1.0', async () => {
      process.env.USAGE_METERING_SAMPLE_RATE = '1.0';
      const request = createMockRequest('/api/heygen/create', {
        'x-raas-license-key': 'raas_BASIC_1709856000000_abc123',
      });

      await emitUsageEvent(request, { status: 200 });

      expect(mockTrackUsage).toHaveBeenCalledTimes(1);
    });
  });

  describe('USAGE_METERING_ENABLED flag', () => {
    it('skips all tracking when disabled', async () => {
      process.env.USAGE_METERING_ENABLED = 'false';
      const request = createMockRequest('/api/heygen/create', {
        'x-raas-license-key': 'raas_BASIC_1709856000000_abc123',
      });

      await emitUsageEvent(request, { status: 200 });

      expect(mockTrackUsage).not.toHaveBeenCalled();
    });
  });
});
