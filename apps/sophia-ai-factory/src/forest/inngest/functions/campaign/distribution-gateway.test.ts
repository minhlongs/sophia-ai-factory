/**
 * The compliance contract of the LIVE campaign distribution path.
 *
 * `src/forest/inngest/functions/campaign/distribution-gateway.ts` is the only
 * production code that publishes an affiliate campaign video. These tests pin
 * its three obligations:
 *
 *   1. regulated content never reaches the channels without a jurisdiction,
 *   2. a prohibited jurisdiction stops the dispatch entirely,
 *   3. a permitted one publishes with the mandated disclosure wording.
 *
 * The transport layer is mocked; the decision module and its wording are real,
 * so a regression in the gate itself fails here too.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  jurisdiction: 'US' as string | null,
  distribute: vi.fn(),
  selfHeal: vi.fn(),
}));

vi.mock('@/tree/affiliates/audience-jurisdiction', () => ({
  resolveAudienceJurisdiction: vi.fn(async () => mocks.jurisdiction),
}));
vi.mock('@/tree/gateway/openclaw-gateway', () => ({
  OpenClawGateway: class {
    registerChannel = vi.fn();
    distribute = mocks.distribute;
    selfHeal = mocks.selfHeal;
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
vi.mock('@/tree/gateway/adapters/youtube-channel-adapter', () => ({ YouTubeChannelAdapter: class {} }));
vi.mock('@/tree/gateway/adapters/tiktok-channel-adapter', () => ({ TikTokChannelAdapter: class {} }));
vi.mock('@/tree/gateway/adapters/telegram-notification-adapter', () => ({
  TelegramNotificationAdapter: class {},
}));

import { runDistribution } from './distribution-gateway';

const OK_RESULT = {
  campaignId: 'camp-1',
  allSucceeded: true,
  results: [{ channelId: 'youtube', success: true }],
};

describe('runDistribution compliance (live campaign path)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.jurisdiction = 'US';
    mocks.distribute.mockResolvedValue(OK_RESULT);
    mocks.selfHeal.mockResolvedValue(OK_RESULT);
  });

  it('withholds a regulated campaign when no jurisdiction is declared', async () => {
    mocks.jurisdiction = null;
    const outcome = await runDistribution({
      campaignId: 'camp-1',
      userId: 'user-1',
      videoUrl: 'https://cdn/v.mp4',
      thumbnailUrl: '',
      title: 'Crypto explainer',
      audience: 'crypto beginners',
      tier: 'BASIC',
      affiliateOffer: { productName: 'Exchange Rebate', shortUrl: 'https://sophia.agencyos.network/r/link0001' },
    });

    expect(outcome.allSucceeded).toBe(false);
    expect(outcome.compliance.published).toBe(false);
    expect(outcome.compliance.reason).toBe('jurisdiction_unknown');
    // The channels were never touched.
    expect(mocks.distribute).not.toHaveBeenCalled();
  });

  it('refuses to dispatch into a jurisdiction where promotion is prohibited', async () => {
    mocks.jurisdiction = 'VN';
    const outcome = await runDistribution({
      campaignId: 'camp-2',
      userId: 'user-1',
      videoUrl: 'https://cdn/v.mp4',
      thumbnailUrl: '',
      title: 'Crypto explainer',
      audience: 'crypto beginners',
      tier: 'BASIC',
      affiliateOffer: { productName: 'Exchange Rebate', shortUrl: 'https://sophia.agencyos.network/r/link0002' },
    });

    expect(outcome.compliance.published).toBe(false);
    expect(outcome.compliance.reason).toBe('crypto_prohibited_in_jurisdiction');
    expect(mocks.distribute).not.toHaveBeenCalled();
  });

  it('publishes a permitted regulated campaign carrying both mandated wordings', async () => {
    mocks.jurisdiction = 'US';
    const outcome = await runDistribution({
      campaignId: 'camp-3',
      userId: 'user-1',
      videoUrl: 'https://cdn/v.mp4',
      thumbnailUrl: '',
      title: 'Crypto explainer',
      audience: 'crypto beginners',
      tier: 'BASIC',
      affiliateOffer: { productName: 'Exchange Rebate', shortUrl: 'https://sophia.agencyos.network/r/link0003' },
    });

    expect(mocks.distribute).toHaveBeenCalledTimes(1);
    const sent = mocks.distribute.mock.calls[0]![0] as { description: string };
    expect(sent.description).toContain('affiliate links and I may earn a commission');
    expect(outcome.compliance.published).toBe(true);
    expect(outcome.compliance.affiliateDisclosureEmitted).toBe(true);
    expect(outcome.compliance.financialDisclaimerEmitted).toBe(true);
  });

  it('keeps an ordinary SaaS campaign publishing when no jurisdiction is declared', async () => {
    mocks.jurisdiction = null;
    const outcome = await runDistribution({
      campaignId: 'camp-4',
      userId: 'user-1',
      videoUrl: 'https://cdn/v.mp4',
      thumbnailUrl: '',
      title: 'Productivity tips',
      audience: 'productivity teams',
      tier: 'BASIC',
      affiliateOffer: { productName: 'Notion Team', shortUrl: 'https://sophia.agencyos.network/r/link0004' },
    });

    expect(outcome.compliance.published).toBe(true);
    expect(mocks.distribute).toHaveBeenCalledTimes(1);
    const sent = mocks.distribute.mock.calls[0]![0] as { description: string };
    expect(sent.description).toContain('https://sophia.agencyos.network/r/link0004');
  });

  it('publishes a campaign with no affiliate offer unchanged', async () => {
    const outcome = await runDistribution({
      campaignId: 'camp-5',
      userId: 'user-1',
      videoUrl: 'https://cdn/v.mp4',
      thumbnailUrl: '',
      title: 'Faceless explainer',
      audience: 'general audience',
      tier: 'BASIC',
      affiliateOffer: null,
    });

    expect(outcome.compliance.published).toBe(true);
    const sent = mocks.distribute.mock.calls[0]![0] as { description: string };
    expect(sent.description).toBe('AI-generated video content for general audience');
    expect(sent.description).not.toContain('👉');
  });

  it('keeps the mandated wording on the self-heal retry after a partial failure', async () => {
    mocks.distribute.mockResolvedValue({ ...OK_RESULT, allSucceeded: false });
    await runDistribution({
      campaignId: 'camp-6',
      userId: 'user-1',
      videoUrl: 'https://cdn/v.mp4',
      thumbnailUrl: '',
      title: 'Crypto explainer',
      audience: 'crypto beginners',
      tier: 'BASIC',
      affiliateOffer: { productName: 'Exchange Rebate', shortUrl: 'https://sophia.agencyos.network/r/link0005' },
    });

    expect(mocks.selfHeal).toHaveBeenCalledTimes(1);
    const retried = mocks.selfHeal.mock.calls[0]![0] as { description: string };
    expect(retried.description).toContain('affiliate links and I may earn a commission');
  });
});
