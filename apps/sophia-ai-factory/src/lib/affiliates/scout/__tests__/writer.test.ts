/**
 * Tests for affiliate scout writer
 *
 * Verifies:
 * - New affiliates are inserted and webhook emitted
 * - Duplicate affiliates (ON CONFLICT DO NOTHING) are not re-emitted
 * - Mock client used when no real credentials in env
 * - Errors from individual clients do not abort entire run
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ScoutEnv } from '../types';

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

    const result = await runAffiliateScout(env, 'tenant-1');
    expect(result.discovered).toBe(3);
    expect(result.errors).toHaveLength(0);
  });

  it('emits affiliate.discovered for each new insert', async () => {
    const db = makeD1(1);
    const env: ScoutEnv = { DB: db };

    await runAffiliateScout(env, 'tenant-abc');

    expect(emit).toHaveBeenCalledTimes(3);
    const firstCall = (emit as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(firstCall[1]).toBe('affiliate.discovered');
    expect(firstCall[3]).toBe('tenant-abc');
  });

  it('does NOT emit when insert returns 0 changes (duplicate)', async () => {
    const db = makeD1(0); // all rows already exist
    const env: ScoutEnv = { DB: db };

    const result = await runAffiliateScout(env, 'tenant-1');
    expect(result.discovered).toBe(0);
    expect(emit).not.toHaveBeenCalled();
  });

  it('emitted payload contains required fields', async () => {
    const db = makeD1(1);
    const env: ScoutEnv = { DB: db };

    await runAffiliateScout(env, 'tenant-x');

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
      run: vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) throw new Error('transient error');
        return Promise.resolve({ meta: { changes: 1 } });
      }),
    };
    const db = { prepare: vi.fn().mockReturnValue(stmt) } as unknown as D1Database;
    const env: ScoutEnv = { DB: db };

    // Should not throw; errors are caught per-row
    const result = await runAffiliateScout(env, 'tenant-1');
    // 2 of 3 succeed
    expect(result.discovered).toBe(2);
  });
});
