import { afterEach, describe, expect, it, vi } from 'vitest';

const loggerMocks = vi.hoisted(() => ({ error: vi.fn() }));
vi.mock('@/seed/utils/logger-utility', () => ({ logger: loggerMocks }));

import { currentYYYYMM, getKv, getVideoCount, videoCacheKey } from './quota-enforcer-video-store';

function setGlobal(name: string, value: unknown): void {
  Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
}

function clearGlobal(name: string): void {
  delete (globalThis as Record<string, unknown>)[name];
}

function dbWithCount(count: number | null) {
  const first = vi.fn().mockResolvedValue(count === null ? null : { cnt: count });
  const bind = vi.fn().mockReturnValue({ first });
  const prepare = vi.fn().mockReturnValue({ bind });
  return { db: { prepare } as unknown as D1Database, prepare, bind, first };
}

afterEach(() => {
  clearGlobal('KV_KV');
  clearGlobal('__env');
  clearGlobal('__D1_DB');
  loggerMocks.error.mockClear();
  vi.useRealTimers();
});

describe('video quota store helpers', () => {
  it('returns an available KV binding and null when it is absent', () => {
    expect(getKv()).toBeNull();
    const kv = { get: vi.fn() } as unknown as KVNamespace;
    setGlobal('KV_KV', kv);
    expect(getKv()).toBe(kv);
  });

  it('formats the UTC month partition and video quota key at calendar boundaries', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-01T00:15:00.000Z'));

    expect(currentYYYYMM()).toBe('202501');
    expect(videoCacheKey('tenant/one', currentYYYYMM())).toBe('quota:video:tenant/one:202501');
  });

  it('returns a cached zero count without consulting D1', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-06-15T12:00:00.000Z'));
    const get = vi.fn().mockResolvedValue('0');
    const kv = { get, put: vi.fn().mockResolvedValue(undefined) } as unknown as KVNamespace;
    const { db } = dbWithCount(9);
    setGlobal('KV_KV', kv);
    setGlobal('__env', { DB: db });

    await expect(getVideoCount('tenant-1')).resolves.toBe(0);
    expect(get).toHaveBeenCalledWith('quota:video:tenant-1:202506');
    expect(kv.put).not.toHaveBeenCalled();
  });

  it('falls back to D1 after a cache miss, queries the UTC month start and refreshes KV', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-03-10T18:30:00.000Z'));
    const get = vi.fn().mockResolvedValue(null);
    const put = vi.fn().mockResolvedValue(undefined);
    const kv = { get, put } as unknown as KVNamespace;
    const { db, prepare, bind, first } = dbWithCount(7);
    setGlobal('KV_KV', kv);
    setGlobal('__env', { DB: db });

    await expect(getVideoCount('tenant-2')).resolves.toBe(7);
    expect(prepare).toHaveBeenCalledWith('SELECT COUNT(*) AS cnt FROM video_jobs WHERE tenant_id = ? AND created_at >= ?');
    expect(bind).toHaveBeenCalledWith('tenant-2', Math.floor(Date.UTC(2024, 2, 1) / 1000));
    expect(first).toHaveBeenCalledOnce();
    expect(put).toHaveBeenCalledWith('quota:video:tenant-2:202403', '7', { expirationTtl: 60 });
  });

  it('uses the global D1 fallback and maps a missing count row to zero', async () => {
    const { db, bind } = dbWithCount(null);
    setGlobal('__D1_DB', db);

    await expect(getVideoCount('tenant-3')).resolves.toBe(0);
    expect(bind).toHaveBeenCalledWith('tenant-3', expect.any(Number));
  });

  it('returns zero without a database, including after a cache exception, and tolerates write failures', async () => {
    const get = vi.fn().mockRejectedValue(new Error('cache unavailable'));
    const put = vi.fn().mockRejectedValue(new Error('cache write unavailable'));
    const kv = { get, put } as unknown as KVNamespace;
    setGlobal('KV_KV', kv);

    await expect(getVideoCount('tenant-4')).resolves.toBe(0);
    await Promise.resolve();
    expect(get).toHaveBeenCalledOnce();
    expect(put).toHaveBeenCalledWith(expect.stringMatching(/^quota:video:tenant-4:\d{6}$/), '0', { expirationTtl: 60 });
    expect(loggerMocks.error).not.toHaveBeenCalled();
  });

  it('logs D1 errors, returns zero, and still refreshes an available cache', async () => {
    const first = vi.fn().mockRejectedValue(new Error('database unavailable'));
    const bind = vi.fn().mockReturnValue({ first });
    const db = { prepare: vi.fn().mockReturnValue({ bind }) } as unknown as D1Database;
    const put = vi.fn().mockResolvedValue(undefined);
    setGlobal('__env', { DB: db });
    setGlobal('KV_KV', { get: vi.fn().mockResolvedValue(null), put } as unknown as KVNamespace);

    await expect(getVideoCount('tenant-5')).resolves.toBe(0);
    expect(loggerMocks.error).toHaveBeenCalledWith('[VideoQuota] DB read error', expect.objectContaining({ tenantId: 'tenant-5' }));
    expect(put).toHaveBeenCalledWith(expect.stringMatching(/^quota:video:tenant-5:\d{6}$/), '0', { expirationTtl: 60 });
  });
});
