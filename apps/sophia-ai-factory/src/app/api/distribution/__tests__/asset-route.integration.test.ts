/**
 * Integration tests for POST/GET /api/distribution/asset
 */
import { describe, it, expect, vi } from 'vitest';
import { POST, GET } from '../asset/route';

const {
  mockGetCurrentUser,
  mockCreateDistributionAsset,
  mockListDistributionAssets,
} = vi.hoisted(() => {
  const mockGetCurrentUser = vi.fn();
  const mockCreateDistributionAsset = vi.fn();
  const mockListDistributionAssets = vi.fn();
  return { mockGetCurrentUser, mockCreateDistributionAsset, mockListDistributionAssets };
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

vi.mock('@/tree/distribution', () => ({
  createDistributionAsset: mockCreateDistributionAsset,
  listDistributionAssets: mockListDistributionAssets,
}));

describe('POST /api/distribution/asset', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetCurrentUser.mockResolvedValueOnce(null);
    const res = await POST(
      new Request('http://localhost/api/distribution/asset', {
        method: 'POST',
        body: JSON.stringify({}),
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    expect(res.status).toBe(401);
  });

  it('returns 400 when missing required fields', async () => {
    mockGetCurrentUser.mockResolvedValueOnce({ id: 'user1' } as never);
    const res = await POST(
      new Request('http://localhost/api/distribution/asset', {
        method: 'POST',
        body: JSON.stringify({ workspaceId: 'ws_1' }),
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    expect(res.status).toBe(400);
  });

  it('returns 403 when workspace access denied', async () => {
    mockGetCurrentUser.mockResolvedValueOnce({ id: 'user1' } as never);
    const res = await POST(
      new Request('http://localhost/api/distribution/asset', {
        method: 'POST',
        body: JSON.stringify({
          workspaceId: 'ws_1', planId: 'p1', platform: 'youtube', assetUrl: 'https://example.com/a.mp4',
        }),
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    expect(res.status).toBe(403);
  });

  it('creates asset and returns 201', async () => {
    mockGetCurrentUser.mockResolvedValueOnce({ id: 'user1' } as never);
    const { createServerClient } = await import('@/seed/db/client');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockClient = createServerClient() as any;
    mockClient.prepare().first.mockResolvedValueOnce({});

    mockCreateDistributionAsset.mockResolvedValueOnce({
      id: 'dast_1', workspaceId: 'ws_1', planId: 'p1',
      assetId: 'https://example.com/a.mp4', channel: 'youtube',
      platformPostId: undefined, status: 'draft', scheduledAt: 1000,
      postedAt: undefined, analytics: {}, error: undefined, createdAt: 1000,
    });

    const res = await POST(
      new Request('http://localhost/api/distribution/asset', {
        method: 'POST',
        body: JSON.stringify({
          workspaceId: 'ws_1', planId: 'p1', platform: 'youtube', assetUrl: 'https://example.com/a.mp4',
        }),
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    expect(res.status).toBe(201);
    const data = (await res.json()) as { asset: { channel: string } };
    expect(data.asset.channel).toBe('youtube');
  });
});

describe('GET /api/distribution/asset', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetCurrentUser.mockResolvedValueOnce(null);
    const res = await GET(new Request('http://localhost/api/distribution/asset'));
    expect(res.status).toBe(401);
  });

  it('returns 400 when workspaceId missing', async () => {
    mockGetCurrentUser.mockResolvedValueOnce({ id: 'user1' } as never);
    const res = await GET(new Request('http://localhost/api/distribution/asset'));
    expect(res.status).toBe(400);
  });

  it('returns 403 when workspace access denied', async () => {
    mockGetCurrentUser.mockResolvedValueOnce({ id: 'user1' } as never);
    const res = await GET(
      new Request('http://localhost/api/distribution/asset?workspaceId=ws_1'),
    );
    expect(res.status).toBe(403);
  });

  it('returns filtered asset list', async () => {
    mockGetCurrentUser.mockResolvedValueOnce({ id: 'user1' } as never);
    const { createServerClient } = await import('@/seed/db/client');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockClient = createServerClient() as any;
    mockClient.prepare().first.mockResolvedValueOnce({});

    mockListDistributionAssets.mockResolvedValueOnce([
      {
        id: 'dast_1', workspaceId: 'ws_1', planId: 'p1',
        assetId: 'url1', channel: 'youtube', platformPostId: undefined,
        status: 'draft', scheduledAt: 1, postedAt: undefined,
        analytics: {}, error: undefined, createdAt: 1,
      },
      {
        id: 'dast_2', workspaceId: 'ws_1', planId: 'p1',
        assetId: 'url2', channel: 'tiktok', platformPostId: undefined,
        status: 'draft', scheduledAt: 1, postedAt: undefined,
        analytics: {}, error: undefined, createdAt: 1,
      },
    ]);

    const res = await GET(
      new Request('http://localhost/api/distribution/asset?workspaceId=ws_1&platform=youtube'),
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as { assets: { channel: string }[] };
    expect(data.assets).toHaveLength(1);
    expect(data.assets[0].channel).toBe('youtube');
  });
});
