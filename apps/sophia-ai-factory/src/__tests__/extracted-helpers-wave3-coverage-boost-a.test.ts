/**
 * Targeted branch coverage suite wave 3 - Part A (< 150 LOC).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { retryCampaign, resumeCampaign } from '@/app/actions/campaigns-retry-resume';
import { GET, DELETE } from '@/app/api/campaigns/route';
import { NextRequest } from 'next/server';

vi.mock('@/seed/db/client', () => ({ createServerClient: vi.fn() }));
vi.mock('@/seed/auth/better-auth-session', () => ({ getCurrentUser: vi.fn() }));
vi.mock('@/land/campaigns/create-campaign-core', () => ({
  sendCampaignCreatedEvent: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/app/actions/campaigns-retry-resume-helpers', () => ({
  loadFailedCampaignWithTier: vi.fn(),
  resolveResumeStep: vi.fn().mockReturnValue({
    resumeStatus: 'script_ready',
    resumeProgress: 40,
    resumeFrom: 'script',
  }),
}));
vi.mock('@/seed/security/csrf', () => ({
  verifyCsrfToken: vi.fn().mockReturnValue(true),
}));

describe('extracted-helpers-wave3-a', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('handles retryCampaign and resumeCampaign paths and errors', async () => {
    const { getCurrentUser } = await import('@/seed/auth/better-auth-session');
    const { createServerClient } = await import('@/seed/db/client');
    const { loadFailedCampaignWithTier } = await import('@/app/actions/campaigns-retry-resume-helpers');

    vi.mocked(getCurrentUser).mockResolvedValueOnce(null);
    expect(await retryCampaign('c-1')).toEqual({ success: false, message: 'Unauthorized' });

    vi.mocked(getCurrentUser).mockResolvedValueOnce({ id: 'u-1' } as any);
    vi.mocked(loadFailedCampaignWithTier).mockResolvedValueOnce({ ok: false, message: 'Not failed' } as any);
    expect(await retryCampaign('c-1')).toEqual({ success: false, message: 'Not failed' });

    const mockDbFail = {
      from: vi.fn().mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: { message: 'DB error' } }),
          }),
        }),
      }),
    };
    vi.mocked(createServerClient).mockReturnValue(mockDbFail as any);
    vi.mocked(getCurrentUser).mockResolvedValueOnce({ id: 'u-1' } as any);
    vi.mocked(loadFailedCampaignWithTier).mockResolvedValueOnce({
      ok: true,
      campaign: { id: 'c-1', user_id: 'u-1', title: 'Fallback Title', topic: '' },
      tier: 'SOLO_100',
    } as any);
    expect(await retryCampaign('c-1')).toEqual({ success: false, message: 'Failed to reset campaign' });

    const mockDbSuccess = {
      from: vi.fn().mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        }),
      }),
    };
    vi.mocked(createServerClient).mockReturnValue(mockDbSuccess as any);
    vi.mocked(getCurrentUser).mockResolvedValueOnce({ id: 'u-1' } as any);
    vi.mocked(loadFailedCampaignWithTier).mockResolvedValueOnce({
      ok: true,
      campaign: { id: 'c-1', user_id: 'u-1', topic: 'Main Topic', audience: 'Founders' },
      tier: 'SOLO_100',
    } as any);
    expect(await retryCampaign('c-1')).toEqual({ success: true, message: 'Campaign retry initiated' });

    vi.mocked(getCurrentUser).mockResolvedValueOnce({ id: 'u-1' } as any);
    vi.mocked(loadFailedCampaignWithTier).mockResolvedValueOnce({
      ok: true,
      campaign: { id: 'c-1', user_id: 'u-1', title: 'T', topic: '' },
      tier: 'SCALE_PRO',
    } as any);
    expect(await resumeCampaign('c-1')).toEqual({
      success: true,
      message: 'Campaign resumed from script step',
    });
  });

  it('handles /api/campaigns GET and DELETE paths and errors', async () => {
    const { getCurrentUser } = await import('@/seed/auth/better-auth-session');
    const { createServerClient } = await import('@/seed/db/client');
    const { verifyCsrfToken } = await import('@/seed/security/csrf');

    vi.mocked(getCurrentUser).mockResolvedValueOnce(null);
    expect((await GET(new NextRequest('https://app/api/campaigns'))).status).toBe(401);

    vi.mocked(getCurrentUser).mockResolvedValueOnce({ id: 'u-1' } as any);
    const mockDb = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { id: 'c-1' }, error: null }),
            }),
          }),
        }),
      }),
    };
    vi.mocked(createServerClient).mockReturnValue(mockDb as any);
    expect((await GET(new NextRequest('https://app/api/campaigns?id=c-1'))).status).toBe(200);

    vi.mocked(verifyCsrfToken).mockReturnValueOnce(false);
    expect((await DELETE(new NextRequest('https://app/api/campaigns'))).status).toBe(403);

    vi.mocked(verifyCsrfToken).mockReturnValueOnce(true);
    vi.mocked(getCurrentUser).mockResolvedValueOnce({ id: 'u-1' } as any);
    expect((await DELETE(new NextRequest('https://app/api/campaigns'))).status).toBe(400);

    vi.mocked(verifyCsrfToken).mockReturnValueOnce(true);
    vi.mocked(getCurrentUser).mockResolvedValueOnce({ id: 'u-1' } as any);
    const mockDeleteDb = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'c-1' }, error: null }),
            }),
          }),
        }),
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        }),
      }),
    };
    vi.mocked(createServerClient).mockReturnValue(mockDeleteDb as any);
    expect((await DELETE(new NextRequest('https://app/api/campaigns?id=c-1'))).status).toBe(200);
  });
});
