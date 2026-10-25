/**
 * Tests for the disclosure behaviour of `runDistributeStep`.
 *
 * The gate lives in `tree/affiliates/distribution-compliance-gate` and is
 * covered there. What these tests pin is the caller's own duty on the live
 * path:
 *
 *   1. a description that carries a tracked affiliate link must leave with the
 *      mandated disclosure wording,
 *   2. a blank jurisdiction must be treated as unknown rather than being
 *      silently normalised into a permissive one,
 *   3. a verdict that requires disclosure but cannot produce any must refuse
 *      to publish instead of shipping a bare description.
 *
 * Only the transport layer is mocked. The gate, the classifier and the
 * disclosure wording are the real implementations.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const hoisted = vi.hoisted(() => ({
  distribute: vi.fn(),
  selfHeal: vi.fn(),
  resolveAudienceJurisdiction: vi.fn(),
  captureServer: vi.fn(),
  registerChannel: vi.fn(),
}));
const { distribute, selfHeal, resolveAudienceJurisdiction } = hoisted;

// A stable stub class: `vi.clearAllMocks` clears implementations set on a mock
// function, which would strip the constructor's return value. Declaring the
// methods on a real class keeps the shape intact across resets.
vi.mock('@/tree/gateway/openclaw-gateway', () => ({
  OpenClawGateway: class {
    registerChannel = hoisted.registerChannel;
    distribute = hoisted.distribute;
    selfHeal = hoisted.selfHeal;
  },
}));

vi.mock('@/tree/gateway/adapters/youtube-channel-adapter', () => ({ YouTubeChannelAdapter: vi.fn() }));
vi.mock('@/tree/gateway/adapters/tiktok-channel-adapter', () => ({ TikTokChannelAdapter: vi.fn() }));
vi.mock('@/tree/gateway/adapters/telegram-notification-adapter', () => ({ TelegramNotificationAdapter: vi.fn() }));
vi.mock('@/land/youtube/youtube-oauth-client', () => ({ uploadVideo: vi.fn(), refreshAccessToken: vi.fn() }));
vi.mock('@/land/tiktok/tiktok-oauth-client', () => ({ publishVideo: vi.fn(), checkPublishStatus: vi.fn() }));
vi.mock('@/tree/affiliates/audience-jurisdiction', () => ({ resolveAudienceJurisdiction: hoisted.resolveAudienceJurisdiction }));
vi.mock('@/tree/signals/posthog-capture', () => ({ captureServer: hoisted.captureServer }));

vi.mock('@/seed/db/client', () => ({ createServerClient: () => ({ from: () => ({}) }) }));

import { runDistributeStep } from '../orchestrator/callback-processor';
import type { DistributeStepParams } from '../orchestrator/callback-processor';

const TIER = 'BASIC' as const;

function makeParams(overrides: Partial<DistributeStepParams> = {}): DistributeStepParams {
  return {
    campaignId: 'camp-1',
    videoUrl: 'https://example.com/video.mp4',
    title: 'A video',
    audience: 'founders',
    tier: TIER,
    affiliateOffer: null,
    tenantId: 'tenant-1',
    jurisdiction: 'US',
    ...overrides,
  };
}

const okResult = { campaignId: 'camp-1', results: [{ channelId: 'youtube', success: true }], allSucceeded: true };

describe('runDistributeStep disclosure on the distribution path', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolveAudienceJurisdiction.mockResolvedValue('US');
    distribute.mockResolvedValue(okResult);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('appends the FTC affiliate disclosure when a tracked link is in the description', async () => {
    const result = await runDistributeStep(
      makeParams({ affiliateOffer: { productName: 'SmartSuite Workflow', shortUrl: 'https://sophia.agencyos.network/r/abc123' } }),
    );

    expect(distribute).toHaveBeenCalledTimes(1);
    const sent = distribute.mock.calls[0]![0] as { description: string };
    expect(sent.description).toContain('affiliate links and I may earn a commission');
    expect(result.allSucceeded).toBe(true);
  });

  it('appends the Vietnamese affiliate disclosure when the locale is vi', async () => {
    await runDistributeStep(
      makeParams({
        locale: 'vi',
        affiliateOffer: { productName: 'SmartSuite Workflow', shortUrl: 'https://sophia.agencyos.network/r/abc123' },
      }),
    );

    const sent = distribute.mock.calls[0]![0] as { description: string };
    expect(sent.description).toContain('liên kết affiliate');
  });

  it('appends the jurisdiction financial disclaimer for regulated verticals', async () => {
    await runDistributeStep(
      makeParams({
        jurisdiction: 'US',
        affiliateOffer: { productName: 'KuCoin Trading Rebate', shortUrl: 'https://sophia.agencyos.network/r/x', category: 'Crypto Exchange' },
      }),
    );

    const sent = distribute.mock.calls[0]![0] as { description: string };
    expect(sent.description).toContain('Crypto is highly volatile');
  });

  it('refuses to publish regulated content with a blank jurisdiction instead of defaulting to a permissive one', async () => {
    const result = await runDistributeStep(
      makeParams({
        jurisdiction: '   ',
        affiliateOffer: { productName: 'KuCoin Trading Rebate', shortUrl: 'https://sophia.agencyos.network/r/x', category: 'Crypto Exchange' },
      }),
    );

    expect(result.skippedByCompliance).toBe(true);
    expect(result.complianceReason).toBe('jurisdiction_unknown');
    expect(distribute).not.toHaveBeenCalled();
  });

  it('refuses to publish when the tenant has no declared jurisdiction', async () => {
    resolveAudienceJurisdiction.mockResolvedValue(null);

    const result = await runDistributeStep(
      makeParams({
        jurisdiction: undefined,
        affiliateOffer: { productName: 'Futures copy trading', shortUrl: 'https://sophia.agencyos.network/r/y' },
      }),
    );

    expect(result.skippedByCompliance).toBe(true);
    expect(distribute).not.toHaveBeenCalled();
  });

  it('refuses to publish regulated content prohibited in the audience jurisdiction', async () => {
    const result = await runDistributeStep(
      makeParams({
        jurisdiction: 'VN',
        affiliateOffer: { productName: 'KuCoin Trading Rebate', shortUrl: 'https://sophia.agencyos.network/r/z', category: 'Crypto Exchange' },
      }),
    );

    expect(result.skippedByCompliance).toBe(true);
    expect(result.complianceReason).toBe('crypto_prohibited_in_jurisdiction');
    expect(distribute).not.toHaveBeenCalled();
  });

  it('records which disclosures were emitted alongside a successful publish', async () => {
    const result = await runDistributeStep(
      makeParams({
        jurisdiction: 'US',
        affiliateOffer: { productName: 'KuCoin Trading Rebate', shortUrl: 'https://sophia.agencyos.network/r/x', category: 'Crypto Exchange' },
      }),
    );

    expect(result.disclosure).toEqual({
      vertical: 'crypto',
      jurisdiction: 'US',
      financialDisclaimerEmitted: true,
      affiliateDisclosureEmitted: true,
      locale: 'en',
    });
  });

  it('carries the disclosure record through the self-heal retry path', async () => {
    distribute.mockResolvedValue({
      campaignId: 'camp-1',
      results: [{ channelId: 'youtube', success: false, error: 'boom' }],
      allSucceeded: false,
    });
    selfHeal.mockResolvedValue({ ...okResult, healed: 1, failed: 0, errors: [] });

    const result = await runDistributeStep(
      makeParams({
        jurisdiction: 'US',
        affiliateOffer: { productName: 'SmartSuite Workflow', shortUrl: 'https://sophia.agencyos.network/r/abc123' },
      }),
    );

    expect(selfHeal).toHaveBeenCalledTimes(1);
    // The retried description must still carry the mandated wording.
    const retried = selfHeal.mock.calls[0]![0] as { description: string };
    expect(retried.description).toContain('affiliate links and I may earn a commission');
    expect(result.disclosure?.affiliateDisclosureEmitted).toBe(true);
  });

  it('publishes an offer-free description with no disclosure and no refusal', async () => {
    const result = await runDistributeStep(makeParams());

    expect(distribute).toHaveBeenCalledTimes(1);
    const sent = distribute.mock.calls[0]![0] as { description: string };
    expect(sent.description).toBe('AI-generated video content for founders');
    expect(result.allSucceeded).toBe(true);
    expect(result.disclosure).toEqual({
      vertical: 'other',
      jurisdiction: 'US',
      financialDisclaimerEmitted: false,
      affiliateDisclosureEmitted: false,
      locale: 'en',
    });
  });
});
