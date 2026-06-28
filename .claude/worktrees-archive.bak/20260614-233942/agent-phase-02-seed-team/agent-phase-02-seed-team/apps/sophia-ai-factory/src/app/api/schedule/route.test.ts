import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  getD1Client: vi.fn(),
  loggerError: vi.fn(),
}));

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: mocks.getCurrentUser,
}));

vi.mock('@/seed/db/client', () => ({
  getD1Client: mocks.getD1Client,
}));

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: {
    error: mocks.loggerError,
  },
}));

import { DELETE, PATCH, POST } from './route';

function makeJsonRequest(method: string, body: unknown, path = '/api/schedule'): NextRequest {
  return new NextRequest(`https://sophia.agencyos.network${path}`, {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function makeDb(options: { patchRows?: Record<string, unknown>[]; deleteExisting?: Record<string, unknown> | null } = {}) {
  const calls = {
    inserts: [] as Record<string, unknown>[],
    updates: [] as Record<string, unknown>[],
    selects: [] as string[],
    filters: [] as Array<[string, unknown]>,
    deletes: 0,
  };

  const db = {
    from: vi.fn((table: string) => {
      if (table !== 'scheduled_campaigns') throw new Error(`Unexpected table: ${table}`);
      return {
        select: vi.fn((cols: string) => {
          calls.selects.push(cols);
          const chain = {
            eq: vi.fn((col: string, value: unknown) => {
              calls.filters.push([col, value]);
              return chain;
            }),
            maybeSingle: vi.fn(async () => ({
              data: Object.prototype.hasOwnProperty.call(options, 'deleteExisting')
                ? options.deleteExisting
                : { id: 'sched-1' },
              error: null,
            })),
          };
          return chain;
        }),
        insert: vi.fn((payload: Record<string, unknown>) => {
          calls.inserts.push(payload);
          return {
            returning: vi.fn(async () => ({ data: [{ id: 'sched-1', ...payload }], error: null })),
          };
        }),
        update: vi.fn((payload: Record<string, unknown>) => {
          calls.updates.push(payload);
          const chain = {
            eq: vi.fn((col: string, value: unknown) => {
              calls.filters.push([col, value]);
              return chain;
            }),
            returning: vi.fn(async () => ({
              data: options.patchRows ?? [{ id: 'sched-1', ...payload }],
              error: null,
            })),
          };
          return chain;
        }),
        delete: vi.fn(() => {
          calls.deletes += 1;
          const chain = {
            eq: vi.fn((col: string, value: unknown) => {
              calls.filters.push([col, value]);
              return chain;
            }),
            then: (
              onfulfilled: (value: { data: null; error: null }) => unknown,
              onrejected?: (reason: unknown) => unknown,
            ) => Promise.resolve({ data: null, error: null }).then(onfulfilled, onrejected),
          };
          return chain;
        }),
      };
    }),
  };

  return { db, calls };
}

describe('/api/schedule validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentUser.mockResolvedValue({ id: 'user-1' });
  });

  it('normalizes datetime-local input to a date-only next_run_date', async () => {
    const { db, calls } = makeDb();
    mocks.getD1Client.mockResolvedValue(db);

    const res = await POST(makeJsonRequest('POST', {
      topic: 'Weekly media plan',
      interval_days: 7,
      next_run_date: '2026-06-05T10:30',
    }));
    const body = await res.json() as { success: boolean };

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(calls.inserts[0]).toMatchObject({
      user_id: 'user-1',
      topic: 'Weekly media plan',
      interval_days: 7,
      next_run_date: '2026-06-05',
      is_active: 1,
    });
  });

  it('rejects invalid interval and impossible dates', async () => {
    const { db } = makeDb();
    mocks.getD1Client.mockResolvedValue(db);

    const res = await POST(makeJsonRequest('POST', {
      topic: 'Bad schedule',
      interval_days: 0,
      next_run_date: '2026-02-31',
    }));
    const body = await res.json() as { error: string };

    expect(res.status).toBe(400);
    expect(body.error).toBe('Invalid schedule input');
  });

  it('rejects date strings with a valid-looking prefix and trailing garbage', async () => {
    const { db, calls } = makeDb();
    mocks.getD1Client.mockResolvedValue(db);

    const res = await POST(makeJsonRequest('POST', {
      topic: 'Bad date suffix',
      interval_days: 7,
      next_run_date: '2026-06-05not-a-date',
    }));
    const body = await res.json() as { error: string };

    expect(res.status).toBe(400);
    expect(body.error).toBe('Invalid schedule input');
    expect(calls.inserts).toHaveLength(0);
  });

  it('normalizes PATCH next_run_date and scopes update by user', async () => {
    const { db, calls } = makeDb();
    mocks.getD1Client.mockResolvedValue(db);

    const res = await PATCH(makeJsonRequest('PATCH', {
      id: 'sched-1',
      is_active: false,
      next_run_date: '2026-06-08T22:00',
    }));

    expect(res.status).toBe(200);
    expect(calls.updates[0]).toMatchObject({
      is_active: 0,
      next_run_date: '2026-06-08',
    });
    expect(calls.filters).toEqual([
      ['id', 'sched-1'],
      ['user_id', 'user-1'],
    ]);
  });

  it('returns 404 when PATCH matches no current-user schedule', async () => {
    const { db } = makeDb({ patchRows: [] });
    mocks.getD1Client.mockResolvedValue(db);

    const res = await PATCH(makeJsonRequest('PATCH', {
      id: 'missing-sched',
      topic: 'New topic',
    }));
    const body = await res.json() as { error: string };

    expect(res.status).toBe(404);
    expect(body.error).toBe('Not found');
  });

  it('checks ownership before DELETE and returns 404 for missing schedules', async () => {
    const { db, calls } = makeDb({ deleteExisting: null });
    mocks.getD1Client.mockResolvedValue(db);

    const res = await DELETE(new NextRequest('https://sophia.agencyos.network/api/schedule?id=missing-sched', {
      method: 'DELETE',
    }));
    const body = await res.json() as { error: string };

    expect(res.status).toBe(404);
    expect(body.error).toBe('Not found');
    expect(calls.selects).toEqual(['id']);
    expect(calls.filters).toEqual([
      ['id', 'missing-sched'],
      ['user_id', 'user-1'],
    ]);
    expect(calls.deletes).toBe(0);
  });
});
