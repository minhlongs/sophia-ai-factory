/**
 * YouTube content pipeline server actions.
 * createChannelConfig, getChannelConfig, scheduleContent, triggerContentPipeline.
 * Auth via getCurrentUser(); DB via createServerClient() (sync, no await).
 * @module land/youtube/actions
 */

'use server';

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import { success, failure, type Result } from '@/seed/types/result';
import { createChannelConfig, getChannelConfig, getChannelConfigById } from './channel-config';
import { type CreateChannelConfigInput } from './channel-config-types';
import { createCalendarEntry, evaluateFrequency, type CreateCalendarEntryInput } from './content-calendar';
import { inngest } from '@/seed/inngest/client';
import {
  CreateChannelConfigSchema,
  ScheduleContentSchema,
  formatZodError,
  type CreateChannelConfigActionInput,
  type ScheduleContentActionInput,
  type ChannelConfigActionError,
  type ScheduleContentActionError,
  type TriggerPipelineActionError,
} from './actions-schemas';

export type {
  CreateChannelConfigActionInput,
  ScheduleContentActionInput,
  ChannelConfigActionError,
  ScheduleContentActionError,
  TriggerPipelineActionError,
} from './actions-schemas';

// ── Actions ──────────────────────────────────────────────────────────────────

/** Create a channel config for the current user. */
export async function createChannelConfigAction(
  input: CreateChannelConfigActionInput,
): Promise<Result<{ configId: string }, ChannelConfigActionError>> {
  const user = await getCurrentUser();
  if (!user) return failure({ code: 'UNAUTHENTICATED', message: 'You must be signed in' });

  const parsed = CreateChannelConfigSchema.safeParse(input);
  if (!parsed.success) return failure({ code: 'VALIDATION_ERROR', message: formatZodError(parsed.error) });

  const payload: CreateChannelConfigInput = {
    userId: user.id,
    ...parsed.data,
  };

  const result = await createChannelConfig(payload);
  if (!result.success) return failure({ code: 'REPO_ERROR', message: result.error, details: toError(result.error).message });
  return success({ configId: result.config.id });
}

/** Get the channel config for the current user + channel. */
export async function getChannelConfigAction(
  channelId: string,
): Promise<Result<{ config: unknown }, ChannelConfigActionError>> {
  const user = await getCurrentUser();
  if (!user) return failure({ code: 'UNAUTHENTICATED', message: 'You must be signed in' });

  if (!channelId || typeof channelId !== 'string') {
    return failure({ code: 'VALIDATION_ERROR', message: 'channelId is required' });
  }

  try {
    const config = await getChannelConfig(user.id, channelId);
    return success({ config });
  } catch (err) {
    logger.error('getChannelConfigAction failed', toError(err), { userId: user.id, channelId });
    return failure({ code: 'DB_ERROR', message: 'Failed to load channel config', details: toError(err).message });
  }
}

/** Schedule a content slot for the current user. */
export async function scheduleContentAction(
  input: ScheduleContentActionInput,
): Promise<Result<{ entryId: string }, ScheduleContentActionError>> {
  const user = await getCurrentUser();
  if (!user) return failure({ code: 'UNAUTHENTICATED', message: 'You must be signed in' });

  const parsed = ScheduleContentSchema.safeParse(input);
  if (!parsed.success) return failure({ code: 'VALIDATION_ERROR', message: formatZodError(parsed.error) });

  const payload: CreateCalendarEntryInput = {
    userId: user.id,
    ...parsed.data,
  };

  const result = await createCalendarEntry(payload);
  if (!result.success) return failure({ code: 'REPO_ERROR', message: result.error, details: toError(result.error).message });
  return success({ entryId: result.entry.id });
}

/** Trigger the content pipeline for a channel config (best-effort Inngest emit). */
export async function triggerContentPipelineAction(
  input: { channelConfigId: string; topic?: string; now?: Date },
): Promise<Result<{ triggered: boolean; reason?: string }, TriggerPipelineActionError>> {
  const user = await getCurrentUser();
  if (!user) return failure({ code: 'UNAUTHENTICATED', message: 'You must be signed in' });

  if (!input.channelConfigId || typeof input.channelConfigId !== 'string') {
    return failure({ code: 'VALIDATION_ERROR', message: 'channelConfigId is required' });
  }

  try {
    const config = await getChannelConfigById(input.channelConfigId, user.id);
    if (!config) return failure({ code: 'REPO_ERROR', message: 'Channel config not found or access denied' });

    const freq = await evaluateFrequency({
      userId: user.id,
      channelConfigId: input.channelConfigId,
      cadence: config.cadence,
      postsPerWeek: config.postsPerWeek,
      bufferDays: config.contentBufferDays,
      now: input.now,
    });

    if (!freq.shouldGenerate) {
      return success({ triggered: false, reason: freq.reason });
    }

    // Emit Inngest event (best-effort — pipeline may be triggered async).
    try {
      await inngest.send({
        name: 'youtube.content.pipeline.requested',
        data: {
          userId: user.id,
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
    logger.error('triggerContentPipelineAction failed', toError(err), { userId: user.id, channelConfigId: input.channelConfigId });
    return failure({ code: 'REPO_ERROR', message: 'Failed to trigger pipeline', details: toError(err).message });
  }
}