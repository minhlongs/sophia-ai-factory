import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NonRetriableError } from 'inngest';

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  queryData: { data: null as unknown },
  queryError: null as Error | null,
  getExperiment: vi.fn(),
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('@/seed/db/client', () => ({ createServerClient: () => ({ from: mocks.from }) }));
vi.mock('@/seed/utils/logger-utility', () => ({ logger: mocks.logger }));
vi.mock('@/forest/ab/experiment-store', () => ({ getExperiment: mocks.getExperiment }));

import {
  checkCampaignIdempotency,
  enforceMidFlightTier,
  loadCampaignAffiliateOffer,
  resolveCampaignAbTitle,
} from './campaign-pipeline-steps';

describe('campaign pipeline steps', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.queryData = { data: null };
    mocks.queryError = null;
    mocks.getExperiment.mockResolvedValue(null);
    mocks.from.mockImplementation(() => {
      const query = {
        select: vi.fn(() => query),
        eq: vi.fn(() => query),
        single: vi.fn(() => mocks.queryError
          ? Promise.reject(mocks.queryError)
          : Promise.resolve(mocks.queryData)),
      };
      return query;
    });
  });

  afterEach(() => vi.unstubAllEnvs());

  it.each(['processing_script', 'processing_video', 'completed'])('skips campaign already in %s state', async (status) => {
    mocks.queryData = { data: { id: 'campaign-1', status } };
    await expect(checkCampaignIdempotency('campaign-1')).resolves.toEqual({ shouldSkip: true, status });
    expect(mocks.from).toHaveBeenCalledWith('campaigns');
    expect(mocks.logger.info).toHaveBeenCalledOnce();
  });

  it.each([null, { id: 'campaign-1', status: 'failed' }, { id: 'campaign-1', status: 'queued' }])(
    'does not skip absent or non-inflight campaign rows', async (data) => {
      mocks.queryData = { data };
      await expect(checkCampaignIdempotency('campaign-1')).resolves.toEqual({ shouldSkip: false });
      expect(mocks.logger.info).not.toHaveBeenCalled();
    },
  );

  it('builds affiliate redirect URLs and returns null when no offer is selected', async () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://app.example');
    mocks.queryData = { data: { short_code: 'deal-42', offer_name: 'Creator Toolkit', affiliate_link: 'https://merchant.test' } };
    await expect(loadCampaignAffiliateOffer('campaign-1')).resolves.toEqual({
      productName: 'Creator Toolkit', shortUrl: 'https://app.example/r/deal-42',
    });

    mocks.queryData = { data: null };
    await expect(loadCampaignAffiliateOffer('campaign-empty')).resolves.toBeNull();
  });

  it('uses the configured fallback URL and fails soft on affiliate query errors', async () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', '');
    mocks.queryData = { data: { short_code: 'fallback', offer_name: 'Offer', affiliate_link: 'https://merchant.test' } };
    await expect(loadCampaignAffiliateOffer('campaign-1')).resolves.toEqual({
      productName: 'Offer', shortUrl: 'https://sophia.agencyos.network/r/fallback',
    });

    mocks.queryError = new Error('database unavailable');
    await expect(loadCampaignAffiliateOffer('campaign-2')).resolves.toBeNull();
    expect(mocks.logger.warn).toHaveBeenCalledWith(
      '[generate-campaign] failed to load affiliate offer for campaign',
      expect.objectContaining({ campaignId: 'campaign-2', error: 'Error: database unavailable' }),
    );
  });

  it('resolves experiment caption and falls back to topic or campaign label', async () => {
    await expect(resolveCampaignAbTitle(undefined, 'Original topic', 'campaign-1')).resolves.toBe('Original topic');
    await expect(resolveCampaignAbTitle(undefined, undefined, 'campaign-1')).resolves.toBe('Campaign campaign-1');

    mocks.getExperiment.mockResolvedValueOnce({ variantACaption: 'Test variant' });
    await expect(resolveCampaignAbTitle('experiment-1', 'Original topic', 'campaign-1')).resolves.toBe('Test variant');
    expect(mocks.getExperiment).toHaveBeenCalledWith('experiment-1');

    mocks.getExperiment.mockResolvedValueOnce({ variantACaption: '' });
    await expect(resolveCampaignAbTitle('experiment-2', 'Original topic', 'campaign-1')).resolves.toBe('Original topic');
  });

  it('uses the original title when experiment lookup throws', async () => {
    mocks.getExperiment.mockRejectedValue(new Error('experiment store unavailable'));
    await expect(resolveCampaignAbTitle('experiment-1', 'Original topic', 'campaign-1')).resolves.toBe('Original topic');
    expect(mocks.logger.warn).toHaveBeenCalledWith(
      '[generateCampaign] AB experiment lookup failed — using original title',
      expect.objectContaining({ campaignId: 'campaign-1', abExperimentId: 'experiment-1' }),
    );
  });

  it('allows same-tier and upgrade executions without aborting distribution', async () => {
    const abort = vi.fn(async () => undefined);
    await expect(enforceMidFlightTier('campaign-1', 'user-1', 'BASIC', 'BASIC', abort)).resolves.toBeUndefined();
    await expect(enforceMidFlightTier('campaign-1', 'user-1', 'PREMIUM', 'MASTER', abort)).resolves.toBeUndefined();
    expect(abort).not.toHaveBeenCalled();
  });

  it('aborts on downgrade and reports callback failures without masking the non-retriable error', async () => {
    const callbackError = new Error('status write failed');
    const abort = vi.fn(async () => { throw callbackError; });
    await expect(enforceMidFlightTier('campaign-1', 'user-1', 'PREMIUM', 'BASIC', abort))
      .rejects.toBeInstanceOf(NonRetriableError);
    expect(abort).toHaveBeenCalledWith(
      'Tier downgraded mid-flight from PREMIUM to BASIC. Campaign aborted.',
    );
    expect(mocks.logger.warn).toHaveBeenCalledTimes(2);
    expect(mocks.logger.warn).toHaveBeenLastCalledWith(
      'Failed to update campaign status after tier downgrade',
      expect.objectContaining({ campaignId: 'campaign-1', error: 'Error: status write failed' }),
    );
  });
});
