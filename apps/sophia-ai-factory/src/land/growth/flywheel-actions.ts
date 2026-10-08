/**
 * Land Layer: Growth Flywheel Server Actions
 * Authenticated Server Actions for managing autonomous hook reseeding and viewing telemetry.
 * Layer: land/growth | Max LOC: < 200 | Zero :any
 * @module land/growth/flywheel-actions
 */

'use server';

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { success, failure, type Result } from '@/seed/types/result';
import { inngest } from '@/seed/inngest/client';
import { getFlywheelSummaryStats, updateReseedJobStatus } from './flywheel-coordinator';
import type { FlywheelSummaryStats } from '@/seed/types/growth-triad-v12';

export interface FlywheelActionError {
  code: 'UNAUTHORIZED' | 'NOT_FOUND' | 'INTERNAL_ERROR';
  message: string;
}

export async function getFlywheelStatsAction(): Promise<
  Result<FlywheelSummaryStats, FlywheelActionError>
> {
  const user = await getCurrentUser();
  if (!user?.id) {
    return failure({ code: 'UNAUTHORIZED', message: 'User must be authenticated' });
  }

  try {
    const stats = await getFlywheelSummaryStats(user.id);
    return success(stats);
  } catch {
    return failure({ code: 'INTERNAL_ERROR', message: 'Failed to retrieve stats' });
  }
}

export interface TriggerReseedInput {
  jobId: string;
  sourceJobId: string;
  channelId: string;
  platform: 'YOUTUBE_SHORTS' | 'TIKTOK_V2' | 'INSTAGRAM_REELS';
  originalHook: string;
  mutatedHooks: string[];
}

export async function triggerManualReseedAction(
  input: TriggerReseedInput,
): Promise<Result<{ status: string }, FlywheelActionError>> {
  const user = await getCurrentUser();
  if (!user?.id) {
    return failure({ code: 'UNAUTHORIZED', message: 'User must be authenticated' });
  }

  try {
    await updateReseedJobStatus(input.jobId, 'PENDING');

    await inngest.send({
      name: 'growth/v12.reseed.trigger',
      data: {
        userId: user.id,
        sourceJobId: input.sourceJobId,
        channelId: input.channelId,
        platform: input.platform,
        originalHook: input.originalHook,
        retentionZScore: 2.0,
        classification: 'ALPHA_VIRAL',
        mutatedHooks: input.mutatedHooks,
      },
    });

    return success({ status: 'TRIGGERED' });
  } catch {
    return failure({ code: 'INTERNAL_ERROR', message: 'Failed to dispatch manual reseed' });
  }
}
