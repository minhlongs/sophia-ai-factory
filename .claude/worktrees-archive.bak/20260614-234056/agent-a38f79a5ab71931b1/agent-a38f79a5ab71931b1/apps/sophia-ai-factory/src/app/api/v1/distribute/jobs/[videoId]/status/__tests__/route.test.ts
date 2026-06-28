/**
 * Unit tests: GET /api/v1/distribute/jobs/[videoId]/status
 *
 * Covers:
 * 1. 401 when no auth session
 * 2. 200 returns only current user's own jobs (cross-user filter)
 * 3. 200 empty array when user has no jobs for videoId
 * 4. 400 invalid videoId (not a UUID)
 * 5. last_error sanitization removes Bearer token
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ── Hoisted mocks ─────────────────────────────────────────────────────────────

const { mockGetCurrentUser } = vi.hoisted(() => ({
  mockGetCurrentUser: vi.fn(),
}));

vi.mock('@/forest/middleware/rate-limit-wrapper', () => ({
  withRateLimit: (handler: (req: NextRequest) => Promise<Response>) => {
    return (req: NextRequest) => handler(req);
  },
}));

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUserFromHeaders: mockGetCurrentUser,
}));

// D1 mock — injected via globalThis.__env.DB (same pattern as distribute/route.test.ts)
const mockFirst = vi.fn();
const mockAll = vi.fn();
const mockBind = vi.fn();
const mockPrepare = vi.fn();

const fakeD1: D1Database = {
  prepare: mockPrepare,
  dump: vi.fn(),
  batch: vi.fn(),
  exec: vi.fn(),
} as unknown as D1Database;

(globalThis as unknown as Record<string, unknown>).__env = { DB: fakeD1 };

// ── Import SUT (after globalThis.__env is set) ────────────────────────────────
import { GET } from '../route';

// ── Helpers ───────────────────────────────────────────────────────────────────

const VALID_VIDEO_UUID = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';
const USER_ID = 'user-abc';

function makeRequest(videoId: string): NextRequest {
  return new NextRequest(
    `http://localhost/api/v1/distribute/jobs/${videoId}/status`,
    { method: 'GET' },
  );
}

async function callGET(videoId: string) {
  const req = makeRequest(videoId);
  const res = await GET(req, { params: Promise.resolve({ videoId }) });
  const json = await res.json() as Record<string, unknown>;
  return { status: res.status, json };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('GET /api/v1/distribute/jobs/[videoId]/status', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Wire D1 chain: prepare → bind → { first, all }
    mockBind.mockReturnValue({ first: mockFirst, all: mockAll });
    mockPrepare.mockReturnValue({ bind: mockBind });

    // Default: current user owns the video
    mockGetCurrentUser.mockResolvedValue({ id: USER_ID });
    mockFirst.mockResolvedValue({ user_id: USER_ID });

    // Default: empty jobs
    mockAll.mockResolvedValue({ results: [] });
  });

  it('Case 1: returns 401 when no auth session', async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const { status, json } = await callGET(VALID_VIDEO_UUID);
    expect(status).toBe(401);
    expect(json.error).toBe('Unauthorized');
  });

  it('Case 2: returns only current user jobs (cross-user filter)', async () => {
    const ownJob = {
      id: 'job-1',
      channel_id: 'chan-1',
      provider: 'youtube',
      status: 'live',
      retry_count: 1,
      error: null,
      updated_at: 1234567890,
    };
    mockAll.mockResolvedValue({ results: [ownJob] });

    const { status, json } = await callGET(VALID_VIDEO_UUID);

    expect(status).toBe(200);
    const jobs = json.jobs as Array<Record<string, unknown>>;
    expect(jobs).toHaveLength(1);
    expect(jobs[0].channelId).toBe('chan-1');
    expect(jobs[0].provider).toBe('youtube');
    // Verify user.id was bound in the query
    const allBindCalls = mockBind.mock.calls.flat();
    expect(allBindCalls).toContain(USER_ID);
  });

  it('Case 3: returns 200 with empty jobs when user has no jobs for videoId', async () => {
    mockAll.mockResolvedValue({ results: [] });

    const { status, json } = await callGET(VALID_VIDEO_UUID);

    expect(status).toBe(200);
    expect((json.jobs as unknown[]).length).toBe(0);
  });

  it('Case 4: returns 400 for non-UUID videoId', async () => {
    const { status, json } = await callGET('not-a-uuid');
    expect(status).toBe(400);
    expect(String(json.error)).toMatch(/UUID/i);
  });

  it('Case 5: sanitizes Bearer token from last_error', async () => {
    const jobWithToken = {
      id: 'job-2',
      channel_id: 'chan-2',
      provider: 'tiktok',
      status: 'failed',
      retry_count: 3,
      error: 'HTTP 401 with Authorization: Bearer eyJhbGciOiJSUzI1NiJ9.secret',
      updated_at: 1234567890,
    };
    mockAll.mockResolvedValue({ results: [jobWithToken] });

    const { status, json } = await callGET(VALID_VIDEO_UUID);

    expect(status).toBe(200);
    const jobs = json.jobs as Array<Record<string, unknown>>;
    expect(jobs[0].lastError).not.toContain('eyJhbGciOiJSUzI1NiJ9.secret');
    expect(String(jobs[0].lastError)).toContain('[REDACTED]');
  });
});
