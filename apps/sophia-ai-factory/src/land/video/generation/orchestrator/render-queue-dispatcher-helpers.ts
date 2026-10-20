import { NonRetriableError } from 'inngest';
import { createServerClient } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { MissingCredentialsError, ProviderQuotaExceededError, ProviderInvalidKeyError } from '@/land/services/errors';
import { startVideoGeneration } from '@/seed/ai/video-generator';
import type { ScriptOutput } from '@/seed/ai/script-generator';
import { captureServer } from '@/tree/signals/posthog-capture';
import { Events } from '@/tree/signals/event-types';
import { notifyRefundRequired, notifyProviderError } from '../generate-campaign-refund-notify';
import type { Tier } from '@/seed/types';
import type { Step, AffiliateOfferSelectedRow, AffiliateOfferResult } from './types';

export async function handleStepProviderError(
  err: unknown,
  userId: string,
  campaignId: string,
): Promise<never> {
  if (err instanceof MissingCredentialsError) {
    await notifyRefundRequired(userId, campaignId, err.key);
    throw new NonRetriableError(`Missing AI credential: ${err.key}`, { cause: err });
  }
  if (err instanceof ProviderQuotaExceededError) {
    await notifyProviderError(userId, campaignId, err.service, 'quota', err.message);
    throw new NonRetriableError(err.message, { cause: err });
  }
  if (err instanceof ProviderInvalidKeyError) {
    await notifyProviderError(userId, campaignId, err.service, 'key', err.message);
    throw new NonRetriableError(err.message, { cause: err });
  }
  throw err;
}

export async function loadAffiliateOfferStep(step: Step, campaignId: string): Promise<AffiliateOfferResult | null> {
  const result = (await step.run('load-affiliate-offer', async () => {
    try {
      const db = createServerClient();
      const { data } = await db
        .from('affiliate_offers_selected')
        .select('short_code, offer_name, affiliate_link, network')
        .eq('campaign_id', campaignId)
        .single();
      const row = data as AffiliateOfferSelectedRow | null;
      if (!row) return null;
      const shortUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://sophia.agencyos.network'}/r/${row.short_code}`;
      // `category` is not a column on affiliate_offers_selected yet, so the
      // compliance vertical is derived from the offer name and network, which
      // both exist today. The optional field lets a future migration sharpen
      // classification without changing this call site again.
      return { productName: row.offer_name, shortUrl, category: row.network };
    } catch (error) {
      logger.warn('[generate-campaign] failed to load affiliate offer for campaign', { campaignId, error: String(error) });
      return null;
    }
  })) as AffiliateOfferResult | null;
  return result;
}

export interface VideoGenStepParams {
  campaignId: string;
  userId: string;
  tier: Tier;
  resume?: boolean;
  resumeFrom?: string;
  script: Record<string, unknown>;
  updateStatus: (status: string, progress: number) => Promise<void>;
  notifyUser: (msg: string) => Promise<void>;
}

export async function runVideoGenStep(params: VideoGenStepParams): Promise<string | null> {
  const { campaignId, userId, tier, resume, resumeFrom, script, updateStatus, notifyUser } = params;
  if (resume && resumeFrom === 'finalize') return null;
  await updateStatus('processing_video', 70);
  if (!resume) await notifyUser('🎤 Voiceover ready! Now rendering video...');
  try {
    const jobId = await startVideoGeneration({ script: script as unknown as ScriptOutput, tier, userId });
    void captureServer({
      event: Events.FIRST_VIDEO_STARTED,
      distinctId: userId,
      source: 'server',
      properties: { campaign_id: campaignId, tier },
    }).catch((err) => {
      logger.warn('[runCampaignWorkflow] capture first_video_started failed', { error: String(err) });
    });
    return jobId;
  } catch (err) {
    return handleStepProviderError(err, userId, campaignId);
  }
}
