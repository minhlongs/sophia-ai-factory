/**
 * YouTube Content Pipeline Trigger Helper
 * Evaluates channel frequency cadence and emits best-effort Inngest event.
 * @module land/youtube/trigger-pipeline-helper
 */

import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import { success, failure, type Result } from '@/seed/types/result';
import { inngest } from '@/seed/inngest/client';
import { getChannelConfigById } from './channel-config';
import { evaluateFrequency } from './content-calendar';
import type { TriggerPipelineActionError } from './actions-schemas';

export async function executeTriggerContentPipeline(
  userId: string,
  input: { channelConfigId: string; topic?: string; now?: Date },
): Promise<Result<{ triggered: boolean; reason?: string }, TriggerPipelineActionError>> {
  try {
    const config = await getChannelConfigById(input.channelConfigId, userId);
    if (!config) {
      return failure({ code: 'REPO_ERROR', message: 'Channel config not found or access denied' });
    }

    const freq = await evaluateFrequency({
      userId,
      channelConfigId: input.channelConfigId,
      cadence: config.cadence,
      postsPerWeek: config.postsPerWeek,
      bufferDays: config.contentBufferDays,
      now: input.now,
    });

    if (!freq.shouldGenerate) {
      return success({ triggered: false, reason: freq.reason });
    }

    try {
      await inngest.send({
        name: 'youtube.content.pipeline.requested',
        data: {
          userId,
          channelConfigId: input.channelConfigId,
          topic: input.topic ?? null,
          requestedAt: Date.now(),
        },
      });
    } catch (emitErr) {
      logger.warn('triggerContentPipelineAction: inngest emit failed (non-fatal)', {
        error: toError(emitErr).message,
        channelConfigId: input.channelConfigId,
      });
    }

    return success({ triggered: true });
  } catch (err) {
    logger.error('triggerContentPipelineAction failed', toError(err), {
      userId,
      channelConfigId: input.channelConfigId,
    });
    return failure({
      code: 'REPO_ERROR',
      message: 'Failed to trigger pipeline',
      details: toError(err).message,
    });
  }
}
