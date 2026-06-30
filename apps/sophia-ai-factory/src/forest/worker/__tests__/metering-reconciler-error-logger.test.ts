/**
 * Unit tests for metering-reconciler-error-logger
 * @module forest/worker/__tests__/metering-reconciler-error-logger.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { logErrorToKv } from '../lib/metering-reconciler-error-logger';

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

describe('logErrorToKv', () => {
  let mockKv: { put: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockKv = {
      put: vi.fn().mockResolvedValue(undefined),
    };
  });

  it('stores error entry in KV with TTL', async () => {
    const error = new Error('Test error');
    await logErrorToKv(error, {
      operation: 'test_operation',
      timestamp: 1700000000000,
    }, mockKv as never);

    expect(mockKv.put).toHaveBeenCalledTimes(1);
    const callArg = mockKv.put.mock.calls[0];
    expect(callArg[0]).toContain('reconciliation-errors:1700000000000');
    expect(callArg[2]).toEqual({ expirationTtl: 604800 });
  });

  it('includes error details in stored entry', async () => {
    const error = new Error('Connection failed');
    await logErrorToKv(error, {
      eventId: 'evt_001',
      licenseNonce: 'lic_abc',
      operation: 'sync',
      timestamp: 1700000000000,
    }, mockKv as never);

    const stored = JSON.parse(mockKv.put.mock.calls[0][1]) as Record<string, unknown>;
    expect(stored.eventId).toBe('evt_001');
    expect(stored.licenseNonce).toBe('lic_abc');
    expect(stored.operation).toBe('sync');
    expect(stored.errorMessage).toBe('Connection failed');
    expect(stored.errorStack).toBeTruthy();
  });

  it('handles KV put failure gracefully', async () => {
    mockKv.put.mockRejectedValue(new Error('KV full'));

    await expect(
      logErrorToKv(new Error('test'), {
        operation: 'test',
        timestamp: 1700000000000,
      }, mockKv as never)
    ).resolves.not.toThrow();
  });

  it('uses unknown as fallback license nonce when not provided', async () => {
    const error = new Error('test');
    await logErrorToKv(error, {
      operation: 'test',
      timestamp: 1700000000000,
    }, mockKv as never);

    expect(mockKv.put.mock.calls[0][0]).toContain('unknown');
  });
});
