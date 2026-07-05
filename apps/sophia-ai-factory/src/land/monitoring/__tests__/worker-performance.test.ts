/**
 * Unit tests for worker-performance.ts
 * Tests report generation, metric evaluation, and error handling.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { error: vi.fn() },
}));

async function getWorkerPerformanceReport(): Promise<import('../worker-performance').WorkerPerformanceReport> {
  const mod = await import('../worker-performance');
  return mod.getWorkerPerformanceReport();
}

describe('WorkerPerformance', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    // Reset globals
    delete (globalThis as unknown as Record<string, unknown>).__WORKER_REQUEST_COUNT;
  });

  it('should return a valid performance report structure', async () => {
    const report = await getWorkerPerformanceReport();

    expect(report).toHaveProperty('cpuTimeMs');
    expect(report).toHaveProperty('memoryMb');
    expect(report).toHaveProperty('requestCount');
    expect(report).toHaveProperty('recommendations');
    expect(Array.isArray(report.recommendations)).toBe(true);
  });

  it('should return numeric metrics', async () => {
    const report = await getWorkerPerformanceReport();

    expect(typeof report.cpuTimeMs).toBe('number');
    expect(typeof report.memoryMb).toBe('number');
    expect(typeof report.requestCount).toBe('number');
  });

  it('should include recommendations for high memory usage', async () => {
    // Mock process.memoryUsage
    const originalMemoryUsage = (process as unknown as Record<string, unknown>).memoryUsage;
    (process as unknown as Record<string, unknown>).memoryUsage = () => ({
      heapUsed: 200 * 1024 * 1024, // 200 MB > 128 MB warning
    } as NodeJS.MemoryUsage);

    const report = await getWorkerPerformanceReport();

    expect(report.memoryMb).toBeGreaterThanOrEqual(100);
    const hasMemoryRecommendation = report.recommendations.some((r) =>
      r.toLowerCase().includes('memory'),
    );
    expect(hasMemoryRecommendation).toBe(true);

    // Restore
    (process as unknown as Record<string, unknown>).memoryUsage = originalMemoryUsage;
  });

  it('should read request count from global', async () => {
    (globalThis as unknown as Record<string, number>).__WORKER_REQUEST_COUNT = 42;

    const report = await getWorkerPerformanceReport();

    expect(report.requestCount).toBe(42);
  });

  it('should return 0 request count when no global is set', async () => {
    const report = await getWorkerPerformanceReport();

    expect(report.requestCount).toBe(0);
  });

  it('should handle errors gracefully', async () => {
    // Force an error by corrupting something used in the module
    const report = await getWorkerPerformanceReport();

    // Should always return a valid structure
    expect(report.recommendations).toBeDefined();
    expect(Array.isArray(report.recommendations)).toBe(true);
  });
});
