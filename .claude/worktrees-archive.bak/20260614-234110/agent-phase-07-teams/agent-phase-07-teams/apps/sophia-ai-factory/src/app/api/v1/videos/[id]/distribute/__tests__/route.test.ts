/**
 * Unit tests: POST /api/v1/videos/[id]/distribute
 *
 * Covers:
 * 1. unauthenticated → 401
 * 2. Zod validation fail (empty channelProviders) → 422
 * 3. video not found → 404
 * 4. ownership violation (different user_id) → 403
 * 5. channel not connected → 422 with missingProviders
 * 6. D1 insert error → 500
 * 7. happy path: 2 channels → 200 with jobIds
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ── Hoisted mocks ─────────────────────────────────────────────────────────────

const { mockGetCurrentUser, mockSchedulePublish } = vi.hoisted(() => ({
  mockGetCurrentUser: vi.fn(),
  mockSchedulePublish: vi.fn(),
}));

// Mock rate limit wrapper — pass-through
vi.mock('@/forest/middleware/rate-limit-wrapper', () => ({
  withRateLimit: (handler: (req: NextRequest) => Promise<Response>) => {
    return (req: NextRequest) => handler(req);
  },
}));

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUserFromHeaders: mockGetCurrentUser,
}));

vi.mock('@/forest/publishing/schedule-publish', () => ({
  schedulePublish: mockSchedulePublish,
}));

// D1 mock — injected into globalThis.__env.DB
const mockFirst = vi.fn();
const mockBind = vi.fn();
const mockPrepare = vi.fn();
const mockAll = vi.fn();

const fakeD1: D1Database = {
  prepare: mockPrepare,
  dump: vi.fn(),
  batch: vi.fn(),
  exec: vi.fn(),
} as unknown as D1Database;

// Expose D1 via globalThis.__env (same as getD1() helper in route)
(globalThis as unknown as Record<string, unknown>).__env = { DB: fakeD1 };

// ── Import SUT ────────────────────────────────────────────────────────────────
import { POST } from '../route';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRequest(body: unknown, videoId = 'vid-001'): NextRequest {
  return new NextRequest(`http://localhost/api/v1/videos/${videoId}/distribute`, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

async function callPOST(body: unknown, videoId = 'vid-001') {
  const req = makeRequest(body, videoId);
  const res = await POST(req, { params: Promise.resolve({ id: videoId }) });
  const json = await res.json() as Record<string, unknown>;
  return { status: res.status, json };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('POST /api/v1/videos/[id]/distribute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue({ id: 'user-123' });

    // Default D1 chain: .prepare().bind() returns { first, all }
    mockBind.mockReturnValue({ first: mockFirst, all: mockAll });
    mockPrepare.mockReturnValue({ bind: mockBind });

    // Default: video owned by user-123
    mockFirst.mockResolvedValue({ user_id: 'user-123' });

    // Default: 1 active channel returned for provider 'tiktok'
    mockAll.mockResolvedValue({ results: [{ id: 'ch-001', provider: 'tiktok' }] });

    // Default: successful insert
    mockSchedulePublish.mockResolvedValue({ jobId: 'job-001' });
  });

  it('returns 401 when unauthenticated', async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const { status, json } = await callPOST({ channelProviders: ['tiktok'] });
    expect(status).toBe(401);
    expect(json.error).toMatch(/unauthorized/i);
  });

  it('returns 422 on Zod validation fail (empty array)', async () => {
    const { status, json } = await callPOST({ channelProviders: [] });
    expect(status).toBe(422);
    expect(json.error).toMatch(/validation failed/i);
  });

  it('returns 422 on Zod validation fail (unknown provider)', async () => {
    const { status, json } = await callPOST({ channelProviders: ['snapchat'] });
    expect(status).toBe(422);
    expect(json.error).toMatch(/validation failed/i);
  });

  it('returns 404 when video not found', async () => {
    mockFirst.mockResolvedValue(null);
    const { status, json } = await callPOST({ channelProviders: ['tiktok'] }, 'no-such-vid');
    expect(status).toBe(404);
    expect(json.error).toMatch(/not found/i);
  });

  it('returns 403 when video owned by different user', async () => {
    mockFirst.mockResolvedValue({ user_id: 'other-user-999' });
    const { status, json } = await callPOST({ channelProviders: ['tiktok'] });
    expect(status).toBe(403);
    expect(json.error).toMatch(/forbidden/i);
    expect(mockSchedulePublish).not.toHaveBeenCalled();
  });

  it('returns 422 with missingProviders when channel not active', async () => {
    mockAll.mockResolvedValue({ results: [] }); // no active channels
    const { status, json } = await callPOST({ channelProviders: ['tiktok'] });
    expect(status).toBe(422);
    expect(json.missingProviders).toEqual(['tiktok']);
    expect(mockSchedulePublish).not.toHaveBeenCalled();
  });

  it('returns 500 when schedulePublish throws (D1 insert error)', async () => {
    mockSchedulePublish.mockRejectedValue(new Error('D1 insert failed: UNIQUE constraint'));
    const { status, json } = await callPOST({ channelProviders: ['tiktok'] });
    expect(status).toBe(500);
    expect(json.error).toMatch(/failed to schedule/i);
  });

  it('happy path: 2 channels → 200 with 2 jobIds', async () => {
    // Provide 2 active channels
    mockAll.mockResolvedValue({
      results: [
        { id: 'ch-001', provider: 'tiktok' },
        { id: 'ch-002', provider: 'youtube' },
      ],
    });
    mockSchedulePublish
      .mockResolvedValueOnce({ jobId: 'job-001' })
      .mockResolvedValueOnce({ jobId: 'job-002' });

    const { status, json } = await callPOST({
      channelProviders: ['tiktok', 'youtube'],
      caption: 'Test caption',
    });

    expect(status).toBe(200);
    expect(json.jobIds).toEqual(['job-001', 'job-002']);
    expect(mockSchedulePublish).toHaveBeenCalledTimes(2);
    expect(mockSchedulePublish).toHaveBeenCalledWith(
      fakeD1,
      expect.objectContaining({ channelId: 'ch-001', videoId: 'vid-001', caption: 'Test caption' }),
    );
  });

  it('passes caption through to schedulePublish', async () => {
    await callPOST({ channelProviders: ['tiktok'], caption: 'My caption' });
    expect(mockSchedulePublish).toHaveBeenCalledWith(
      fakeD1,
      expect.objectContaining({ caption: 'My caption' }),
    );
  });

  it('passes undefined caption when omitted', async () => {
    await callPOST({ channelProviders: ['tiktok'] });
    expect(mockSchedulePublish).toHaveBeenCalledWith(
      fakeD1,
      expect.objectContaining({ caption: undefined }),
    );
  });
});
