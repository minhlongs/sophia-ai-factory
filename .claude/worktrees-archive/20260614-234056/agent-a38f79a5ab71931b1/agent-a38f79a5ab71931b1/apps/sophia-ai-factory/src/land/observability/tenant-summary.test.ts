/**
 * Tests for tenant-summary primitive — D1 mocked with sequenced responses.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { getTenantSummary } from './tenant-summary';

interface UserResp { id: string; email: string; name: string | null; role: string; createdAt: string }
interface StorageResp { total_bytes: number; video_count: number; last_calculated_at: number }
interface ApiKeysResp { active: number; total: number }
interface CountResp { n: number }

function setD1Mock(opts: {
  user?: UserResp | null;
  storage?: StorageResp | null;
  apiKeys?: ApiKeysResp | null;
  videoJobs?: CountResp | null;
  referrals?: CountResp | null;
  auditCount?: CountResp | null;
  recentAudit?: Array<{ id: number; action: string; resource: string | null; ts: number }>;
}) {
  // 7 queries in order: user, storage, apiKeys, videoJobs, referrals, auditCount, recentAudit (all)
  let call = 0;
  const first = vi.fn().mockImplementation(() => {
    call++;
    switch (call) {
      case 1: return Promise.resolve(opts.user ?? null);
      case 2: return Promise.resolve(opts.storage ?? null);
      case 3: return Promise.resolve(opts.apiKeys ?? null);
      case 4: return Promise.resolve(opts.videoJobs ?? null);
      case 5: return Promise.resolve(opts.referrals ?? null);
      case 6: return Promise.resolve(opts.auditCount ?? null);
      default: return Promise.resolve(null);
    }
  });
  const all = vi.fn().mockResolvedValue({ results: opts.recentAudit ?? [], success: true });
  const bind = vi.fn().mockReturnValue({ first, all });
  const db = { prepare: vi.fn().mockReturnValue({ bind }) };
  (globalThis as unknown as { __env: Record<string, unknown> }).__env = {
    ...((globalThis as unknown as { __env?: Record<string, unknown> }).__env ?? {}),
    DB: db,
  };
}

afterEach(() => vi.clearAllMocks());

const SAMPLE_USER: UserResp = {
  id: 't-1',
  email: 'a@x.com',
  name: 'Alex',
  role: 'user',
  createdAt: '2026-01-01T00:00:00Z',
};

describe('getTenantSummary', () => {
  it('returns null when tenantId is empty', async () => {
    setD1Mock({ user: SAMPLE_USER });
    const result = await getTenantSummary('');
    expect(result).toBeNull();
  });

  it('returns null when user not found', async () => {
    setD1Mock({ user: null });
    const result = await getTenantSummary('missing');
    expect(result).toBeNull();
  });

  it('maps user + zero counts when no related rows exist', async () => {
    setD1Mock({ user: SAMPLE_USER });
    const result = await getTenantSummary('t-1');
    expect(result).not.toBeNull();
    expect(result!.user.email).toBe('a@x.com');
    expect(result!.storage).toBeNull();
    expect(result!.apiKeys).toEqual({ active: 0, total: 0 });
    expect(result!.videoJobCount).toBe(0);
    expect(result!.referralCodeCount).toBe(0);
    expect(result!.auditLogCount).toBe(0);
    expect(result!.recentAudit).toEqual([]);
  });

  it('maps storage row when present', async () => {
    setD1Mock({
      user: SAMPLE_USER,
      storage: { total_bytes: 1024 * 1024 * 100, video_count: 5, last_calculated_at: 1700000000 },
    });
    const result = await getTenantSummary('t-1');
    expect(result!.storage).toEqual({
      totalBytes: 1024 * 1024 * 100,
      videoCount: 5,
      lastCalculatedAt: 1700000000,
    });
  });

  it('maps api key + counts', async () => {
    setD1Mock({
      user: SAMPLE_USER,
      apiKeys: { active: 3, total: 5 },
      videoJobs: { n: 42 },
      referrals: { n: 2 },
      auditCount: { n: 1234 },
    });
    const result = await getTenantSummary('t-1');
    expect(result!.apiKeys).toEqual({ active: 3, total: 5 });
    expect(result!.videoJobCount).toBe(42);
    expect(result!.referralCodeCount).toBe(2);
    expect(result!.auditLogCount).toBe(1234);
  });

  it('maps recent audit rows', async () => {
    setD1Mock({
      user: SAMPLE_USER,
      recentAudit: [
        { id: 1, action: 'login', resource: null, ts: 1700000000 },
        { id: 2, action: 'video.publish', resource: 'video:abc', ts: 1700000100 },
      ],
    });
    const result = await getTenantSummary('t-1');
    expect(result!.recentAudit).toHaveLength(2);
    expect(result!.recentAudit[1].action).toBe('video.publish');
    expect(result!.recentAudit[1].resource).toBe('video:abc');
  });

  it('coerces numeric strings from D1 driver', async () => {
    setD1Mock({
      user: SAMPLE_USER,
      apiKeys: { active: '3' as unknown as number, total: '5' as unknown as number },
      videoJobs: { n: '42' as unknown as number },
    });
    const result = await getTenantSummary('t-1');
    expect(typeof result!.apiKeys.active).toBe('number');
    expect(result!.apiKeys.active).toBe(3);
    expect(result!.videoJobCount).toBe(42);
  });
});
