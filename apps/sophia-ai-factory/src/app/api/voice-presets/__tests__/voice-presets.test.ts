/**
 * /api/voice-presets tests — auth + tier filtering + public projection.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock('@/seed/db/get-user-tier', () => ({
  getUserTier: vi.fn(),
}));

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getUserTier } from '@/seed/db/get-user-tier';
import { GET } from '../route';

interface PresetResponse {
  tier: string;
  presets: Array<{
    id: string;
    displayName: string;
    minTier: string;
    coquiSpeaker?: unknown;
  }>;
}

describe('GET /api/voice-presets', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    const resp = await GET();
    expect(resp.status).toBe(401);
  });

  it('returns BASIC-tier presets only for BASIC user', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u1' } as Awaited<ReturnType<typeof getCurrentUser>>);
    vi.mocked(getUserTier).mockResolvedValue('BASIC');

    const resp = await GET();
    expect(resp.status).toBe(200);
    const body = (await resp.json()) as PresetResponse;
    expect(body.tier).toBe('BASIC');
    expect(body.presets.length).toBeGreaterThan(0);
    expect(body.presets.every((p) => p.minTier === 'BASIC')).toBe(true);
  });

  it('MASTER tier sees presets across all tiers', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u1' } as Awaited<ReturnType<typeof getCurrentUser>>);
    vi.mocked(getUserTier).mockResolvedValue('MASTER');

    const resp = await GET();
    const body = (await resp.json()) as PresetResponse;
    const minTiers = new Set(body.presets.map((p) => p.minTier));
    expect(body.presets.length).toBeGreaterThanOrEqual(12);
    expect(minTiers.size).toBeGreaterThanOrEqual(2);
  });

  it('strips internal coquiSpeaker from public projection', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u1' } as Awaited<ReturnType<typeof getCurrentUser>>);
    vi.mocked(getUserTier).mockResolvedValue('MASTER');

    const resp = await GET();
    const body = (await resp.json()) as PresetResponse;
    for (const p of body.presets) {
      expect(p).not.toHaveProperty('coquiSpeaker');
    }
  });

  it('returns 500 when getUserTier throws', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u1' } as Awaited<ReturnType<typeof getCurrentUser>>);
    vi.mocked(getUserTier).mockRejectedValue(new Error('D1 down'));

    const resp = await GET();
    expect(resp.status).toBe(500);
  });
});
