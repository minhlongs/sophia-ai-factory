/**
 * Unit tests: POST /api/v1/missions/[id]/generate-video
 *
 * Covers:
 * 1. happy path → 202 with jobId
 * 2. mission not found → 404
 * 3. mission belongs to different user → 403
 * 4. validation fail (missing prompt) → 400
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ── Hoisted mocks ──────────────────────────────────────────────────────────────

const {
  mockGetCurrentUser,
  mockDbFrom,
  mockInngestSend,
  mockReserveVideoSlot,
  mockReleaseVideoSlot,
  mockResolveUserTier,
} = vi.hoisted(() => ({
  mockGetCurrentUser: vi.fn(),
  mockDbFrom: vi.fn(),
  mockInngestSend: vi.fn(),
  mockReserveVideoSlot: vi.fn(),
  mockReleaseVideoSlot: vi.fn(),
  mockResolveUserTier: vi.fn(),
}));

// ── Module mocks ──────────────────────────────────────────────────────────────

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: mockGetCurrentUser,
}));

vi.mock('@/seed/db/resolve-user-tier', () => ({
  resolveUserTier: mockResolveUserTier,
}));

vi.mock('@/forest/quota/video-quota', () => ({
  reserveVideoSlot: mockReserveVideoSlot,
  releaseVideoSlot: mockReleaseVideoSlot,
}));

vi.mock('@/forest/inngest/client', () => ({
  inngest: { send: mockInngestSend },
}));

vi.mock('@/forest/middleware/rate-limit-wrapper', () => ({
  withRateLimit: (handler: (req: NextRequest) => Promise<Response>) => {
    return (req: NextRequest) => handler(req);
  },
}));

const mockSingle = vi.fn();
const mockEq1 = vi.fn(() => ({ single: mockSingle }));
const mockSelect = vi.fn(() => ({ eq: mockEq1 }));
mockDbFrom.mockReturnValue({ select: mockSelect });

vi.mock('@/seed/db/client', () => ({
  getD1: vi.fn(),
  createServerClient: () => ({ from: mockDbFrom }),
}));

// ── Import SUT ────────────────────────────────────────────────────────────────

import { POST } from './route';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRequest(body: unknown, missionId = 'mission-abc'): NextRequest {
  return new NextRequest(
    `http://localhost/api/v1/missions/${missionId}/generate-video`,
    {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    },
  );
}

async function callPOST(body: unknown, missionId = 'mission-abc') {
  const req = makeRequest(body, missionId);
  const res = await POST(req, { params: Promise.resolve({ id: missionId }) });
  const json = await res.json() as Record<string, unknown>;
  return { status: res.status, json };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('POST /api/v1/missions/[id]/generate-video', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockGetCurrentUser.mockResolvedValue({ id: 'user-123' });

    mockSingle.mockResolvedValue({
      data: { id: 'mission-abc', user_id: 'user-123', status: 'pending' },
      error: null,
    });

    mockResolveUserTier.mockResolvedValue('MASTER');
    mockReserveVideoSlot.mockResolvedValue({
      reserved: true,
      used: 1,
      limit: 1000,
      resetAt: '2026-06-01T00:00:00.000Z',
    });
    mockReleaseVideoSlot.mockResolvedValue(undefined);

    mockInngestSend.mockResolvedValue({ ids: ['inngest-job-001'] });
  });

  it('happy path: returns 202 with jobId', async () => {
    const { status, json } = await callPOST({ prompt: 'A product demo video', language: 'en' });

    expect(status).toBe(202);
    expect(json.jobId).toBe('inngest-job-001');
    expect(json.missionId).toBe('mission-abc');
    expect(json.status).toBe('queued');
    expect(mockInngestSend).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'video/generate.requested',
        data: expect.objectContaining({ missionId: 'mission-abc', userId: 'user-123' }),
      }),
    );
  });

  it('mission not found → 404', async () => {
    mockSingle.mockResolvedValue({ data: null, error: null });

    const { status, json } = await callPOST({ prompt: 'test' }, 'nonexistent');

    expect(status).toBe(404);
    expect(json.error).toMatch(/not found/i);
    expect(mockInngestSend).not.toHaveBeenCalled();
  });

  it('mission belongs to different user → 403', async () => {
    mockSingle.mockResolvedValue({
      data: { id: 'mission-abc', user_id: 'other-user-999', status: 'pending' },
      error: null,
    });

    const { status, json } = await callPOST({ prompt: 'test' });

    expect(status).toBe(403);
    expect(json.error).toMatch(/forbidden/i);
    expect(mockInngestSend).not.toHaveBeenCalled();
  });

  it('validation fail (missing prompt) → 400', async () => {
    const { status, json } = await callPOST({ voiceoverText: 'no prompt here' });

    expect(status).toBe(400);
    expect(json.error).toMatch(/validation failed/i);
    expect(mockInngestSend).not.toHaveBeenCalled();
  });

  it('quota exceeded → 429 + no inngest event', async () => {
    mockReserveVideoSlot.mockResolvedValue({
      reserved: false,
      used: 30,
      limit: 30,
      resetAt: '2026-06-01T00:00:00.000Z',
    });

    const { status, json } = await callPOST({ prompt: 'A product demo video' });

    expect(status).toBe(429);
    expect(json.code).toBe('QUOTA_EXCEEDED');
    expect(mockInngestSend).not.toHaveBeenCalled();
  });
});
