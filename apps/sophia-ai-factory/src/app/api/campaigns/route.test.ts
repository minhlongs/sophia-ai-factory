import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const CSRF = 'test-csrf-token';
const csrfHeaders = { 'x-csrf-token': CSRF, cookie: `csrf-token=${CSRF}` };

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  createServerClient: vi.fn(),
  loggerError: vi.fn(),
}));

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: mocks.getCurrentUser,
}));

vi.mock('@/seed/db/client', () => ({
  getD1: vi.fn(),
  createServerClient: mocks.createServerClient,
}));

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: {
    error: mocks.loggerError,
  },
}));

import { GET, DELETE } from './route';

function makeDelete(id: string): NextRequest {
  return new NextRequest(`https://sophia-ai-factory.agencyos-openclaw.workers.dev/api/campaigns?id=${id}`, {
    method: 'DELETE',
    headers: csrfHeaders,
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
            single: vi.fn(async () => ({ data: existing, error: existing ? null : { message: 'Not found' } })),
            order: vi.fn(async () => ({ data: existing ? [existing] : [], error: null })),
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
    mocks.createServerClient.mockReturnValue(db);

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
    mocks.createServerClient.mockReturnValue(db);

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

describe('/api/campaigns GET ownership controls', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('denies unauthenticated GET with HTTP 401', async () => {
    mocks.getCurrentUser.mockResolvedValue(null);
    const req = new NextRequest('https://sophia-ai-factory.agencyos-openclaw.workers.dev/api/campaigns');
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('lists only the authenticated user campaigns', async () => {
    mocks.getCurrentUser.mockResolvedValue({ id: 'user-a' });
    const { db, calls } = makeDb({ id: 'camp-a', user_id: 'user-a', title: 'Campaign A' });
    mocks.createServerClient.mockReturnValue(db);

    const req = new NextRequest('https://sophia-ai-factory.agencyos-openclaw.workers.dev/api/campaigns');
    const res = await GET(req);
    const body = (await res.json()) as { campaigns: Array<{ id: string }> };

    expect(res.status).toBe(200);
    expect(body.campaigns).toHaveLength(1);
    expect(body.campaigns[0].id).toBe('camp-a');
    expect(calls.filters).toEqual([['user_id', 'user-a']]);
  });

  it('allows reading own campaign by ID and denies cross-user campaign read with 404 and zero data leak', async () => {
    mocks.getCurrentUser.mockResolvedValue({ id: 'user-a' });

    const own = makeDb({ id: 'camp-a', user_id: 'user-a' });
    mocks.createServerClient.mockReturnValue(own.db);
    const resOwn = await GET(new NextRequest('https://sophia-ai-factory.agencyos-openclaw.workers.dev/api/campaigns?id=camp-a'));
    expect(resOwn.status).toBe(200);

    const cross = makeDb(null);
    mocks.createServerClient.mockReturnValue(cross.db);
    const resCross = await GET(new NextRequest('https://sophia-ai-factory.agencyos-openclaw.workers.dev/api/campaigns?id=camp-b'));
    const crossBody = (await resCross.json()) as { error: string; campaigns?: unknown };
    expect(resCross.status).toBe(404);
    expect(crossBody.error).toBe('Not found');
    expect(crossBody.campaigns).toBeUndefined();
    expect(cross.calls.filters).toEqual([
      ['id', 'camp-b'],
      ['user_id', 'user-a'],
    ]);
  });
});
