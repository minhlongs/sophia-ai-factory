/**
 * Tests for cohort retention, churn, and LTV calculators + API route auth.
 *
 * Calculator tests use mock D1Database (no network).
 * API route auth tests validate the 401/403/400 gate logic directly.
 */

import { describe, it, expect, vi } from 'vitest';

// ── Top-level mocks (hoisted by Vitest) ───────────────────────────────────────
// These mock the modules that the API route depends on for auth tests.

vi.mock('@/lib/better-auth-session', () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock('@/lib/analytics/rbac', () => ({
  checkAdmin: vi.fn(),
}));

vi.mock('@/lib/analytics/queries/revenue-nowpayments', () => ({
  fetchRevenueSnapshot: vi.fn().mockResolvedValue({
    arr: 12000,
    mrr: 1000,
    mrrGrowthPct: null,
    byTier: [
      { tier: 'BASIC', customers: 10, mrr: 200, arr: 2400 },
      { tier: 'PREMIUM', customers: 5, mrr: 500, arr: 6000 },
    ],
    trend30d: [],
    periodStart: '2026-03-01T00:00:00.000Z',
    periodEnd: '2026-04-01T00:00:00.000Z',
  }),
}));

// ── D1 mock builder ───────────────────────────────────────────────────────────

/**
 * Creates a mock D1Database where each .prepare(sql) call returns rows
 * matched by the first table name found in the SQL string.
 */
function makeD1(tables: Record<string, unknown[]>): D1Database {
  return {
    prepare: (sql: string) => {
      // Find which table this query targets by checking for table name keywords
      const matched = Object.entries(tables).find(([table]) =>
        sql.toLowerCase().includes(table.toLowerCase()),
      );
      const rows = matched ? matched[1] : [];

      const stmt = {
        bind: (..._args: unknown[]) => stmt,
        all: async <T>() => ({ results: rows as T[], success: true }),
        first: async <T>() => (rows[0] as T) ?? null,
        run: async () => ({ success: true, meta: {} }),
      };
      return stmt;
    },
    dump: async () => new ArrayBuffer(0),
    batch: async () => [],
    exec: async () => ({ count: 0, duration: 0 }),
  } as unknown as D1Database;
}

// ── Imports (after mocks) ─────────────────────────────────────────────────────

import { fetchCohortRetention } from '@/lib/analytics/cohort-calculator';
import { fetchChurnTimeline } from '@/lib/analytics/churn-calculator';
import { calculateLTVByTier } from '@/lib/analytics/ltv-calculator';
import { getCurrentUser } from '@/lib/better-auth-session';
import { checkAdmin } from '@/lib/analytics/rbac';

// ── Cohort retention tests ────────────────────────────────────────────────────

describe('fetchCohortRetention', () => {
  it('returns empty matrix when no users', async () => {
    const db = makeD1({ users: [], usage_logs: [] });
    const result = await fetchCohortRetention(db, 3);
    expect(result.cohorts).toHaveLength(0);
    expect(result.monthsTracked).toBe(3);
  });

  it('groups users by cohort month, M0 is always 100%', async () => {
    const db = makeD1({
      users: [
        { user_id: 'u1', cohort_month: '2026-01' },
        { user_id: 'u2', cohort_month: '2026-01' },
        { user_id: 'u3', cohort_month: '2026-02' },
      ],
      usage_logs: [],
    });

    const result = await fetchCohortRetention(db, 2);
    expect(result.cohorts.length).toBeGreaterThanOrEqual(1);
    for (const cohort of result.cohorts) {
      expect(cohort.retentionByMonth[0]).toBe(100);
    }
  });

  it('clamps months to 1–24', async () => {
    const db = makeD1({ users: [], usage_logs: [] });
    const r1 = await fetchCohortRetention(db, 0);
    expect(r1.monthsTracked).toBe(1);
    const r2 = await fetchCohortRetention(db, 99);
    expect(r2.monthsTracked).toBe(24);
  });

  it('unknown cohort for null created_at', async () => {
    const db = makeD1({
      users: [{ user_id: 'u1', cohort_month: 'unknown' }],
      usage_logs: [],
    });
    const result = await fetchCohortRetention(db, 2);
    const unknown = result.cohorts.find(c => c.cohortMonth === 'unknown');
    expect(unknown).toBeDefined();
    // All offsets past M0 should be 0 for unknown
    if (unknown && unknown.retentionByMonth.length > 1) {
      expect(unknown.retentionByMonth[1]).toBe(0);
    }
  });
});

// ── Churn calculator tests ────────────────────────────────────────────────────

describe('fetchChurnTimeline', () => {
  it('returns empty timeline when no events', async () => {
    // Use separate tables; query for tier_change_events returns []
    // query for raas_licenses returns count row
    const db = {
      prepare: (sql: string) => {
        const isTierChange = sql.includes('tier_change_events');
        const isLicense = sql.includes('raas_licenses');
        const stmt = {
          bind: (..._args: unknown[]) => stmt,
          all: async <T>() => ({
            results: (isTierChange ? [] : []) as T[],
            success: true,
          }),
          first: async <T>() => {
            if (isLicense) return { active_count: 10 } as T;
            return null;
          },
          run: async () => ({ success: true, meta: {} }),
        };
        return stmt;
      },
      dump: async () => new ArrayBuffer(0),
      batch: async () => [],
      exec: async () => ({ count: 0, duration: 0 }),
    } as unknown as D1Database;

    const result = await fetchChurnTimeline(db, 90);
    expect(result.points).toHaveLength(0);
    expect(result.cancellations).toHaveLength(0);
    expect(result.downgrades).toHaveLength(0);
    expect(result.avgMonthlyChurnRate).toBe(0);
  });

  it('classifies cancel events correctly', async () => {
    const now = new Date().toISOString();
    const cancelRows = [
      { user_id: 'u1', from_tier: 'PREMIUM', to_tier: null, event_type: 'cancel', created_at: now },
      { user_id: 'u2', from_tier: 'BASIC', to_tier: null, event_type: 'cancel', created_at: now },
    ];

    const db = {
      prepare: (sql: string) => {
        const isTierChange = sql.includes('tier_change_events');
        const isLicense = sql.includes('raas_licenses');
        const stmt = {
          bind: (..._args: unknown[]) => stmt,
          all: async <T>() => ({
            results: (isTierChange ? cancelRows : []) as T[],
            success: true,
          }),
          first: async <T>() => {
            if (isLicense) return { active_count: 20 } as T;
            return null;
          },
          run: async () => ({ success: true, meta: {} }),
        };
        return stmt;
      },
      dump: async () => new ArrayBuffer(0),
      batch: async () => [],
      exec: async () => ({ count: 0, duration: 0 }),
    } as unknown as D1Database;

    const result = await fetchChurnTimeline(db, 90);
    expect(result.cancellations).toHaveLength(2);
    expect(result.downgrades).toHaveLength(0);
  });

  it('classifies downgrade events correctly', async () => {
    const now = new Date().toISOString();
    const downgradeRows = [
      { user_id: 'u1', from_tier: 'PREMIUM', to_tier: 'BASIC', event_type: 'downgrade', created_at: now },
    ];

    const db = {
      prepare: (sql: string) => {
        const isTierChange = sql.includes('tier_change_events');
        const isLicense = sql.includes('raas_licenses');
        const stmt = {
          bind: (..._args: unknown[]) => stmt,
          all: async <T>() => ({
            results: (isTierChange ? downgradeRows : []) as T[],
            success: true,
          }),
          first: async <T>() => {
            if (isLicense) return { active_count: 5 } as T;
            return null;
          },
          run: async () => ({ success: true, meta: {} }),
        };
        return stmt;
      },
      dump: async () => new ArrayBuffer(0),
      batch: async () => [],
      exec: async () => ({ count: 0, duration: 0 }),
    } as unknown as D1Database;

    const result = await fetchChurnTimeline(db, 90);
    expect(result.downgrades).toHaveLength(1);
    expect(result.cancellations).toHaveLength(0);
  });

  it('churnRate is non-negative number', async () => {
    const now = new Date().toISOString();
    const rows = [
      { user_id: 'u1', from_tier: 'PREMIUM', to_tier: null, event_type: 'cancel', created_at: now },
    ];

    const db = {
      prepare: (sql: string) => {
        const isTierChange = sql.includes('tier_change_events');
        const isLicense = sql.includes('raas_licenses');
        const stmt = {
          bind: (..._args: unknown[]) => stmt,
          all: async <T>() => ({
            results: (isTierChange ? rows : []) as T[],
            success: true,
          }),
          first: async <T>() => {
            if (isLicense) return { active_count: 100 } as T;
            return null;
          },
          run: async () => ({ success: true, meta: {} }),
        };
        return stmt;
      },
      dump: async () => new ArrayBuffer(0),
      batch: async () => [],
      exec: async () => ({ count: 0, duration: 0 }),
    } as unknown as D1Database;

    const result = await fetchChurnTimeline(db, 90);
    expect(result.avgMonthlyChurnRate).toBeGreaterThanOrEqual(0);
    if (result.points.length > 0) {
      expect(result.points[0].churnRate).toBeGreaterThanOrEqual(0);
    }
  });
});

// ── LTV calculator tests ──────────────────────────────────────────────────────

describe('calculateLTVByTier', () => {
  it('LTV = ARPU × avgLifetimeMonths for each tier', async () => {
    const db = {
      prepare: (sql: string) => {
        const isLicense = sql.includes('raas_licenses');
        const stmt = {
          bind: (..._args: unknown[]) => stmt,
          all: async <T>() => ({ results: [] as T[], success: true }),
          first: async <T>() => {
            if (isLicense) return { active_count: 0 } as T;
            return null;
          },
          run: async () => ({ success: true, meta: {} }),
        };
        return stmt;
      },
      dump: async () => new ArrayBuffer(0),
      batch: async () => [],
      exec: async () => ({ count: 0, duration: 0 }),
    } as unknown as D1Database;

    const result = await calculateLTVByTier(db);
    expect(result.tiers).toBeDefined();
    expect(result.tiers.length).toBeGreaterThan(0);

    for (const row of result.tiers) {
      const expectedLtv = Math.round(row.arpu * row.avgLifetimeMonths * 100) / 100;
      expect(row.ltv).toBeCloseTo(expectedLtv, 1);
    }
  });

  it('includes all 4 tiers', async () => {
    const db = makeD1({ tier_change_events: [], raas_licenses: [{ active_count: 0 }] });
    const result = await calculateLTVByTier(db);
    const tierNames = result.tiers.map(r => r.tier);
    expect(tierNames).toContain('BASIC');
    expect(tierNames).toContain('PREMIUM');
    expect(tierNames).toContain('ENTERPRISE');
    expect(tierNames).toContain('MASTER');
  });

  it('computes LTV:CAC ratios when CAC provided', async () => {
    const db = makeD1({ tier_change_events: [], raas_licenses: [{ active_count: 0 }] });
    const result = await calculateLTVByTier(db, { BASIC: 50, PREMIUM: 100 });
    expect(result.ltvCacRatios).toBeDefined();
    expect(typeof result.ltvCacRatios!['BASIC']).toBe('number');
    expect(typeof result.ltvCacRatios!['PREMIUM']).toBe('number');
  });
});

// ── API route auth tests ──────────────────────────────────────────────────────

import { NextRequest } from 'next/server';

describe('GET /api/analytics/cohorts — auth', () => {
  it('returns 401 when not authenticated', async () => {
    vi.mocked(getCurrentUser).mockResolvedValueOnce(null);

    const { GET } = await import('./route');
    const req = new NextRequest('http://localhost/api/analytics/cohorts?metric=retention');
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('returns 403 when non-admin authenticated', async () => {
    vi.mocked(getCurrentUser).mockResolvedValueOnce({ id: 'u1', email: 'user@test.com' } as Awaited<ReturnType<typeof getCurrentUser>>);
    vi.mocked(checkAdmin).mockResolvedValueOnce(false);

    const { GET } = await import('./route');
    const req = new NextRequest('http://localhost/api/analytics/cohorts?metric=retention');
    const res = await GET(req);
    expect(res.status).toBe(403);
  });

  it('returns 400 for invalid metric param', async () => {
    vi.mocked(getCurrentUser).mockResolvedValueOnce({ id: 'u1', email: 'admin@test.com' } as Awaited<ReturnType<typeof getCurrentUser>>);
    vi.mocked(checkAdmin).mockResolvedValueOnce(true);

    const { GET } = await import('./route');
    const req = new NextRequest('http://localhost/api/analytics/cohorts?metric=invalid');
    const res = await GET(req);
    expect(res.status).toBe(400);
  });
});
