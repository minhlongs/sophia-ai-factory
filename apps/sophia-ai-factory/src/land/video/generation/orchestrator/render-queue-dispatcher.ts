import { createServerClient } from '@/seed/db/client';
import { ServiceFactory } from '@/land/services/factory';
import { resolveOrgId } from '@/seed/auth/resolve-org-id';
import type { Tier } from '@/seed/types';
import type { AffiliateOfferResult } from './types';
import { handleStepProviderError } from './render-queue-dispatcher-helpers';

export {
  handleStepProviderError,
  loadAffiliateOfferStep,
  runVideoGenStep,
  type VideoGenStepParams,
} from './render-queue-dispatcher-helpers';

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
    return handleStepProviderError(err, userId, campaignId);
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
    return handleStepProviderError(err, userId, campaignId);
  }
}
