/**
 * Unit tests for alert-throttle KV helpers.
 * Verifies: absent KV never suppresses (observability never silently lost).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock globalThis KV binding before importing the module under test.
const mockGet = vi.fn();
const mockPut = vi.fn();

beforeEach(() => {
  vi.restoreAllMocks();
  vi.resetModules(); // force re-import of module under test for fresh globalThis reads
  mockGet.mockReset();
  mockPut.mockReset();
  // Reset globalThis bindings between tests.
  // Must clear BOTH the top-level binding AND the __env (single underscore)
  // binding that src/test/setup.tsx populates with the shared kvMock.
  delete (globalThis as Record<string, unknown>).EXPERIMENT_KV;
  delete (globalThis as Record<string, unknown>).__env__;
  delete (globalThis as Record<string, unknown>).__env;
});

describe('getAlertThrottleKv', () => {
  it('returns null when no KV binding present', async () => {
    const { getAlertThrottleKv } = await import('../alert-throttle');
    expect(getAlertThrottleKv()).toBeNull();
  });

  it('returns the EXPERIMENT_KV binding when present', async () => {
    (globalThis as Record<string, unknown>).EXPERIMENT_KV = {
      get: mockGet,
      put: mockPut,
    };
    const { getAlertThrottleKv } = await import('../alert-throttle');
    expect(getAlertThrottleKv()).not.toBeNull();
  });
});

describe('isAlertThrottled', () => {
  it('returns false when KV binding is absent (never suppress on infra uncertainty)', async () => {
    const { isAlertThrottled } = await import('../alert-throttle');
    const result = await isAlertThrottled('cb_alert:openrouter');
    expect(result).toBe(false);
  });

  it('returns true when KV has a value for the key', async () => {
    mockGet.mockResolvedValue('alert-id-123');
    (globalThis as Record<string, unknown>).EXPERIMENT_KV = {
      get: mockGet,
      put: mockPut,
    };
    const { isAlertThrottled } = await import('../alert-throttle');
    const result = await isAlertThrottled('cb_alert:openrouter');
    expect(result).toBe(true);
    expect(mockGet).toHaveBeenCalledWith('cb_alert:openrouter');
  });

  it('returns false when KV get throws (non-fatal)', async () => {
    mockGet.mockRejectedValue(new Error('KV unavailable'));
    (globalThis as Record<string, unknown>).EXPERIMENT_KV = {
      get: mockGet,
      put: mockPut,
    };
    const { isAlertThrottled } = await import('../alert-throttle');
    const result = await isAlertThrottled('cb_alert:openrouter');
    expect(result).toBe(false);
  });
});

describe('markAlertThrottled', () => {
  it('no-ops when KV binding is absent', async () => {
    const { markAlertThrottled } = await import('../alert-throttle');
    await markAlertThrottled('cb_alert:openrouter', 'alert-id', 900);
    expect(mockPut).not.toHaveBeenCalled();
  });

  it('writes to KV with expirationTtl when binding present', async () => {
    (globalThis as Record<string, unknown>).EXPERIMENT_KV = {
      get: mockGet,
      put: mockPut,
    };
    const { markAlertThrottled } = await import('../alert-throttle');
    await markAlertThrottled('cb_alert:openrouter', 'alert-id', 900);
    expect(mockPut).toHaveBeenCalledWith('cb_alert:openrouter', 'alert-id', { expirationTtl: 900 });
  });

  it('enforces minimum 60s TTL', async () => {
    (globalThis as Record<string, unknown>).EXPERIMENT_KV = {
      get: mockGet,
      put: mockPut,
    };
    const { markAlertThrottled } = await import('../alert-throttle');
    await markAlertThrottled('cb_alert:openrouter', 'alert-id', 10);
    expect(mockPut).toHaveBeenCalledWith('cb_alert:openrouter', 'alert-id', { expirationTtl: 60 });
  });

  it('swallows KV put errors (non-fatal)', async () => {
    mockPut.mockRejectedValue(new Error('KV write failed'));
    (globalThis as Record<string, unknown>).EXPERIMENT_KV = {
      get: mockGet,
      put: mockPut,
    };
    const { markAlertThrottled } = await import('../alert-throttle');
    // Should not throw.
    await expect(markAlertThrottled('cb_alert:openrouter', 'alert-id', 900)).resolves.toBeUndefined();
  });
});
