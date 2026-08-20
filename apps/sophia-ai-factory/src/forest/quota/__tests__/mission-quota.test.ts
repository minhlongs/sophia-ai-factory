/**
 * Tests for mission-quota.ts
 *
 * Verifies that monthly mission quota checks correctly query and sum counts
 * from both `missions` and `engine_missions` tables, resolve owner mappings,
 * enforce tier boundaries, and fail open on DB errors.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { checkMissionQuota } from '../mission-quota';
import { getD1 } from '@/seed/db/client';
import { resolveOrgId, resolveOrgOwnerUserId } from '@/seed/auth/resolve-org-id';

vi.mock('@/seed/db/client', () => ({
  getD1: vi.fn(),
}));

vi.mock('@/seed/auth/resolve-org-id', () => ({
  resolveOrgId: vi.fn(),
  resolveOrgOwnerUserId: vi.fn(),
}));

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

function mockD1Database(missionsCount: number, engineMissionsCount: number) {
  const firstMissions = vi.fn().mockResolvedValue({ c: missionsCount });
  const firstEngine = vi.fn().mockResolvedValue({ c: engineMissionsCount });

  const prepare = vi.fn().mockImplementation((sql: string) => {
    if (sql.includes('FROM missions')) {
      return {
        bind: vi.fn().mockReturnValue({
          first: firstMissions,
        }),
      };
    }
    if (sql.includes('FROM engine_missions')) {
      return {
        bind: vi.fn().mockReturnValue({
          first: firstEngine,
        }),
      };
    }
    return {
      bind: vi.fn().mockReturnValue({
        first: vi.fn().mockResolvedValue({ c: 0 }),
      }),
    };
  });

  return { prepare };
}

describe('checkMissionQuota', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('allows request when sum of both tables is below the tier limit', async () => {
    const d1 = mockD1Database(4, 5); // 4 + 5 = 9
    vi.mocked(getD1).mockResolvedValue(d1 as unknown as D1Database);
    vi.mocked(resolveOrgOwnerUserId).mockResolvedValue('user-abc');

    const result = await checkMissionQuota('org-123', 'BASIC', 'missions');

    expect(result.allowed).toBe(true);
    expect(result.used).toBe(9);
    expect(result.limit).toBe(10);
    expect(resolveOrgOwnerUserId).toHaveBeenCalledWith('org-123', d1);
  });

  it('blocks request when sum of both tables equals the tier limit', async () => {
    const d1 = mockD1Database(5, 5); // 5 + 5 = 10
    vi.mocked(getD1).mockResolvedValue(d1 as unknown as D1Database);
    vi.mocked(resolveOrgOwnerUserId).mockResolvedValue('user-abc');

    const result = await checkMissionQuota('org-123', 'BASIC', 'missions');

    expect(result.allowed).toBe(false);
    expect(result.used).toBe(10);
    expect(result.limit).toBe(10);
  });

  it('blocks request when sum of both tables exceeds the tier limit', async () => {
    const d1 = mockD1Database(6, 5); // 6 + 5 = 11
    vi.mocked(getD1).mockResolvedValue(d1 as unknown as D1Database);
    vi.mocked(resolveOrgId).mockResolvedValue('org-123');

    const result = await checkMissionQuota('user-abc', 'BASIC', 'engine_missions');

    expect(result.allowed).toBe(false);
    expect(result.used).toBe(11);
    expect(result.limit).toBe(10);
    expect(resolveOrgId).toHaveBeenCalledWith('user-abc', d1);
  });

  it('correctly maps PREMIUM tier limits', async () => {
    const d1 = mockD1Database(40, 59); // 40 + 59 = 99
    vi.mocked(getD1).mockResolvedValue(d1 as unknown as D1Database);
    vi.mocked(resolveOrgOwnerUserId).mockResolvedValue('user-abc');

    const result = await checkMissionQuota('org-123', 'PREMIUM', 'missions');

    expect(result.allowed).toBe(true);
    expect(result.used).toBe(99);
    expect(result.limit).toBe(100);
  });

  it('falls back to BASIC tier limit if tier is unknown', async () => {
    const d1 = mockD1Database(5, 5); // 5 + 5 = 10 (BASIC limit = 10)
    vi.mocked(getD1).mockResolvedValue(d1 as unknown as D1Database);
    vi.mocked(resolveOrgOwnerUserId).mockResolvedValue('user-abc');

    const result = await checkMissionQuota('org-123', 'UNKNOWN_TIER', 'missions');

    expect(result.allowed).toBe(false);
    expect(result.used).toBe(10);
    expect(result.limit).toBe(10);
  });

  it('fails open on D1 database error', async () => {
    vi.mocked(getD1).mockRejectedValue(new Error('D1 connection failure'));

    const result = await checkMissionQuota('org-123', 'BASIC', 'missions');

    expect(result.allowed).toBe(true);
    expect(result.used).toBe(0);
    expect(result.limit).toBe(10);
  });

  it('fails open if D1 client is unavailable (null)', async () => {
    vi.mocked(getD1).mockResolvedValue(null as unknown as D1Database);

    const result = await checkMissionQuota('org-123', 'BASIC', 'missions');

    expect(result.allowed).toBe(true);
    expect(result.used).toBe(0);
    expect(result.limit).toBe(10);
  });
});
