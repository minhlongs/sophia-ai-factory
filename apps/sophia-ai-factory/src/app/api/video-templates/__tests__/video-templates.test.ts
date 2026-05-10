/**
 * /api/video-templates tests — auth + tier filtering + category filter + public projection.
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

interface TemplatesResponse {
  tier: string;
  category: string | null;
  count: number;
  templates: Array<{
    id: string;
    minTier: string;
    category: string;
    transitionsJson?: unknown;
  }>;
}

function buildRequest(query: Record<string, string> = {}): NextRequest {
  const url = new URL('http://localhost/api/video-templates');
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  return new NextRequest(url);
}

describe('GET /api/video-templates', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when unauthenticated', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    const resp = await GET(buildRequest());
    expect(resp.status).toBe(401);
  });

  it('returns 500 when getUserTier throws', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u1' } as Awaited<ReturnType<typeof getCurrentUser>>);
    vi.mocked(getUserTier).mockRejectedValue(new Error('D1 down'));
    const resp = await GET(buildRequest());
    expect(resp.status).toBe(500);
  });

  it('BASIC user sees only BASIC-tier templates', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u1' } as Awaited<ReturnType<typeof getCurrentUser>>);
    vi.mocked(getUserTier).mockResolvedValue('BASIC');
    const resp = await GET(buildRequest());
    expect(resp.status).toBe(200);
    const body = (await resp.json()) as TemplatesResponse;
    expect(body.tier).toBe('BASIC');
    expect(body.count).toBeGreaterThan(0);
    expect(body.templates.every((t) => t.minTier === 'BASIC')).toBe(true);
  });

  it('MASTER tier sees presets across multiple tiers and 4 categories', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u1' } as Awaited<ReturnType<typeof getCurrentUser>>);
    vi.mocked(getUserTier).mockResolvedValue('MASTER');
    const resp = await GET(buildRequest());
    const body = (await resp.json()) as TemplatesResponse;
    expect(body.count).toBeGreaterThanOrEqual(20);
    const tiers = new Set(body.templates.map((t) => t.minTier));
    expect(tiers.size).toBeGreaterThanOrEqual(2);
    const cats = new Set(body.templates.map((t) => t.category));
    expect(cats.size).toBe(4);
  });

  it('strips internal transitionsJson from public projection', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u1' } as Awaited<ReturnType<typeof getCurrentUser>>);
    vi.mocked(getUserTier).mockResolvedValue('MASTER');
    const resp = await GET(buildRequest());
    const body = (await resp.json()) as TemplatesResponse;
    for (const t of body.templates) {
      expect(t).not.toHaveProperty('transitionsJson');
    }
  });

  it('category=social narrows the list', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u1' } as Awaited<ReturnType<typeof getCurrentUser>>);
    vi.mocked(getUserTier).mockResolvedValue('MASTER');
    const resp = await GET(buildRequest({ category: 'social' }));
    const body = (await resp.json()) as TemplatesResponse;
    expect(body.category).toBe('social');
    expect(body.templates.every((t) => t.category === 'social')).toBe(true);
  });

  it('invalid category falls back to no filter', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u1' } as Awaited<ReturnType<typeof getCurrentUser>>);
    vi.mocked(getUserTier).mockResolvedValue('MASTER');
    const resp = await GET(buildRequest({ category: 'bogus' }));
    const body = (await resp.json()) as TemplatesResponse;
    expect(body.category).toBeNull();
  });

  it('unknown DB tier normalises to BASIC', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u1' } as Awaited<ReturnType<typeof getCurrentUser>>);
    vi.mocked(getUserTier).mockResolvedValue('UNKNOWN' as never);
    const resp = await GET(buildRequest());
    const body = (await resp.json()) as TemplatesResponse;
    expect(body.tier).toBe('BASIC');
  });
});
