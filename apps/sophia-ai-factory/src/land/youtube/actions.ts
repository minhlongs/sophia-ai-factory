/**
 * YouTube content pipeline server actions.
 * createChannelConfig, getChannelConfig, scheduleContent, triggerContentPipeline.
 * Auth via getCurrentUser(); DB via createServerClient() (sync, no await).
 * @module land/youtube/actions
 */

'use server';

import { z } from 'zod';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import { success, failure, type Result } from '@/seed/types/result';
import { createChannelConfig, getChannelConfig, getChannelConfigById } from './channel-config';
import { type CreateChannelConfigInput } from './channel-config-types';
import { createCalendarEntry, evaluateFrequency, type CreateCalendarEntryInput } from './content-calendar';
import { inngest } from '@/seed/inngest/client';

// ── Zod schemas ──────────────────────────────────────────────────────────────

const CadenceSchema = z.enum(['daily', 'every-2-days', '3-per-week', 'weekly']);

const CreateChannelConfigSchema = z.object({
  channelId: z.string().min(1, 'channelId is required'),
  channelTitle: z.string().max(255).optional(),
  objective: z.string().min(1, 'objective is required').max(500),
  audience: z.string().min(1, 'audience is required').max(500),
  contentPillars: z.array(z.string().min(1)).min(1, 'at least one content pillar required'),
  cadence: CadenceSchema,
  postsPerWeek: z.number().int().positive().optional(),
  guardrails: z.string().max(2000).optional(),
  contentBufferDays: z.number().int().min(0).optional(),
  autonomyLevel: z.number().int().min(0).max(5).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const ScheduleContentSchema = z.object({
  channelConfigId: z.string().min(1, 'channelConfigId is required'),
  title: z.string().min(1, 'title is required').max(200),
  topic: z.string().max(500).optional(),
  contentType: z.string().max(100).optional(),
  scheduledAt: z.string().datetime('scheduledAt must be a valid ISO datetime'),
  notes: z.string().max(2000).optional(),
});

export type CreateChannelConfigActionInput = z.infer<typeof CreateChannelConfigSchema>;
export type ScheduleContentActionInput = z.infer<typeof ScheduleContentSchema>;

export type ChannelConfigActionError =
  | { code: 'UNAUTHENTICATED'; message: string }
  | { code: 'VALIDATION_ERROR'; message: string }
  | { code: 'DB_ERROR'; message: string }
  | { code: 'REPO_ERROR'; message: string; details?: string };

export type ScheduleContentActionError =
  | { code: 'UNAUTHENTICATED'; message: string }
  | { code: 'VALIDATION_ERROR'; message: string }
  | { code: 'DB_ERROR'; message: string }
  | { code: 'REPO_ERROR'; message: string; details?: string };

export type TriggerPipelineActionError =
  | { code: 'UNAUTHENTICATED'; message: string }
  | { code: 'VALIDATION_ERROR'; message: string }
  | { code: 'DB_ERROR'; message: string }
  | { code: 'REPO_ERROR'; message: string; details?: string };

function formatZodError(err: z.ZodError): string {
  return err.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
}

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
    channelId: parsed.data.channelId,
    channelTitle: parsed.data.channelTitle,
    objective: parsed.data.objective,
    audience: parsed.data.audience,
    contentPillars: parsed.data.contentPillars,
    cadence: parsed.data.cadence,
    postsPerWeek: parsed.data.postsPerWeek,
    guardrails: parsed.data.guardrails,
    contentBufferDays: parsed.data.contentBufferDays,
    autonomyLevel: parsed.data.autonomyLevel,
    metadata: parsed.data.metadata,
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
    channelConfigId: parsed.data.channelConfigId,
    title: parsed.data.title,
    topic: parsed.data.topic,
    contentType: parsed.data.contentType,
    scheduledAt: parsed.data.scheduledAt,
    notes: parsed.data.notes,
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