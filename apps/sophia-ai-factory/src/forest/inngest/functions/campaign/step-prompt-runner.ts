import { createServerClient } from '@/seed/db/client';
import { resolveOrgId } from '@/seed/auth/resolve-org-id';
import { NonRetriableError } from 'inngest';
import type { Tier } from '@/seed/types';
import type { AffiliateOfferResult, StatusUpdater, ProviderErrorNotifier, StepCheckpointer } from './types';

export interface GenerateScriptParams {
  campaignId: string;
  userId: string;
  topic: string;
  audience: string;
  tier: Tier;
  resume?: boolean;
  resumeFrom?: string;
  affiliateOffer: AffiliateOfferResult | null;
  updateStatus: StatusUpdater;
  checkpoint: StepCheckpointer;
  notifyRefundRequired: (userId: string, campaignId: string, key: string) => Promise<void>;
  notifyProviderError: ProviderErrorNotifier;
}

export async function runGenerateScript(params: GenerateScriptParams): Promise<Record<string, unknown>> {
  const { campaignId, userId, topic, audience, tier, resume, resumeFrom, affiliateOffer, updateStatus, checkpoint, notifyRefundRequired, notifyProviderError } = params;

  if (resume && (resumeFrom === 'tts' || resumeFrom === 'video' || resumeFrom === 'finalize')) {
    const db = createServerClient();
    const { data: campaign } = await db.from('campaigns').select('script_content').eq('id', campaignId).single();
    const typed = campaign as { script_content: Record<string, unknown> | null } | null;
    if (!typed?.script_content) throw new Error('Cannot resume: script content not found');
    return typed.script_content;
  }

  await updateStatus('processing_script', 10);
  try {
    const { ServiceFactory } = await import('@/land/services/factory');
    const { MissingCredentialsError, ProviderQuotaExceededError, ProviderInvalidKeyError } = await import('@/land/services/errors');
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
    } catch (innerErr) {
      if (innerErr instanceof MissingCredentialsError) {
        await notifyRefundRequired(userId, campaignId, innerErr.key);
        throw new NonRetriableError(`Missing AI credential: ${innerErr.key}`, { cause: innerErr });
      }
      if (innerErr instanceof ProviderQuotaExceededError) {
        await notifyProviderError(userId, campaignId, innerErr.service, 'quota', innerErr.message);
        throw new NonRetriableError(innerErr.message, { cause: innerErr });
      }
      if (innerErr instanceof ProviderInvalidKeyError) {
        await notifyProviderError(userId, campaignId, innerErr.service, 'key', innerErr.message);
        throw new NonRetriableError(innerErr.message, { cause: innerErr });
      }
      throw innerErr;
    }
  } catch (outerErr) {
    throw outerErr;
  }
}

export interface GenerateVoiceoverParams {
  campaignId: string;
  userId: string;
  tier: Tier;
  resume?: boolean;
  resumeFrom?: string;
  script: Record<string, unknown>;
  updateStatus: StatusUpdater;
  checkpoint: StepCheckpointer;
  notifyRefundRequired: (userId: string, campaignId: string, key: string) => Promise<void>;
  notifyProviderError: ProviderErrorNotifier;
  notifyUser: (msg: string) => Promise<void>;
}

export async function runGenerateVoiceover(params: GenerateVoiceoverParams): Promise<string> {
  const { campaignId, userId, tier, resume, resumeFrom, script, updateStatus, checkpoint, notifyRefundRequired, notifyProviderError, notifyUser } = params;

  if (resume && (resumeFrom === 'video' || resumeFrom === 'finalize')) {
    const db = createServerClient();
    const { data: campaign } = await db.from('campaigns').select('audio_url').eq('id', campaignId).single();
    const typed = campaign as { audio_url: string | null } | null;
    if (!typed?.audio_url) throw new Error('Cannot resume: audio URL not found');
    return typed.audio_url;
  }

  const scriptData = script as unknown as { scenes: Array<{ narration: string }> };
  const fullNarration = scriptData.scenes.map(s => s.narration).join(' ');
  await updateStatus('processing_script', 45);
  if (!resume) await notifyUser('📝 Script ready! Now generating voiceover...');

  try {
    const { ServiceFactory } = await import('@/land/services/factory');
    const { MissingCredentialsError, ProviderQuotaExceededError, ProviderInvalidKeyError } = await import('@/land/services/errors');
    try {
      const voiceService = await ServiceFactory.getVoiceService(userId);
      const voiceoverResult = await voiceService.generateVoiceover({ text: fullNarration, tier, userId });
      await updateStatus('processing_script', 60, { audio_url: voiceoverResult.audio_url });
      await checkpoint('generate-voiceover');
      return voiceoverResult.audio_url;
    } catch (innerErr) {
      if (innerErr instanceof MissingCredentialsError) {
        await notifyRefundRequired(userId, campaignId, innerErr.key);
        throw new NonRetriableError(`Missing AI credential: ${innerErr.key}`, { cause: innerErr });
      }
      if (innerErr instanceof ProviderQuotaExceededError) {
        await notifyProviderError(userId, campaignId, innerErr.service, 'quota', innerErr.message);
        throw new NonRetriableError(innerErr.message, { cause: innerErr });
      }
      if (innerErr instanceof ProviderInvalidKeyError) {
        await notifyProviderError(userId, campaignId, innerErr.service, 'key', innerErr.message);
        throw new NonRetriableError(innerErr.message, { cause: innerErr });
      }
      throw innerErr;
    }
  } catch (outerErr) {
    throw outerErr;
  }
}
