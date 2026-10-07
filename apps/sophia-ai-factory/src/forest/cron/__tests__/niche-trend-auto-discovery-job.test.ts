import { describe, it, expect, vi, beforeEach } from 'vitest';
import { nicheTrendAutoDiscoveryJob } from '../niche-trend-auto-discovery-job';
import { inngest } from '@/seed/inngest/client';

vi.mock('@/seed/inngest/client', () => ({
  inngest: {
    createFunction: vi.fn((opts, trigger, fn) => ({ ...opts, trigger, fn })),
    send: vi.fn().mockResolvedValue({ ids: ['evt_1'] }),
  },
}));

describe('nicheTrendAutoDiscoveryJob', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('runs discovery step and dispatches campaign requests for top candidates', async () => {
    const mockStep = {
      run: vi.fn().mockImplementation(async (name: string, fn: () => Promise<unknown>) => {
        if (name === 'fetch-saas-trends') {
          return [
            {
              id: 'ph_1',
              name: 'AI Copywriter Pro',
              tagline: 'Best AI Copywriter',
              votesCount: 450,
              url: 'https://aicopy.io',
              topics: ['AI', 'Productivity'],
            },
          ];
        }
        if (name === 'fetch-crypto-trends') {
          return [
            {
              id: 'cg_1',
              name: 'HyperToken',
              symbol: 'HPR',
              market_cap_rank: 55,
              score: 2,
              data: { price_change_percentage_24h: { usd: 14.5 } },
            },
          ];
        }
        return fn();
      }),
    };

    const handler = (nicheTrendAutoDiscoveryJob as unknown as { fn: Function }).fn;
    const result = await handler({ step: mockStep });

    expect(result).toEqual({ saasExecuted: true, cryptoExecuted: true });
    expect(inngest.send).toHaveBeenCalledTimes(2);

    expect(inngest.send).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'niche.video.campaign.requested',
        data: expect.objectContaining({
          niche: 'saas_global',
          productName: 'AI Copywriter Pro',
        }),
      }),
    );

    expect(inngest.send).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'niche.video.campaign.requested',
        data: expect.objectContaining({
          niche: 'crypto_global',
          productName: 'HyperToken',
        }),
      }),
    );
  });
});
