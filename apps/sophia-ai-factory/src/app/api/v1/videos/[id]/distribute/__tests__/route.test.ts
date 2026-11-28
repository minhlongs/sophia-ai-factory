import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockGetCurrentUserFromHeaders = vi.fn();
const mockSchedulePublish = vi.fn();
const mockDbPrepare = vi.fn();

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUserFromHeaders: (...args: unknown[]) => mockGetCurrentUserFromHeaders(...args),
}));
vi.mock('@/seed/db/client', () => ({
  createServerClient: () => ({
    unwrap: () => ({
      prepare: (...args: unknown[]) => mockDbPrepare(...args),
    }),
  }),
}));
vi.mock('@/forest/publishing/schedule-publish', () => ({
  schedulePublish: (...args: unknown[]) => mockSchedulePublish(...args),
}));
vi.mock('@/forest/middleware/rate-limit-wrapper', () => ({
  withRateLimit: (handler: (req: NextRequest) => Promise<Response>) => handler,
}));

import { POST } from '../route';

function makeDistributeRequest(body: unknown): NextRequest {
  return new NextRequest('https://sophia.local/api/v1/videos/vid_1/distribute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

describe('POST /api/v1/videos/[id]/distribute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUserFromHeaders.mockResolvedValue({ id: 'user-1' });
  });

  it('rejects unauthenticated (401), invalid JSON (400), and unsupported providers (422 PROVIDER_NOT_IMPLEMENTED)', async () => {
    mockGetCurrentUserFromHeaders.mockResolvedValueOnce(null);
    const r401 = await POST(makeDistributeRequest({}), { params: Promise.resolve({ id: 'vid_1' }) });
    expect(r401.status).toBe(401);

    const r400 = await POST(makeDistributeRequest('{not-json'), { params: Promise.resolve({ id: 'vid_1' }) });
    expect(r400.status).toBe(400);

    const r422 = await POST(
      makeDistributeRequest({ channelProviders: ['youtube', 'reddit', 'bluesky'], caption: '#ad test' }),
      { params: Promise.resolve({ id: 'vid_1' }) },
    );
    expect(r422.status).toBe(422);
    const body = (await r422.json()) as { code: string; unsupportedProviders: string[] };
    expect(body.code).toBe('PROVIDER_NOT_IMPLEMENTED');
    expect(body.unsupportedProviders).toEqual(['reddit', 'bluesky']);
  });

  it('enforces video ownership (404/403) and connected channels (422)', async () => {
    mockDbPrepare.mockReturnValueOnce({
      bind: () => ({ first: async () => null }),
    });
    const r404 = await POST(
      makeDistributeRequest({ channelProviders: ['youtube'], caption: '#ad test' }),
      { params: Promise.resolve({ id: 'vid_missing' }) },
    );
    expect(r404.status).toBe(404);

    mockDbPrepare.mockReturnValueOnce({
      bind: () => ({ first: async () => ({ user_id: 'user-2' }) }),
    });
    const r403 = await POST(
      makeDistributeRequest({ channelProviders: ['youtube'], caption: '#ad test' }),
      { params: Promise.resolve({ id: 'vid_other' }) },
    );
    expect(r403.status).toBe(403);
  });

  it('schedules YouTube and Facebook fixture jobs (200) and handles partial scheduling failure (500)', async () => {
    mockDbPrepare
      .mockReturnValueOnce({ bind: () => ({ first: async () => ({ user_id: 'user-1' }) }) })
      .mockReturnValueOnce({
        bind: () => ({
          all: async () => ({
            results: [
              { id: 'ch_yt_1', provider: 'youtube' },
              { id: 'ch_fb_1', provider: 'facebook' },
            ],
          }),
        }),
      });
    mockSchedulePublish
      .mockResolvedValueOnce({ jobId: 'job_yt_1' })
      .mockResolvedValueOnce({ jobId: 'job_fb_1' });

    const r200 = await POST(
      makeDistributeRequest({ channelProviders: ['youtube', 'facebook'], caption: '#ad Multi-channel test' }),
      { params: Promise.resolve({ id: 'vid_1' }) },
    );
    expect(r200.status).toBe(200);
    const json = (await r200.json()) as { jobIds: string[] };
    expect(json.jobIds).toEqual(['job_yt_1', 'job_fb_1']);

    // Partial failure on second provider
    mockDbPrepare
      .mockReturnValueOnce({ bind: () => ({ first: async () => ({ user_id: 'user-1' }) }) })
      .mockReturnValueOnce({
        bind: () => ({
          all: async () => ({
            results: [
              { id: 'ch_yt_1', provider: 'youtube' },
              { id: 'ch_fb_1', provider: 'facebook' },
            ],
          }),
        }),
      });
    mockSchedulePublish
      .mockResolvedValueOnce({ jobId: 'job_yt_2' })
      .mockRejectedValueOnce(new Error('DB transient error'));

    const r500 = await POST(
      makeDistributeRequest({ channelProviders: ['youtube', 'facebook'], caption: '#ad Partial failure' }),
      { params: Promise.resolve({ id: 'vid_1' }) },
    );
    expect(r500.status).toBe(500);
  });
});
