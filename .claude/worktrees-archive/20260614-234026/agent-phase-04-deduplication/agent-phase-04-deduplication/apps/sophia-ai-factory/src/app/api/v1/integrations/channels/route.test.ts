import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

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

const mockAll = vi.fn();
const mockFirst = vi.fn();
const mockBind = vi.fn();
const mockPrepare = vi.fn();

const fakeD1: D1Database = {
  prepare: mockPrepare,
  dump: vi.fn(),
  batch: vi.fn(),
  exec: vi.fn(),
} as unknown as D1Database;

(globalThis as unknown as Record<string, unknown>).__env = { DB: fakeD1 };

import { GET } from './route';

async function callGET() {
  const req = new NextRequest('http://localhost/api/v1/integrations/channels');
  const res = await GET(req);
  const json = await res.json() as Record<string, unknown>;
  return { status: res.status, json };
}

describe('GET /api/v1/integrations/channels', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue({ id: 'user-1' });
    mockBind.mockReturnValue({ all: mockAll, first: mockFirst });
    mockPrepare.mockReturnValue({ bind: mockBind });
    mockAll.mockResolvedValue({ results: [] });
    mockFirst.mockResolvedValue(null);
  });

  it('returns 401 without a user', async () => {
    mockGetCurrentUser.mockResolvedValue(null);

    const { status, json } = await callGET();

    expect(status).toBe(401);
    expect(json.error).toBe('Unauthorized');
  });

  it('lists all distribution providers including telegram', async () => {
    mockAll.mockResolvedValue({
      results: [
        { provider: 'youtube', display_name: 'Main channel', status: 'active' },
        { provider: 'reddit', display_name: 'Subreddit', status: 'expired' },
      ],
    });
    mockFirst.mockResolvedValue({ first_name: 'Sophia Telegram' });

    const { status, json } = await callGET();

    expect(status).toBe(200);
    const channels = json.channels as Array<Record<string, unknown>>;
    expect(channels.map((c) => c.provider)).toEqual([
      'youtube',
      'tiktok',
      'instagram',
      'pinterest',
      'linkedin',
      'zalo',
      'facebook',
      'twitter',
      'threads',
      'reddit',
      'bluesky',
      'mastodon',
      'telegram',
    ]);
    expect(channels.find((c) => c.provider === 'youtube')?.connected).toBe(true);
    expect(channels.find((c) => c.provider === 'reddit')?.connected).toBe(false);
    expect(channels.find((c) => c.provider === 'telegram')?.connected).toBe(true);
  });

  it('prefers active rows when multiple rows exist for the same provider', async () => {
    mockAll.mockResolvedValue({
      results: [
        { provider: 'youtube', display_name: 'Old', status: 'expired' },
        { provider: 'youtube', display_name: 'Fresh', status: 'active' },
      ],
    });

    const { json } = await callGET();

    const channels = json.channels as Array<Record<string, unknown>>;
    expect(channels.find((c) => c.provider === 'youtube')).toMatchObject({
      connected: true,
      display_name: 'Fresh',
      status: 'active',
    });
  });
});
