import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '../route';

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock('@/seed/inngest/client', () => ({
  inngest: {
    send: vi.fn().mockResolvedValue({ ids: ['evt-123'] }),
  },
}));

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { inngest } from '@/seed/inngest/client';

describe('POST /api/v1/video/autonomous', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 if unauthenticated', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);

    const req = new NextRequest('http://localhost/api/v1/video/autonomous', {
      method: 'POST',
      body: JSON.stringify({}),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('returns 422 if payload is invalid', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'usr-1', email: 'test@example.com' } as any);

    const req = new NextRequest('http://localhost/api/v1/video/autonomous', {
      method: 'POST',
      body: JSON.stringify({
        campaignId: 'camp-1',
        niche: 'invalid_niche',
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(422);
  });

  it('executes synchronous synthesis successfully for valid input', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'usr-1', email: 'test@example.com' } as any);

    const req = new NextRequest('http://localhost/api/v1/video/autonomous', {
      method: 'POST',
      body: JSON.stringify({
        campaignId: 'camp-saas-api-01',
        niche: 'saas_global',
        productName: 'DevFlow AI',
        productUrl: 'https://devflow.ai',
        productDescription: 'Automated CI/CD pipeline optimization with AI code reviews.',
        targetDurationSeconds: 15.0,
        affiliateBaseUrl: 'https://devflow.ai/ref',
        asyncExecution: false,
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = (await res.json()) as { success: boolean; mode: string; summary: { campaignId: string; manifest: unknown } };
    expect(json.success).toBe(true);
    expect(json.mode).toBe('SYNC_SYNTHESIZED');
    expect(json.summary.campaignId).toBe('camp-saas-api-01');
    expect(json.summary.manifest).toBeDefined();
  });

  it('queues asynchronous inngest execution when requested', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'usr-1', email: 'test@example.com' } as any);

    const req = new NextRequest('http://localhost/api/v1/video/autonomous', {
      method: 'POST',
      body: JSON.stringify({
        campaignId: 'camp-crypto-async-02',
        niche: 'crypto_global',
        productName: 'ApexDex Sniper',
        productUrl: 'https://apexdex.xyz',
        productDescription: 'Solana memecoin sniper bot with lightning speed execution.',
        targetDurationSeconds: 20.0,
        affiliateBaseUrl: 'https://apexdex.xyz/ref',
        asyncExecution: true,
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(202);
    const json = (await res.json()) as { success: boolean; mode: string };
    expect(json.success).toBe(true);
    expect(json.mode).toBe('ASYNC_QUEUED');
    expect(inngest.send).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'autonomous.video.pipeline.requested',
      }),
    );
  });
});
