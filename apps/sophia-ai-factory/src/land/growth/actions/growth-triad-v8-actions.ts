/**
 * @file growth-triad-v8-actions.ts
 * @description Next.js 14 Server Actions for Growth Triad v8 Trigger Dispatching
 * @layer land
 */

'use server';

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { enforceCommercialFeatureForUser } from '@/seed/config/enforce-commercial-feature-server';
import { inngest } from '@/seed/inngest/client';
import { failure, success, type Result } from '@/seed/types/result';
import { logger } from '@/seed/utils/logger-utility';

export async function dispatchAudioResonance(
  audioTrackId: string,
  bpm: number,
  _candidateCuts: number[]
): Promise<Result<{ dispatched: true }, { code: string; message: string }>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return failure({ code: 'UNAUTHORIZED', message: 'You must be logged in to dispatch audio resonance' });
    }

    const gate = await enforceCommercialFeatureForUser(user.id, 'growth_triad_bandit_kelly');
    if (!gate.ok) {
      return failure({ code: 'FEATURE_LOCKED', message: gate.error.message });
    }

    await inngest.send({
      name: 'audio.resonance.synced',
      data: {
        audioTrackId,
        bpm,
        resonanceScore: 0,
        syncQuality: 'PENDING',
      },
    });

    return success({ dispatched: true });
  } catch (err: unknown) {
    logger.error('[growth-triad-v8-actions] dispatchAudioResonance failed', err instanceof Error ? err : undefined);
    return failure({ code: 'SERVER_ERROR', message: 'Failed to dispatch audio resonance sync' });
  }
}

export async function dispatchCommunityBait(
  videoId: string,
  campaignTopic: string
): Promise<Result<{ dispatched: true }, { code: string; message: string }>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return failure({ code: 'UNAUTHORIZED', message: 'You must be logged in to generate viral bait' });
    }

    const gate = await enforceCommercialFeatureForUser(user.id, 'growth_triad_bandit_kelly');
    if (!gate.ok) {
      return failure({ code: 'FEATURE_LOCKED', message: gate.error.message });
    }

    const campaignId = `cbait_${videoId}_${Date.now()}`;

    await inngest.send({
      name: 'community.bait.generated',
      data: {
        videoId,
        campaignId,
        primaryHookQuestion: campaignTopic,
        curiosityGapScore: 0,
      },
    });

    return success({ dispatched: true });
  } catch (err: unknown) {
    logger.error('[growth-triad-v8-actions] dispatchCommunityBait failed', err instanceof Error ? err : undefined);
    return failure({ code: 'SERVER_ERROR', message: 'Failed to dispatch community bait generator' });
  }
}

export async function dispatchCohortLtvEvaluation(
  cohortMonth: string,
  _initialSubscribers: number
): Promise<Result<{ dispatched: true }, { code: string; message: string }>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return failure({ code: 'UNAUTHORIZED', message: 'You must be logged in to compute cohort LTV' });
    }

    const gate = await enforceCommercialFeatureForUser(user.id, 'growth_triad_bandit_kelly');
    if (!gate.ok) {
      return failure({ code: 'FEATURE_LOCKED', message: gate.error.message });
    }

    await inngest.send({
      name: 'subscriber.cohort.evaluated',
      data: {
        cohortMonth,
        cumulativeLtvUsd: 0,
        hazardPeakMonth: 0,
      },
    });

    return success({ dispatched: true });
  } catch (err: unknown) {
    logger.error('[growth-triad-v8-actions] dispatchCohortLtvEvaluation failed', err instanceof Error ? err : undefined);
    return failure({ code: 'SERVER_ERROR', message: 'Failed to dispatch cohort LTV evaluation' });
  }
}
