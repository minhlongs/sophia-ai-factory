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

import { DELETE } from './route';

function makeDelete(id: string): NextRequest {
  return new NextRequest(`https://sophia.agencyos.network/api/campaigns?id=${id}`, {
    method: 'DELETE',
  });
}

function makeDb(existing: Record<string, unknown> | null) {
  const calls = {
    selects: [] as string[],
    filters: [] as Array<[string, unknown]>,
    deletes: 0,
  };

  const db = {
    from: vi.fn((table: string) => {
      if (table !== 'campaigns') throw new Error(`Unexpected table: ${table}`);
      return {
        select: vi.fn((cols: string) => {
          calls.selects.push(cols);
          const chain = {
            eq: vi.fn((col: string, value: unknown) => {
              calls.filters.push([col, value]);
              return chain;
            }),
            maybeSingle: vi.fn(async () => ({ data: existing, error: null })),
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

describe('/api/campaigns DELETE', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentUser.mockResolvedValue({ id: 'user-1' });
  });

  it('returns 404 when campaign is not owned by current user', async () => {
    const { db, calls } = makeDb(null);
    mocks.getD1Client.mockResolvedValue(db);

    const res = await DELETE(makeDelete('missing-campaign'));
    const body = await res.json() as { error: string };

    expect(res.status).toBe(404);
    expect(body.error).toBe('Not found');
    expect(calls.selects).toEqual(['id']);
    expect(calls.filters).toEqual([
      ['id', 'missing-campaign'],
      ['user_id', 'user-1'],
    ]);
    expect(calls.deletes).toBe(0);
  });

  it('deletes only after a user-scoped campaign lookup succeeds', async () => {
    const { db, calls } = makeDb({ id: 'campaign-1' });
    mocks.getD1Client.mockResolvedValue(db);

    const res = await DELETE(makeDelete('campaign-1'));
    const body = await res.json() as { success: boolean };

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(calls.filters).toEqual([
      ['id', 'campaign-1'],
      ['user_id', 'user-1'],
      ['id', 'campaign-1'],
      ['user_id', 'user-1'],
    ]);
    expect(calls.deletes).toBe(1);
  });
});
