/**
 * Integration tests for POST/GET /api/learning
 */
import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST, GET } from '../route';

const {
  mockGetCurrentUser,
  mockRunLearningLoop,
  mockGetLatestInsights,
} = vi.hoisted(() => {
  const mockGetCurrentUser = vi.fn();
  const mockRunLearningLoop = vi.fn();
  const mockGetLatestInsights = vi.fn();
  return { mockGetCurrentUser, mockRunLearningLoop, mockGetLatestInsights };
});

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: mockGetCurrentUser,
}));

vi.mock('@/seed/db/client', () => {
  const mockPrepare = vi.fn().mockReturnValue({
    bind: vi.fn().mockReturnThis(),
    first: vi.fn().mockResolvedValue(null),
  });
  const mockD1 = { prepare: mockPrepare };
  return { createServerClient: vi.fn().mockReturnValue(mockD1) };
});

vi.mock('@/tree/learning', () => ({
  runLearningLoop: mockRunLearningLoop,
  getLatestInsights: mockGetLatestInsights,
}));

describe('POST /api/learning', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetCurrentUser.mockResolvedValueOnce(null);
    const res = await POST(
      new NextRequest('http://localhost/api/learning', {
        method: 'POST',
        body: JSON.stringify({ workspaceId: 'ws_1' }),
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    expect(res.status).toBe(401);
  });

  it('returns 400 when missing workspaceId', async () => {
    mockGetCurrentUser.mockResolvedValueOnce({ id: 'user1' } as never);
    const res = await POST(
      new NextRequest('http://localhost/api/learning', {
        method: 'POST',
        body: JSON.stringify({}),
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 on invalid JSON body', async () => {
    mockGetCurrentUser.mockResolvedValueOnce({ id: 'user1' } as never);
    const res = await POST(
      new NextRequest('http://localhost/api/learning', {
        method: 'POST',
        body: 'not-json',
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    expect(res.status).toBe(400);
  });

  it('returns 403 when workspace access denied', async () => {
    mockGetCurrentUser.mockResolvedValueOnce({ id: 'user1' } as never);
    const res = await POST(
      new NextRequest('http://localhost/api/learning', {
        method: 'POST',
        body: JSON.stringify({ workspaceId: 'ws_1' }),
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    expect(res.status).toBe(403);
  });

  it('returns 500 when learning loop fails', async () => {
    mockGetCurrentUser.mockResolvedValueOnce({ id: 'user1' } as never);
    const { createServerClient } = await import('@/seed/db/client');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockClient = createServerClient() as any;
    mockClient.prepare().first.mockResolvedValueOnce({});

    mockRunLearningLoop.mockResolvedValueOnce({
      ok: false,
      error: { message: 'Loop failed' },
    });

    const res = await POST(
      new NextRequest('http://localhost/api/learning', {
        method: 'POST',
        body: JSON.stringify({ workspaceId: 'ws_1' }),
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    expect(res.status).toBe(500);
  });

  it('runs learning loop and returns 200', async () => {
    mockGetCurrentUser.mockResolvedValueOnce({ id: 'user1' } as never);
    const { createServerClient } = await import('@/seed/db/client');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockClient = createServerClient() as any;
    mockClient.prepare().first.mockResolvedValueOnce({});

    mockRunLearningLoop.mockResolvedValueOnce({
      ok: true,
      value: {
        insightsCreated: 3,
        recommendations: ['Post at 6pm', 'Use shorter hooks'],
        summary: 'Audience prefers evening content',
      },
    });

    const res = await POST(
      new NextRequest('http://localhost/api/learning', {
        method: 'POST',
        body: JSON.stringify({ workspaceId: 'ws_1', lookbackDays: 14 }),
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as { insightsCreated: number };
    expect(data.insightsCreated).toBe(3);
  });
});

describe('GET /api/learning', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetCurrentUser.mockResolvedValueOnce(null);
    const res = await GET(new NextRequest('http://localhost/api/learning'));
    expect(res.status).toBe(401);
  });

  it('returns 400 when workspaceId missing', async () => {
    mockGetCurrentUser.mockResolvedValueOnce({ id: 'user1' } as never);
    const res = await GET(new NextRequest('http://localhost/api/learning'));
    expect(res.status).toBe(400);
  });

  it('returns 403 when workspace access denied', async () => {
    mockGetCurrentUser.mockResolvedValueOnce({ id: 'user1' } as never);
    const res = await GET(
      new NextRequest('http://localhost/api/learning?workspaceId=ws_1'),
    );
    expect(res.status).toBe(403);
  });

  it('returns latest insights', async () => {
    mockGetCurrentUser.mockResolvedValueOnce({ id: 'user1' } as never);
    const { createServerClient } = await import('@/seed/db/client');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockClient = createServerClient() as any;
    mockClient.prepare().first.mockResolvedValueOnce({});

    mockGetLatestInsights.mockResolvedValueOnce([
      { id: 'cm_1', category: 'performance', content: 'Video A outperformed', createdAt: 1 },
      { id: 'cm_2', category: 'audience', content: 'Peak at 7pm', createdAt: 2 },
    ]);

    const res = await GET(
      new NextRequest('http://localhost/api/learning?workspaceId=ws_1&limit=10'),
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as { insights: unknown[] };
    expect(data.insights).toHaveLength(2);
  });

  it('applies limit correctly', async () => {
    mockGetCurrentUser.mockResolvedValueOnce({ id: 'user1' } as never);
    const { createServerClient } = await import('@/seed/db/client');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockClient = createServerClient() as any;
    mockClient.prepare().first.mockResolvedValueOnce({});

    mockGetLatestInsights.mockResolvedValueOnce([
      { id: 'cm_1', category: 'creative', content: 'A', createdAt: 1 },
      { id: 'cm_2', category: 'creative', content: 'B', createdAt: 2 },
      { id: 'cm_3', category: 'creative', content: 'C', createdAt: 3 },
    ]);

    const res = await GET(
      new NextRequest('http://localhost/api/learning?workspaceId=ws_1&limit=2'),
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as { insights: unknown[] };
    expect(data.insights).toHaveLength(2);
  });
});
