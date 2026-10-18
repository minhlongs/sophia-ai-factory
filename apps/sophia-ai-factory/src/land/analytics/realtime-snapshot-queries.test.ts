import { afterEach, describe, expect, it, vi } from 'vitest';

const loggerMocks = vi.hoisted(() => ({ warn: vi.fn() }));

vi.mock('@/seed/db/client', () => ({ createServerClient: vi.fn() }));
vi.mock('@/seed/utils/logger-utility', () => ({ logger: loggerMocks }));
vi.mock('@/seed/utils/to-error', () => ({ toError: (value: unknown) => value }));

import {
  queryActiveUsers,
  queryApiCallsLast1h,
  queryCampaignsLast1h,
  queryErrorRateLast1h,
  queryTierDistribution,
} from './realtime-snapshot-queries';

interface QueryResult {
  data: unknown;
  error: unknown;
}

function database(result: QueryResult): Parameters<typeof queryActiveUsers>[0] {
  const query = {
    select: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    then: (resolve: (value: QueryResult) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject),
  };
  const db = { from: vi.fn().mockReturnValue(query) };
  return db as unknown as Parameters<typeof queryActiveUsers>[0];
}

afterEach(() => {
  loggerMocks.warn.mockClear();
  vi.useRealTimers();
});

describe('realtime snapshot query helpers', () => {
  it('counts active user rows within the last 15 minutes', async () => {
    const now = new Date('2025-04-10T12:00:00.000Z').getTime();
    vi.useFakeTimers();
    vi.setSystemTime(now);
    const db = database({ data: [{ id: 'one' }, { id: 'two' }], error: null });

    await expect(queryActiveUsers(db)).resolves.toBe(2);
    expect(db.from).toHaveBeenCalledWith('sessions');
    expect(db.from('sessions').select).toHaveBeenCalledWith('id', { count: 'exact', head: true });
    expect(db.from('sessions').gte).toHaveBeenCalledWith('updated_at', '2025-04-10T11:45:00.000Z');
  });

  it('returns zero and logs active-user query errors or non-array results', async () => {
    const failure = database({ data: null, error: new Error('sessions unavailable') });
    await expect(queryActiveUsers(failure)).resolves.toBe(0);
    expect(loggerMocks.warn).toHaveBeenCalledWith(
      '[Realtime Snapshot] Failed to query active users',
      expect.any(Error),
    );

    const noRows = database({ data: null, error: null });
    await expect(queryActiveUsers(noRows)).resolves.toBe(0);
  });

  it('counts campaign and usage rows in the last hour and returns zero for missing rows', async () => {
    const now = new Date('2025-04-10T12:00:00.000Z').getTime();
    vi.useFakeTimers();
    vi.setSystemTime(now);
    const campaignsDb = database({ data: [{ id: 'c1' }, { id: 'c2' }], error: null });
    const usageDb = database({ data: [{ id: 'u1' }], error: null });
    const emptyDb = database({ data: null, error: null });

    await expect(queryCampaignsLast1h(campaignsDb)).resolves.toBe(2);
    await expect(queryApiCallsLast1h(usageDb)).resolves.toBe(1);
    await expect(queryCampaignsLast1h(emptyDb)).resolves.toBe(0);
    await expect(queryApiCallsLast1h(emptyDb)).resolves.toBe(0);

    expect(campaignsDb.from('campaigns').gte).toHaveBeenCalledWith('created_at', '2025-04-10T11:00:00.000Z');
    expect(usageDb.from('usage_events').gte).toHaveBeenCalledWith('created_at', '2025-04-10T11:00:00.000Z');
  });

  it('logs campaign and API-call query errors and returns zero', async () => {
    const failedDb = database({ data: null, error: new Error('query failed') });

    await expect(queryCampaignsLast1h(failedDb)).resolves.toBe(0);
    await expect(queryApiCallsLast1h(failedDb)).resolves.toBe(0);

    expect(loggerMocks.warn).toHaveBeenCalledWith('[Realtime Snapshot] Failed to query campaigns', expect.any(Error));
    expect(loggerMocks.warn).toHaveBeenCalledWith('[Realtime Snapshot] Failed to query API calls', expect.any(Error));
  });

  it('calculates the rounded error percentage from boolean and numeric flags', async () => {
    const db = database({
      data: [
        { id: '1', is_error: true },
        { id: '2', is_error: 1 },
        { id: '3', is_error: false },
        { id: '4', is_error: 0 },
        { id: '5', is_error: 2 },
        { id: '6', is_error: true },
      ],
      error: null,
    });

    await expect(queryErrorRateLast1h(db)).resolves.toBe(50);
  });

  it('returns zero error rate for failed, null, and empty usage queries', async () => {
    await expect(queryErrorRateLast1h(database({ data: null, error: new Error('unavailable') }))).resolves.toBe(0);
    await expect(queryErrorRateLast1h(database({ data: null, error: null }))).resolves.toBe(0);
    await expect(queryErrorRateLast1h(database({ data: [], error: null }))).resolves.toBe(0);
  });

  it('groups tier rows and falls back to BASIC for null tiers', async () => {
    const db = database({ data: [{ tier: 'PREMIUM' }, { tier: 'PREMIUM' }, { tier: 'MASTER' }, { tier: null }], error: null });

    await expect(queryTierDistribution(db)).resolves.toEqual({ PREMIUM: 2, MASTER: 1, BASIC: 1 });
    expect(db.from).toHaveBeenCalledWith('user_profiles');
    expect(db.from('user_profiles').select).toHaveBeenCalledWith('tier');
  });

  it('returns an empty tier distribution and logs query errors or absent rows', async () => {
    const failure = database({ data: null, error: new Error('profiles unavailable') });
    const absent = database({ data: null, error: null });

    await expect(queryTierDistribution(failure)).resolves.toEqual({});
    await expect(queryTierDistribution(absent)).resolves.toEqual({});
    expect(loggerMocks.warn).toHaveBeenCalledTimes(2);
    expect(loggerMocks.warn).toHaveBeenCalledWith(
      '[Realtime Snapshot] Failed to query tier distribution',
      expect.any(Error),
    );
  });
});
