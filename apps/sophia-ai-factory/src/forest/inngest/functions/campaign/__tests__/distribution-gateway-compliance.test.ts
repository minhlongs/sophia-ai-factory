import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockDistribute = vi.fn();
const mockSelfHeal = vi.fn();
const mockResolveAudienceJurisdiction = vi.fn();

vi.mock('@/tree/gateway/openclaw-gateway', () => ({
  OpenClawGateway: class {
    registerChannel = vi.fn();
    distribute = mockDistribute;
    selfHeal = mockSelfHeal;
  },
}));

vi.mock('@/land/youtube/youtube-oauth-client', () => ({
  uploadVideo: vi.fn(),
  refreshAccessToken: vi.fn(),
}));

vi.mock('@/land/tiktok/tiktok-oauth-client', () => ({
  publishVideo: vi.fn(),
  checkPublishStatus: vi.fn(),
}));

vi.mock('@/tree/affiliates/audience-jurisdiction', () => ({
  resolveAudienceJurisdiction: (...args: unknown[]) => mockResolveAudienceJurisdiction(...args),
}));

import { runDistribution } from '../distribution-gateway';

describe('runDistribution dual-market compliance gate (US + VN)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDistribute.mockResolvedValue({
      campaignId: 'camp_1',
      allSucceeded: true,
      results: [{ channelId: 'youtube', success: true }],
    });
  });

  it('blocks regulated crypto offers when tenant jurisdiction is VN', async () => {
    mockResolveAudienceJurisdiction.mockResolvedValue('VN');

    const res = await runDistribution({
      campaignId: 'camp_vn_crypto',
      userId: 'user_vn',
      videoUrl: 'https://cdn.example.com/v.mp4',
      thumbnailUrl: 'https://cdn.example.com/t.jpg',
      title: 'Crypto Trading Bot',
      audience: 'traders',
      tier: 'PREMIUM',
      affiliateOffer: {
        productName: 'Binance Futures',
        shortUrl: 'https://sophia.agencyos.network/r/bn123456',
        category: 'crypto',
      },
    });

    expect(res.compliance.published).toBe(false);
    expect(res.compliance.reason).toBe('crypto_prohibited_in_jurisdiction');
    expect(mockDistribute).not.toHaveBeenCalled();
  });

  it('publishes non-regulated offers for VN jurisdiction with Vietnamese disclosure (#QuảngCáo)', async () => {
    mockResolveAudienceJurisdiction.mockResolvedValue('VN');

    const res = await runDistribution({
      campaignId: 'camp_vn_saas',
      userId: 'user_vn',
      videoUrl: 'https://cdn.example.com/v.mp4',
      thumbnailUrl: 'https://cdn.example.com/t.jpg',
      title: 'AI Productivity',
      audience: 'creators',
      tier: 'PREMIUM',
      affiliateOffer: {
        productName: 'Notion AI',
        shortUrl: 'https://sophia.agencyos.network/r/nt123456',
        category: 'saas',
      },
    });

    expect(res.compliance.published).toBe(true);
    expect(res.compliance.affiliateDisclosureEmitted).toBe(true);
    expect(mockDistribute).toHaveBeenCalledTimes(1);
    const payload = mockDistribute.mock.calls[0][0];
    expect(payload.description).toContain('#QuảngCáo');
    expect(payload.description).toContain('liên kết affiliate');
    expect(payload.description).toContain('https://sophia.agencyos.network/r/nt123456');
  });

  it('publishes US offers with US FTC disclosure (#ad)', async () => {
    mockResolveAudienceJurisdiction.mockResolvedValue('US');

    const res = await runDistribution({
      campaignId: 'camp_us_saas',
      userId: 'user_us',
      videoUrl: 'https://cdn.example.com/v.mp4',
      thumbnailUrl: 'https://cdn.example.com/t.jpg',
      title: 'Best SaaS Tools',
      audience: 'founders',
      tier: 'PREMIUM',
      affiliateOffer: {
        productName: 'Notion AI',
        shortUrl: 'https://sophia.agencyos.network/r/us123456',
        category: 'saas',
      },
    });

    expect(res.compliance.published).toBe(true);
    const payload = mockDistribute.mock.calls[0][0];
    expect(payload.description).toContain('#ad');
    expect(payload.description).toContain('affiliate links');
  });
});
