/**
 * Tests for affiliate scout writer
 *
 * Verifies:
 * - New affiliates are inserted and webhook emitted
 * - Duplicate affiliates (ON CONFLICT DO NOTHING) are not re-emitted
 * - Mock client used when no real credentials in env
 * - Errors from individual clients do not abort entire run
 *
 * Note: scoringCtx with threshold:0 is passed to bypass quality gating in
 * these unit tests — scoring behaviour is covered by scoring.test.ts.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ScoutEnv } from '../types';

const PASS_ALL_SCORES = { threshold: 0 };

// --- Mocks ---

// Mock the webhooks emitter so we can count calls
vi.mock('@/lib/webhooks', () => ({
  emit: vi.fn(),
}));

// Mock logger to silence output
vi.mock('@/seed/utils/logger-utility', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { emit } from '@/lib/webhooks';
import { runAffiliateScout } from '../writer';

// --- D1 stub helpers ---

function makeD1(insertChanges: number): D1Database {
  const stmt = {
    bind: vi.fn().mockReturnThis(),
    run: vi.fn().mockResolvedValue({ meta: { changes: insertChanges } }),
    first: vi.fn(),
    all: vi.fn(),
  };
  return {
    prepare: vi.fn().mockReturnValue(stmt),
    exec: vi.fn(),
    dump: vi.fn(),
    batch: vi.fn(),
  } as unknown as D1Database;
}

// D1 that throws on prepare
function makeFailingD1(): D1Database {
  return {
    prepare: vi.fn().mockImplementation(() => {
      throw new Error('D1 connection error');
    }),
    exec: vi.fn(),
    dump: vi.fn(),
    batch: vi.fn(),
  } as unknown as D1Database;
}

describe('runAffiliateScout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 0 discovered when no DB binding', async () => {
    const env: ScoutEnv = {};
    const result = await runAffiliateScout(env, 'tenant-1');
    expect(result.discovered).toBe(0);
    expect(result.errors).toHaveLength(0);
  });

  it('uses mock client when no real credentials, discovers 3 affiliates', async () => {
    const db = makeD1(1); // every insert is new
    const env: ScoutEnv = { DB: db };

    const result = await runAffiliateScout(env, 'tenant-1', PASS_ALL_SCORES);
    expect(result.discovered).toBe(3);
    expect(result.errors).toHaveLength(0);
  });

  it('emits affiliate.discovered for each new insert', async () => {
    const db = makeD1(1);
    const env: ScoutEnv = { DB: db };

    await runAffiliateScout(env, 'tenant-abc', PASS_ALL_SCORES);

    expect(emit).toHaveBeenCalledTimes(3);
    const firstCall = (emit as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(firstCall[1]).toBe('affiliate.discovered');
    expect(firstCall[3]).toBe('tenant-abc');
  });

  it('does NOT emit when insert returns 0 changes (duplicate)', async () => {
    const db = makeD1(0); // all rows already exist
    const env: ScoutEnv = { DB: db };

    const result = await runAffiliateScout(env, 'tenant-1', PASS_ALL_SCORES);
    expect(result.discovered).toBe(0);
    expect(emit).not.toHaveBeenCalled();
  });

  it('emitted payload contains required fields', async () => {
    const db = makeD1(1);
    const env: ScoutEnv = { DB: db };

    await runAffiliateScout(env, 'tenant-x', PASS_ALL_SCORES);

    const call = (emit as ReturnType<typeof vi.fn>).mock.calls[0];
    const data = call[2] as Record<string, unknown>;
    expect(data).toHaveProperty('affiliateId');
    expect(data).toHaveProperty('tenantId', 'tenant-x');
    expect(data).toHaveProperty('network');
    expect(data).toHaveProperty('productName');
  });

  it('continues when D1 insert throws for one record', async () => {
    let callCount = 0;
    const stmt = {
      bind: vi.fn().mockReturnThis(),
      // first() is called by getOrDefault (scoring/geo lookups) — return null (use defaults)
      first: vi.fn().mockResolvedValue(null),
      run: vi.fn().mockImplementation(() => {
        callCount++;
        // first 2 calls are getOrDefault queries (scoring + geo per-tenant), not inserts
        // inserts start at callCount 3+
        if (callCount === 3) throw new Error('transient error');
        return Promise.resolve({ meta: { changes: 1 } });
      }),
    };
    const db = { prepare: vi.fn().mockReturnValue(stmt) } as unknown as D1Database;
    const env: ScoutEnv = { DB: db };

    // Should not throw; errors are caught per-row
    const result = await runAffiliateScout(env, 'tenant-1', PASS_ALL_SCORES);
    // 2 of 3 inserts succeed (1 threw, caught per-row)
    expect(result.discovered).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Tenant scoring override tests
// ---------------------------------------------------------------------------

describe('runAffiliateScout — per-tenant scoring overrides', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('caller-supplied threshold overrides tenant settings threshold', async () => {
    // threshold:0 in scoringCtx → all 3 mock affiliates pass
    const db = makeD1(1);
    const env: ScoutEnv = { DB: db };
    const result = await runAffiliateScout(env, 'tenant-1', { threshold: 0 });
    expect(result.discovered).toBe(3);
  });

  it('high threshold from scoringCtx blocks all affiliates', async () => {
    const db = makeD1(1);
    const env: ScoutEnv = { DB: db };
    const result = await runAffiliateScout(env, 'tenant-1', { threshold: 1.0 });
    // No mock affiliate scores 1.0
    expect(result.discovered).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Tenant geo override tests
// ---------------------------------------------------------------------------

describe('runAffiliateScout — per-tenant geo overrides', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('suppresses emit for geo-blocked country+category', async () => {
    const db = makeD1(1);
    const env: ScoutEnv = { DB: db };

    // Pass threshold 0 so all affiliates qualify, then check geo suppression
    await runAffiliateScout(env, 'tenant-1', { threshold: 0 }, 'US');

    // emit is mocked globally via vi.mock — check call count is less than discovered
    // (geo-blocked affiliates are inserted but not emitted)
    const emitCalls = (emit as ReturnType<typeof vi.fn>).mock.calls.length;
    // At least one should be blocked (mock affiliates have crypto/finance categories)
    expect(emitCalls).toBeLessThan(3);
  });

  it('geo-gate does not fire when no tenantCountry supplied', async () => {
    const db = makeD1(1);
    const env: ScoutEnv = { DB: db };
    await runAffiliateScout(env, 'tenant-1', { threshold: 0 });
    // Without country, no geo-blocking — all 3 emitted
    expect(emit).toHaveBeenCalledTimes(3);
  });
});
