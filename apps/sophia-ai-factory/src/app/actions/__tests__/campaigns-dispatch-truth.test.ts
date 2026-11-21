import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  authorizeCampaignCreation: vi.fn(),
  checkMultiChannelAccess: vi.fn(),
  checkMonthlyCampaignLimit: vi.fn(),
  insertCampaignRecord: vi.fn(),
  linkAffiliateOffer: vi.fn(),
  sendCampaignCreatedEvent: vi.fn(),
  updateCampaignStatus: vi.fn(),
  revalidatePath: vi.fn(),
  loggerError: vi.fn(),
  loggerWarn: vi.fn(),
}));

vi.mock('../campaigns-guard-helpers', () => ({
  authorizeCampaignCreation: mocks.authorizeCampaignCreation,
  checkMultiChannelAccess: mocks.checkMultiChannelAccess,
}));

vi.mock('@/land/campaigns', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/land/campaigns')>();
  return {
    ...actual,
    checkMonthlyCampaignLimit: mocks.checkMonthlyCampaignLimit,
    insertCampaignRecord: mocks.insertCampaignRecord,
    linkAffiliateOffer: mocks.linkAffiliateOffer,
    sendCampaignCreatedEvent: mocks.sendCampaignCreatedEvent,
  };
});

vi.mock('@/land/video/generation/generate-campaign-db', () => ({
  updateCampaignStatus: mocks.updateCampaignStatus,
}));

vi.mock('next/cache', () => ({
  revalidatePath: mocks.revalidatePath,
}));

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: {
    info: vi.fn(),
    warn: mocks.loggerWarn,
    error: mocks.loggerError,
    debug: vi.fn(),
  },
}));

vi.mock('@/forest/ab/variant-generator', () => ({
  generateVariants: vi.fn().mockRejectedValue(new Error('AB skipped in test')),
}));

import { createCampaign } from '../campaigns';
import { tryDispatchCampaignCreatedEvent } from '../campaigns-helpers';

function buildValidFormData(): FormData {
  const formData = new FormData();
  formData.append('title', 'Option A Pilot Launch');
  formData.append('topic', 'AI Script Generation');
  formData.append('audience', 'Indie Founders');
  formData.append('platforms', 'youtube');
  return formData;
}

describe('Campaign Dispatch Truth (#4 — No Silent Swallowing)', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.authorizeCampaignCreation.mockResolvedValue({
      userId: 'user-basic-1',
      orgId: 'org-1',
      d1db: {},
      tier: 'BASIC',
    });
    mocks.checkMultiChannelAccess.mockResolvedValue(true);
    mocks.checkMonthlyCampaignLimit.mockResolvedValue({
      allowed: true,
      monthLimit: 30,
      currentCount: 0,
    });
    mocks.insertCampaignRecord.mockResolvedValue({ success: true });
    mocks.updateCampaignStatus.mockResolvedValue(undefined);
  });

  it('marks campaign failed and returns success: false when sendCampaignCreatedEvent throws', async () => {
    mocks.sendCampaignCreatedEvent.mockRejectedValue(
      new Error('Inngest event key missing'),
    );

    const result = await createCampaign(buildValidFormData());

    expect(result.success).toBe(false);
    expect(result).toMatchObject({
      success: false,
      error: 'Failed to queue campaign execution / Không thể đưa chiến dịch vào hàng chờ xử lý',
      message: 'Failed to queue campaign execution / Không thể đưa chiến dịch vào hàng chờ xử lý',
    });
    expect(typeof result.campaignId).toBe('string');
    expect(mocks.updateCampaignStatus).toHaveBeenCalledTimes(1);
    expect(mocks.updateCampaignStatus).toHaveBeenCalledWith(
      result.campaignId,
      'failed',
      0,
      { error_message: 'Dispatch failed: Inngest event key missing' },
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/dashboard/campaigns');
  });

  it('returns success: true and does not mark failed when sendCampaignCreatedEvent succeeds', async () => {
    mocks.sendCampaignCreatedEvent.mockResolvedValue(undefined);

    const result = await createCampaign(buildValidFormData());

    expect(result).toMatchObject({
      success: true,
      message: 'Campaign created',
    });
    expect(typeof result.campaignId).toBe('string');
    expect(mocks.updateCampaignStatus).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/dashboard/campaigns');
  });

  it('tryDispatchCampaignCreatedEvent surfaces dispatch errors explicitly', async () => {
    mocks.sendCampaignCreatedEvent.mockRejectedValueOnce(new Error('Network timeout'));

    const failed = await tryDispatchCampaignCreatedEvent({
      campaignId: 'camp-1',
      userId: 'user-1',
      topic: 'Topic',
      audience: 'Audience',
      tier: 'BASIC',
    });

    expect(failed).toEqual({ dispatched: false, error: 'Network timeout' });

    mocks.sendCampaignCreatedEvent.mockResolvedValueOnce(undefined);

    const ok = await tryDispatchCampaignCreatedEvent({
      campaignId: 'camp-2',
      userId: 'user-1',
      topic: 'Topic',
      audience: 'Audience',
      tier: 'BASIC',
    });

    expect(ok).toEqual({ dispatched: true });
  });
});
