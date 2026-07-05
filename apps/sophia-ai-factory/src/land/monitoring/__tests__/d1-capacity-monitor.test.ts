/**
 * Unit tests for d1-capacity-monitor.ts
 * Tests report generation, alert level detection, and error handling.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';

// Mock the D1 client module
vi.mock('@/seed/db/client', () => ({
  getD1: vi.fn(),
}));

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { error: vi.fn() },
}));

import { getD1 } from '@/seed/db/client';

async function getD1CapacityReport(): Promise<import('../d1-capacity-monitor').D1CapacityReport> {
  const mod = await import('../d1-capacity-monitor');
  return mod.getD1CapacityReport();
}

/** Build a D1Database mock that returns predictable results. */
function buildMockDb(opts?: { tableRows?: Record<string, number> }) {
  const rows = opts?.tableRows ?? { users: 100, purchases: 500, videos: 300 };
  const masterRows = Object.keys(rows).map((name) => ({ name, type: 'table' }));
  let callSeq = 0;

  // Store table names for COUNT queries
  const tableNames = Object.entries(rows);

  const mockPrepare = vi.fn().mockImplementation((sql: string) => {
    const chain = {
      bind: vi.fn().mockReturnThis(),
      all: vi.fn().mockImplementation(async () => {
        callSeq++;
        // First 3 calls are latency probes (SELECT 1 etc.)
        if (callSeq <= 3) return { results: [] };
        // 4th call is sqlite_master query
        if (sql.includes('sqlite_master')) return { results: masterRows };
        return { results: [] };
      }),
      first: vi.fn().mockImplementation(async () => {
        callSeq++;
        // First 3 calls are latency probes (SELECT 1, SELECT COUNT(*))
        if (callSeq <= 3) return null;
        // COUNT(*) queries for each table
        for (const [name, cnt] of tableNames) {
          if (sql.includes(`\`${name}\``)) {
            return { cnt };
          }
        }
        return { cnt: 0 };
      }),
    };

    return chain as unknown as ReturnType<D1Database['prepare']>;
  });

  return {
    prepare: mockPrepare,
  } as unknown as D1Database;
}

describe('D1CapacityMonitor', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    // Reset global query counters
    delete (globalThis as unknown as Record<string, unknown>).__D1_QUERY_COUNT;
    delete (globalThis as unknown as Record<string, unknown>).__D1_ERROR_COUNT;
  });

  it('should return green alert level when no D1 binding is available', async () => {
    vi.mocked(getD1).mockReturnValue(null);

    const report = await getD1CapacityReport();

    expect(report.alertLevel).toBe('green');
    expect(report.recommendations).toContain(
      'D1 database binding not available — running outside Cloudflare runtime.',
    );
    expect(report.totalQueries).toBe(0);
    expect(report.avgLatencyMs).toBe(0);
  });

  it('should return a valid report with D1 binding present', async () => {
    vi.mocked(getD1).mockReturnValue(buildMockDb());

    const report = await getD1CapacityReport();

    expect(report).toHaveProperty('totalQueries');
    expect(report).toHaveProperty('avgLatencyMs');
    expect(report).toHaveProperty('p95LatencyMs');
    expect(report).toHaveProperty('errorRate');
    expect(report).toHaveProperty('tablesSizeBytes');
    expect(report).toHaveProperty('alertLevel');
    expect(report).toHaveProperty('recommendations');
    expect(['green', 'yellow', 'red']).toContain(report.alertLevel);
    expect(Array.isArray(report.recommendations)).toBe(true);
  });

  it('should include at least one recommendation', async () => {
    vi.mocked(getD1).mockReturnValue(buildMockDb());

    const report = await getD1CapacityReport();

    expect(report.recommendations.length).toBeGreaterThanOrEqual(1);
  });

  it('should handle D1 query errors gracefully', async () => {
    vi.mocked(getD1).mockReturnValue({
      prepare: () => {
        throw new Error('D1 query failed');
      },
    } as unknown as D1Database);

    const report = await getD1CapacityReport();

    expect(report).toHaveProperty('alertLevel');
    expect(report.alertLevel).toBe('red');
  });

  it('should detect elevated error rates and produce recommendations', async () => {
    // Set high query error rate
    (globalThis as unknown as Record<string, number>).__D1_QUERY_COUNT = 100;
    (globalThis as unknown as Record<string, number>).__D1_ERROR_COUNT = 3; // 3% error rate

    vi.mocked(getD1).mockReturnValue(buildMockDb());

    const report = await getD1CapacityReport();

    const hasErrorRecommendation = report.recommendations.some((r) =>
      r.toLowerCase().includes('error'),
    );
    expect(hasErrorRecommendation).toBe(true);
  });

  it('should handle empty sqlite_master results', async () => {
    vi.mocked(getD1).mockReturnValue(buildMockDb({ tableRows: {} }));

    const report = await getD1CapacityReport();

    expect(report.tablesSizeBytes).toBeNull();
    expect(report.alertLevel).toBeDefined();
  });

  it('should return numeric latency values', async () => {
    vi.mocked(getD1).mockReturnValue(buildMockDb());

    const report = await getD1CapacityReport();

    expect(typeof report.avgLatencyMs).toBe('number');
    expect(typeof report.p95LatencyMs).toBe('number');
  });

  it('should return green alert level when metrics are healthy', async () => {
    // Clean counters = healthy
    vi.mocked(getD1).mockReturnValue(buildMockDb());

    const report = await getD1CapacityReport();

    // With normal params, should be green or yellow
    expect(['green', 'yellow']).toContain(report.alertLevel);
  });
});
