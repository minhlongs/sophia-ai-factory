import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the D1 client surface — both query-builder and raw prepare access.
vi.mock('@/seed/db/client', () => {
  const buildChain = () => {
    const chain: Record<string, unknown> = {};
    chain.select = vi.fn(() => chain);
    chain.eq = vi.fn(() => chain);
    chain.maybeSingle = vi.fn(() => Promise.resolve({ data: null, error: null }));
    return chain;
  };
  const fromMock = vi.fn(() => buildChain());
  return {
    createServerClient: vi.fn(() => ({ from: fromMock })),
    getD1Raw: vi.fn(),
  };
});

import { createServerClient, getD1Raw } from '@/seed/db/client';
import {
  VIDEO_QUOTA_BY_TIER,
  reserveVideoSlot,
  releaseVideoSlot,
  checkVideoQuota,
} from './video-quota';

type PreparedRow = { count: number };

interface PreparedStub {
  bind: ReturnType<typeof vi.fn>;
  all: ReturnType<typeof vi.fn>;
  run: ReturnType<typeof vi.fn>;
}

function makePrepared(allResults: PreparedRow[]): PreparedStub {
  const stub: PreparedStub = {
    bind: vi.fn(() => stub),
    all: vi.fn(() => Promise.resolve({ results: allResults })),
    run: vi.fn(() => Promise.resolve({})),
  };
  return stub;
}

describe('video-quota: tier table', () => {
  it('exposes the four tier limits we ship in production', () => {
    expect(VIDEO_QUOTA_BY_TIER).toEqual({
      BASIC: 0,
      PREMIUM: 30,
      ENTERPRISE: 200,
      MASTER: 1000,
    });
  });
});

describe('reserveVideoSlot', () => {
  let prepareSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    prepareSpy = vi.fn();
    vi.mocked(getD1Raw).mockResolvedValue({ prepare: prepareSpy } as never);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns reserved=true with the new count when the upsert writes a row', async () => {
    const stub = makePrepared([{ count: 7 }]);
    prepareSpy.mockReturnValue(stub);

    const result = await reserveVideoSlot('user-1', 'PREMIUM');

    expect(result.reserved).toBe(true);
    expect(result.used).toBe(7);
    expect(result.limit).toBe(30);
    expect(stub.bind).toHaveBeenCalledTimes(1);
    const bindArgs = stub.bind.mock.calls[0];
    expect(bindArgs[0]).toBe('user-1');
    expect(bindArgs[3]).toBe(30);
  });

  it('returns reserved=false without writing when the WHERE predicate blocks the update', async () => {
    const stub = makePrepared([]);
    prepareSpy.mockReturnValue(stub);

    // readUsage fallback path — make maybeSingle report the saturated count.
    const fromMock = vi.mocked(createServerClient)().from as ReturnType<typeof vi.fn>;
    fromMock.mockImplementation(() => {
      const chain: Record<string, unknown> = {};
      chain.select = vi.fn(() => chain);
      chain.eq = vi.fn(() => chain);
      chain.maybeSingle = vi.fn(() => Promise.resolve({ data: { count: 30 }, error: null }));
      return chain;
    });

    const result = await reserveVideoSlot('user-1', 'PREMIUM');

    expect(result.reserved).toBe(false);
    expect(result.used).toBe(30);
    expect(result.limit).toBe(30);
  });

  it('skips D1 prepare entirely when tier has zero quota (BASIC)', async () => {
    const fromMock = vi.mocked(createServerClient)().from as ReturnType<typeof vi.fn>;
    fromMock.mockImplementation(() => {
      const chain: Record<string, unknown> = {};
      chain.select = vi.fn(() => chain);
      chain.eq = vi.fn(() => chain);
      chain.maybeSingle = vi.fn(() => Promise.resolve({ data: null, error: null }));
      return chain;
    });

    const result = await reserveVideoSlot('user-1', 'BASIC');

    expect(result.reserved).toBe(false);
    expect(result.limit).toBe(0);
    expect(result.used).toBe(0);
    expect(prepareSpy).not.toHaveBeenCalled();
  });
});

describe('releaseVideoSlot', () => {
  it('issues a guarded UPDATE that floors at zero', async () => {
    const stub = makePrepared([]);
    const prepareSpy = vi.fn<(sql: string) => PreparedStub>(() => stub);
    vi.mocked(getD1Raw).mockResolvedValue({ prepare: prepareSpy } as never);

    await releaseVideoSlot('user-1');

    expect(prepareSpy).toHaveBeenCalledTimes(1);
    const sql = prepareSpy.mock.calls[0][0];
    expect(sql).toMatch(/UPDATE\s+video_usage_monthly/i);
    expect(sql).toMatch(/count\s*=\s*count\s*-\s*1/);
    expect(sql).toMatch(/count\s*>\s*0/);
    expect(stub.run).toHaveBeenCalledTimes(1);
  });
});

describe('checkVideoQuota (read-only)', () => {
  it('reports the existing usage without mutating state', async () => {
    const fromMock = vi.mocked(createServerClient)().from as ReturnType<typeof vi.fn>;
    fromMock.mockImplementation(() => {
      const chain: Record<string, unknown> = {};
      chain.select = vi.fn(() => chain);
      chain.eq = vi.fn(() => chain);
      chain.maybeSingle = vi.fn(() => Promise.resolve({ data: { count: 12 }, error: null }));
      return chain;
    });

    const result = await checkVideoQuota('user-1', 'PREMIUM');

    expect(result.used).toBe(12);
    expect(result.limit).toBe(30);
    expect(result.allowed).toBe(true);
  });
});
