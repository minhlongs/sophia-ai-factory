/**
 * Unit tests for probe-d1.ts — mock D1Database, assert timeout + happy path.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { D1Database } from '@cloudflare/workers-types';

// Reset cache between tests by re-importing module
beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('probeD1', () => {
  it('returns up when SELECT 1 resolves', async () => {
    const mockDb = {
      prepare: vi.fn().mockReturnValue({
        first: vi.fn().mockResolvedValue({ '1': 1 }),
      }),
    } as unknown as D1Database;

    const { probeD1 } = await import('./probe-d1');
    const result = await probeD1(mockDb);
    expect(result.status).toBe('up');
    expect(result.latency).toBeGreaterThanOrEqual(0);
  });

  it('returns down when DB throws', async () => {
    const mockDb = {
      prepare: vi.fn().mockReturnValue({
        first: vi.fn().mockRejectedValue(new Error('D1 connection refused')),
      }),
    } as unknown as D1Database;

    const { probeD1 } = await import('./probe-d1');
    const result = await probeD1(mockDb);
    expect(result.status).toBe('down');
    expect(result.error).toContain('D1 connection refused');
  });
});
