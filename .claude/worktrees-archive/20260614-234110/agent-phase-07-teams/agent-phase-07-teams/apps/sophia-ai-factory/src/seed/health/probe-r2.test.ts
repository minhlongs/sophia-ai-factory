/**
 * Unit tests for probe-r2.ts — mock R2Bucket, assert 404 treated as up + error path.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { R2Bucket } from '@cloudflare/workers-types';

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('probeR2', () => {
  it('returns up when head resolves (sentinel exists)', async () => {
    const mockBucket = {
      head: vi.fn().mockResolvedValue({ key: 'health-check.txt', size: 3 }),
    } as unknown as R2Bucket;

    const { probeR2 } = await import('./probe-r2');
    const result = await probeR2(mockBucket);
    expect(result.status).toBe('up');
  });

  it('returns up when head returns null (sentinel absent — binding still works)', async () => {
    const mockBucket = {
      head: vi.fn().mockResolvedValue(null),
    } as unknown as R2Bucket;

    const { probeR2 } = await import('./probe-r2');
    const result = await probeR2(mockBucket);
    expect(result.status).toBe('up');
  });

  it('returns down when bucket throws', async () => {
    const mockBucket = {
      head: vi.fn().mockRejectedValue(new Error('R2 network error')),
    } as unknown as R2Bucket;

    const { probeR2 } = await import('./probe-r2');
    const result = await probeR2(mockBucket);
    expect(result.status).toBe('down');
    expect(result.error).toContain('R2 network error');
  });
});
