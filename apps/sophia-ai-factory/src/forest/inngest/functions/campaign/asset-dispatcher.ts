import { logger } from '@/seed/utils/logger-utility';
import { captureServer } from '@/forest/telemetry/posthog-capture';
import { Events } from '@/forest/telemetry/event-types';
import { startVideoGeneration } from '@/seed/ai/video-generator';
import type { ScriptOutput } from '@/seed/ai/script-generator';
import { NonRetriableError } from 'inngest';
import type { Tier } from '@/seed/types';
import type { StatusUpdater, UserNotifier, ProviderErrorNotifier } from './types';
import {
  getD1ForWebhooks,
  createDistributionGateway,
  type DistributeParams,
  runDistribution,
} from './distribution-gateway';
import { runPollVideo, type PollVideoParams } from './video-poller-runner';

export {
  getD1ForWebhooks,
  createDistributionGateway,
  type DistributeParams,
  runDistribution,
  runPollVideo,
  type PollVideoParams,
};

export interface StartVideoParams {
  campaignId: string;
  userId: string;
  tier: Tier;
  resume?: boolean;
  resumeFrom?: string;
  script: ScriptOutput;
  updateStatus: StatusUpdater;
  notifyUser: UserNotifier;
  notifyRefundRequired: (userId: string, campaignId: string, key: string) => Promise<void>;
  notifyProviderError: ProviderErrorNotifier;
}

export async function runStartVideo(params: StartVideoParams): Promise<string | null> {
  const {
    campaignId,
    userId,
    tier,
    resume,
    resumeFrom,
    script,
    updateStatus,
    notifyUser,
    notifyRefundRequired,
    notifyProviderError,
  } = params;
  if (resume && resumeFrom === 'finalize') return null;
  await updateStatus('processing_video', 70);
  if (!resume) await notifyUser('🎤 Voiceover ready! Now rendering video...');

  try {
    const {
      MissingCredentialsError,
      ProviderQuotaExceededError,
      ProviderInvalidKeyError,
    } = await import('@/land/services/errors');
    try {
      const jobId = await startVideoGeneration({ script, tier, userId });
      void captureServer({
        event: Events.FIRST_VIDEO_STARTED,
        distinctId: userId,
        source: 'server',
        properties: { campaign_id: campaignId, tier },
      }).catch((err) => {
        logger.warn('[generateCampaign] capture first_video_started failed', { error: String(err) });
      });
      return jobId;
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
