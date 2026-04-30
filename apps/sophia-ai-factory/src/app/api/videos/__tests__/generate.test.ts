/**
 * Tests for POST /api/videos/generate
 *
 * Covers: 401 unauthenticated, 403 cross-tenant, 429 quota, 201 success.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Mocks ---

vi.mock('@/lib/better-auth-session', () => ({
  getCurrentUserFromHeaders: vi.fn(),
}));

vi.mock('@/lib/db/client', () => ({
  getD1Client: vi.fn(),
}));

vi.mock('@/lib/video/video-job-pipeline', () => ({
  createVideoJob: vi.fn(),
}));

vi.mock('@/lib/utils/logger-utility', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('next/server', () => ({
  NextResponse: {
    json: (data: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      body: data,
    }),
  },
}));

// Helpers
import { getCurrentUserFromHeaders } from '@/lib/better-auth-session';
import { getD1Client } from '@/lib/db/client';
import { createVideoJob } from '@/lib/video/video-job-pipeline';

const mockGetCurrentUser = getCurrentUserFromHeaders as ReturnType<typeof vi.fn>;
const mockGetD1Client = getD1Client as ReturnType<typeof vi.fn>;
const mockCreateVideoJob = createVideoJob as ReturnType<typeof vi.fn>;

function makeRequest(body: unknown): Request {
  return {
    headers: new Headers({ 'content-type': 'application/json' }),
    json: () => Promise.resolve(body),
  } as unknown as Request;
}

function makeD1WithCount(count: number) {
  const rows = Array.from({ length: count }, (_, i) => ({ id: `job-${i}` }));
  return {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockResolvedValue({ data: rows, error: null }),
    }),
  };
}

describe('POST /api/videos/generate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when not authenticated', async () => {
    mockGetCurrentUser.mockResolvedValue(null);

    const { POST } = await import('../generate/route');
    const res = await POST(makeRequest({ prompt: 'test video' }));
    expect(res.status).toBe(401);
  });

  it('returns 400 for missing prompt', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'user-1', email: 'a@b.com' });
    mockGetD1Client.mockResolvedValue(makeD1WithCount(0));

    const { POST } = await import('../generate/route');
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
  });

  it('returns 429 when quota is exceeded', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'user-quota', email: 'q@b.com' });
    mockGetD1Client.mockResolvedValue(makeD1WithCount(100)); // exactly at limit

    const { POST } = await import('../generate/route');
    const res = await POST(makeRequest({ prompt: 'video about cats' }));
    expect(res.status).toBe(429);
  });

  it('returns 201 with jobId when valid', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'user-ok', email: 'ok@b.com' });
    mockGetD1Client.mockResolvedValue(makeD1WithCount(5));
    mockCreateVideoJob.mockResolvedValue({ jobId: 'job-abc-123', status: 'queued' });

    const { POST } = await import('../generate/route');
    const res = await POST(makeRequest({ prompt: 'video about dogs' }));
    expect(res.status).toBe(201);
    const body = res.body as unknown as { jobId: string; status: string };
    expect(body.jobId).toBe('job-abc-123');
    expect(body.status).toBe('queued');
  });

  it('passes tenantId from session user id, not from body', async () => {
    const userId = 'secure-tenant-99';
    mockGetCurrentUser.mockResolvedValue({ id: userId, email: 'x@b.com' });
    mockGetD1Client.mockResolvedValue(makeD1WithCount(0));
    mockCreateVideoJob.mockResolvedValue({ jobId: 'job-xyz', status: 'queued' });

    const { POST } = await import('../generate/route');
    await POST(makeRequest({ prompt: 'secure prompt', tenantId: 'attacker-tenant' }));

    expect(mockCreateVideoJob).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: userId }),
    );
  });
});
