/**
 * Unit tests for probe-kv.ts — mock KVNamespace, assert null value = up + error path.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { KVNamespace } from '@cloudflare/workers-types';

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('probeKv', () => {
  it('returns up when KV get returns a value', async () => {
    const mockKv = {
      get: vi.fn().mockResolvedValue('ok'),
    } as unknown as KVNamespace;

    const { probeKv } = await import('./probe-kv');
    const result = await probeKv(mockKv);
    expect(result.status).toBe('up');
  });

  it('returns up when KV get returns null (key absent — binding still works)', async () => {
    const mockKv = {
      get: vi.fn().mockResolvedValue(null),
    } as unknown as KVNamespace;

    const { probeKv } = await import('./probe-kv');
    const result = await probeKv(mockKv);
    expect(result.status).toBe('up');
  });

  it('returns down when KV throws', async () => {
    const mockKv = {
      get: vi.fn().mockRejectedValue(new Error('KV namespace error')),
    } as unknown as KVNamespace;

    const { probeKv } = await import('./probe-kv');
    const result = await probeKv(mockKv);
    expect(result.status).toBe('down');
    expect(result.error).toContain('KV namespace error');
  });
});
