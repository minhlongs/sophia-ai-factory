import { NonRetriableError } from 'inngest';
import { createServerClient } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { ServiceFactory } from '@/land/services/factory';
import { MissingCredentialsError, ProviderQuotaExceededError, ProviderInvalidKeyError } from '@/land/services/errors';
import { startVideoGeneration } from '@/seed/ai/video-generator';
import type { ScriptOutput } from '@/seed/ai/script-generator';
import { resolveOrgId } from '@/seed/auth/resolve-org-id';
import { captureServer } from '@/tree/signals/posthog-capture';
import { Events } from '@/tree/signals/event-types';
import { notifyRefundRequired, notifyProviderError } from '../generate-campaign-refund-notify';
import type { Tier } from '@/seed/types';
import type { Step, AffiliateOfferSelectedRow, AffiliateOfferResult } from './types';

export async function loadAffiliateOfferStep(step: Step, campaignId: string): Promise<AffiliateOfferResult | null> {
  const result = (await step.run('load-affiliate-offer', async () => {
    try {
      const db = createServerClient();
      const { data } = await db
        .from('affiliate_offers_selected')
        .select('short_code, offer_name, affiliate_link')
        .eq('campaign_id', campaignId)
        .single();
      const row = data as AffiliateOfferSelectedRow | null;
      if (!row) return null;
      const shortUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://sophia.agencyos.network'}/r/${row.short_code}`;
      return { productName: row.offer_name, shortUrl };
    } catch (error) {
      logger.warn('[generate-campaign] failed to load affiliate offer for campaign', { campaignId, error: String(error) });
      return null;
    }
  })) as AffiliateOfferResult | null;
  return result;
}

export interface ScriptStepParams {
  campaignId: string;
  userId: string;
  topic: string;
  audience: string;
  tier: Tier;
  resume?: boolean;
  resumeFrom?: string;
  affiliateOffer: AffiliateOfferResult | null;
  updateStatus: (status: string, progress: number, data?: Record<string, unknown>) => Promise<void>;
  checkpoint: (stepName: string) => Promise<void>;
}

export async function runScriptStep(params: ScriptStepParams): Promise<Record<string, unknown>> {
  const { campaignId, userId, topic, audience, tier, resume, resumeFrom, affiliateOffer, updateStatus, checkpoint } = params;
  if (resume && (resumeFrom === 'tts' || resumeFrom === 'video' || resumeFrom === 'finalize')) {
    const db = createServerClient();
    const { data: campaign } = await db.from('campaigns').select('script_content').eq('id', campaignId).single();
    const typed = campaign as { script_content: Record<string, unknown> | null } | null;
    if (!typed?.script_content) throw new Error('Cannot resume: script content not found');
    return typed.script_content;
  }
  await updateStatus('processing_script', 10);
  try {
    const scriptService = await ServiceFactory.getScriptService(userId);
    const resolvedOrgId = (await resolveOrgId(userId)) ?? userId;
    const result = await scriptService.generateScript({
      topic,
      audience,
      tier,
      orgId: resolvedOrgId,
      userId,
      affiliateOffer: affiliateOffer ?? undefined,
    });
    await updateStatus('processing_script', 35, { script_content: result });
    await checkpoint('generate-script');
    return result as unknown as Record<string, unknown>;
  } catch (err) {
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
}

export interface VoiceoverStepParams {
  campaignId: string;
  userId: string;
  tier: Tier;
  resume?: boolean;
  resumeFrom?: string;
  script: Record<string, unknown>;
  updateStatus: (status: string, progress: number, data?: Record<string, unknown>) => Promise<void>;
  notifyUser: (msg: string) => Promise<void>;
  checkpoint: (stepName: string) => Promise<void>;
}

export async function runVoiceoverStep(params: VoiceoverStepParams): Promise<string> {
  const { campaignId, userId, tier, resume, resumeFrom, script, updateStatus, notifyUser, checkpoint } = params;
  if (resume && (resumeFrom === 'video' || resumeFrom === 'finalize')) {
    const db = createServerClient();
    const { data: campaign } = await db.from('campaigns').select('audio_url').eq('id', campaignId).single();
    const typed = campaign as { audio_url: string | null } | null;
    if (!typed?.audio_url) throw new Error('Cannot resume: audio URL not found');
    return typed.audio_url;
  }
  const scriptData = script as unknown as { scenes: Array<{ narration: string }> };
  const fullNarration = scriptData.scenes.map((s) => s.narration).join(' ');
  await updateStatus('processing_script', 45);
  if (!resume) await notifyUser('📝 Script ready! Now generating voiceover...');
  try {
    const voiceService = await ServiceFactory.getVoiceService(userId);
    const voiceoverResult = await voiceService.generateVoiceover({ text: fullNarration, tier, userId });
    await updateStatus('processing_script', 60, { audio_url: voiceoverResult.audio_url });
    await checkpoint('generate-voiceover');
    return voiceoverResult.audio_url;
  } catch (err) {
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
}
