/**
 * Tenancy scoping on the image job status route.
 *
 * The row is read under `.eq('user_id', user.id)`; the write-back that follows
 * must carry the same predicate so it cannot reach a row the read refused.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockMaybeSingle, mockUpdatePredicate, mockUpdate, mockGetJobStatus, mockResolveUserApiKey } =
  vi.hoisted(() => ({
    mockMaybeSingle: vi.fn(),
    mockUpdatePredicate: vi.fn(),
    mockUpdate: vi.fn(),
    mockGetJobStatus: vi.fn(),
    mockResolveUserApiKey: vi.fn(),
  }));

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock('@/tree/byok/resolve-user-api-key', () => ({
  resolveUserApiKey: mockResolveUserApiKey,
}));

vi.mock('@/tree/clients/muapi-media-client', () => ({
  getJobStatus: mockGetJobStatus,
}));

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/seed/db/client', () => ({
  createServerClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({ maybeSingle: mockMaybeSingle }),
        }),
      }),
      update: mockUpdate,
    }),
  }),
}));

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { GET } from '../route';

const JOB_ID = 'job-owned-by-user-1';
const USER_ID = 'user-1';

function invoke(): Promise<Response> {
  const request = new NextRequest(
    `http://localhost/api/v1/creative-studio/images/${JOB_ID}/status`,
  );
  return GET(request, { params: Promise.resolve({ id: JOB_ID }) });
}

function pendingRow(overrides: Record<string, unknown> = {}) {
  return {
    id: JOB_ID,
    status: 'pending',
    result_url: null,
    thumbnail_url: null,
    provider: 'muapi',
    ...overrides,
  };
}

describe('image job status route tenancy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCurrentUser).mockResolvedValue({ id: USER_ID, email: 'ceo@example.com' } as never);
    mockResolveUserApiKey.mockResolvedValue('customer_byok_muapi_key');

    // update(payload) → eq(column, value) → eq(column, value) → awaited.
    // Both predicates append to the same call log, so their order is observable.
    mockUpdatePredicate.mockImplementation(() => ({
      eq: mockUpdatePredicate,
      then: (resolve: (value: { error: null }) => unknown) =>
        Promise.resolve({ error: null }).then(resolve),
    }));
    mockUpdate.mockReturnValue({ eq: mockUpdatePredicate });
  });

  it('scopes the write-back to the owning user, matching the read predicate', async () => {
    mockMaybeSingle.mockResolvedValue({ data: pendingRow(), error: null });
    mockGetJobStatus.mockResolvedValue({
      success: true,
      job: { status: 'completed', resultUrl: 'https://cdn.example.com/a.png', thumbnailUrl: null },
    });

    const res = await invoke();

    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledTimes(1);

    // First predicate narrows by row id; the second repeats ownership.
    expect(mockUpdatePredicate).toHaveBeenNthCalledWith(1, 'id', JOB_ID);
    expect(mockUpdatePredicate).toHaveBeenNthCalledWith(2, 'user_id', USER_ID);
  });

  it('writes nothing when the job is not owned by the caller', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });

    const res = await invoke();

    expect(res.status).toBe(404);
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockGetJobStatus).not.toHaveBeenCalled();
  });

  it('writes nothing when the customer has no MuAPI BYOK key', async () => {
    mockMaybeSingle.mockResolvedValue({ data: pendingRow(), error: null });
    mockResolveUserApiKey.mockResolvedValue(null);

    const res = await invoke();
    const body = (await res.json()) as { status: string };

    expect(res.status).toBe(200);
    expect(body.status).toBe('pending');
    expect(mockGetJobStatus).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('returns the cached fal-ai row without polling or writing', async () => {
    mockMaybeSingle.mockResolvedValue({
      data: pendingRow({ provider: 'fal-ai', status: 'completed', result_url: 'https://cdn/a.png' }),
      error: null,
    });

    const res = await invoke();
    const body = (await res.json()) as { status: string; resultUrl: string };

    expect(res.status).toBe(200);
    expect(body.status).toBe('completed');
    expect(body.resultUrl).toBe('https://cdn/a.png');
    expect(mockResolveUserApiKey).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
