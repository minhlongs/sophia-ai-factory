/**
 * Unit tests for /api/social/publish route.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: vi.fn(),
}));
vi.mock('@/seed/db/client', () => ({
  getD1: vi.fn(),
}));
vi.mock('@/forest/publishing/rnn-scheduler', () => ({
  getRnnScheduler: vi.fn(() => ({
    getOptimalPublishTime: vi.fn(async () => ({
      time: new Date(Date.now() + 3600000),
      confidence: 0.7,
      source: 'rnn' as const,
    })),
  })),
}));

const { getCurrentUser } = await import('@/seed/auth/better-auth-session');
const { getD1 } = await import('@/seed/db/client');
const { POST } = await import('@/app/api/social/publish/route');

describe('POST /api/social/publish', () => {
  const mockDb = {
    prepare: vi.fn(() => ({
      bind: vi.fn().mockReturnThis(),
      run: vi.fn().mockResolvedValue({ meta: { last_insert_rowid: 1 } }),
    })),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (getCurrentUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'user-1' });
    (getD1 as ReturnType<typeof vi.fn>).mockReturnValue(mockDb as unknown as D1Database);
  });

  it('returns 401 when not authenticated', async () => {
    (getCurrentUser as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const req = new Request('http://localhost/api/social/publish', {
      method: 'POST',
      body: JSON.stringify({ provider: 'youtube', contentTitle: 'Test' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('returns 400 for invalid body', async () => {
    (getCurrentUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'user-1' });
    const req = new Request('http://localhost/api/social/publish', {
      method: 'POST',
      body: JSON.stringify({ provider: 'invalid', contentTitle: '' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('creates a publish event (201)', async () => {
    const req = new Request('http://localhost/api/social/publish', {
      method: 'POST',
      body: JSON.stringify({ provider: 'youtube', contentTitle: 'My Video' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const data = (await res.json()) as { ok: boolean; eventId: unknown };
    expect(data.ok).toBe(true);
    expect(data.eventId).toBeDefined();
  });

  it('accepts explicit scheduledAt', async () => {
    const scheduledAt = Math.floor(Date.now() / 1000) + 7200;
    const req = new Request('http://localhost/api/social/publish', {
      method: 'POST',
      body: JSON.stringify({
        provider: 'tiktok',
        contentTitle: 'Scheduled Post',
        scheduledAt,
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
  });

  it('rejects invalid provider enum', async () => {
    const req = new Request('http://localhost/api/social/publish', {
      method: 'POST',
      body: JSON.stringify({ provider: 'snapchat', contentTitle: 'Test' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 503 when DB is unavailable', async () => {
    (getD1 as ReturnType<typeof vi.fn>).mockReturnValue(null);
    const req = new Request('http://localhost/api/social/publish', {
      method: 'POST',
      body: JSON.stringify({ provider: 'youtube', contentTitle: 'Test' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(503);
  });
});
