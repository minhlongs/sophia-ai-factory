/**
 * /api/affiliate/promo-assets — auth + tier resolution + locale filter.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock('@/seed/db/get-user-tier', () => ({
  getUserTier: vi.fn(),
}));

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getUserTier } from '@/seed/db/get-user-tier';
import { GET } from '../route';

interface PromoResponse {
  tier: string;
  locale: string | null;
  copyTemplates: Array<{ minTier: string; locale: string }>;
  outreachScripts: Array<{ minTier: string; locale: string }>;
  banners: Array<{ minTier: string }>;
}

function buildRequest(query: Record<string, string> = {}): NextRequest {
  const url = new URL('http://localhost/api/affiliate/promo-assets');
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  return new NextRequest(url);
}

describe('GET /api/affiliate/promo-assets', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when unauthenticated', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    const resp = await GET(buildRequest());
    expect(resp.status).toBe(401);
  });

  it('returns 500 when getUserTier throws', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u1' } as Awaited<ReturnType<typeof getCurrentUser>>);
    vi.mocked(getUserTier).mockRejectedValue(new Error('D1 unreachable'));
    const resp = await GET(buildRequest());
    expect(resp.status).toBe(500);
  });

  it('BASIC user sees only BASIC assets', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u1' } as Awaited<ReturnType<typeof getCurrentUser>>);
    vi.mocked(getUserTier).mockResolvedValue('BASIC');
    const resp = await GET(buildRequest());
    expect(resp.status).toBe(200);
    const body = (await resp.json()) as PromoResponse;
    expect(body.tier).toBe('BASIC');
    expect(body.copyTemplates.every((c) => c.minTier === 'BASIC')).toBe(true);
  });

  it('locale=vi narrows copy templates to vi only', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u1' } as Awaited<ReturnType<typeof getCurrentUser>>);
    vi.mocked(getUserTier).mockResolvedValue('MASTER');
    const resp = await GET(buildRequest({ locale: 'vi' }));
    const body = (await resp.json()) as PromoResponse;
    expect(body.locale).toBe('vi');
    expect(body.copyTemplates.every((c) => c.locale === 'vi')).toBe(true);
  });

  it('invalid locale param falls back to no-filter', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u1' } as Awaited<ReturnType<typeof getCurrentUser>>);
    vi.mocked(getUserTier).mockResolvedValue('MASTER');
    const resp = await GET(buildRequest({ locale: 'fr' }));
    const body = (await resp.json()) as PromoResponse;
    expect(body.locale).toBeNull();
    const tiers = new Set(body.copyTemplates.map((c) => c.locale));
    expect(tiers.size).toBeGreaterThan(1);
  });

  it('unknown tier from DB normalises to BASIC', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u1' } as Awaited<ReturnType<typeof getCurrentUser>>);
    vi.mocked(getUserTier).mockResolvedValue('UNKNOWN_TIER' as never);
    const resp = await GET(buildRequest());
    const body = (await resp.json()) as PromoResponse;
    expect(body.tier).toBe('BASIC');
  });
});
