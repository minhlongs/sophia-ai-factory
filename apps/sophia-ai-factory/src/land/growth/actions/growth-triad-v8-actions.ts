/**
 * @file growth-triad-v8-actions.ts
 * @description Next.js 14 Server Actions for Growth Triad v8 Trigger Dispatching
 * @layer land
 */

'use server';

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { inngest } from '@/seed/inngest/client';
import { failure, success, type Result } from '@/seed/types/result';

export async function dispatchAudioResonance(
  audioTrackId: string,
  bpm: number,
  candidateCuts: number[]
): Promise<Result<{ dispatched: true }, { code: string; message: string }>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return failure({ code: 'UNAUTHORIZED', message: 'You must be logged in to dispatch audio resonance' });
    }

    // Dispatch to Inngest for async processing
    await inngest.send({
      name: 'audio.resonance.synced',
      data: {
        audioTrackId,
        bpm,
        resonanceScore: 0, // Placeholder, core logic in forest worker
        syncQuality: 'PENDING',
      }
    });

    return success({ dispatched: true });
  } catch (err: any) {
    return failure({ code: 'SERVER_ERROR', message: err instanceof Error ? err.message : 'Failed to dispatch audio resonance sync' });
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

    const campaignId = `cbait_${videoId}_${Date.now()}`;

    await inngest.send({
      name: 'community.bait.generated',
      data: {
        videoId,
        campaignId,
        primaryHookQuestion: campaignTopic, // Will be replaced by actual engine in forest
        curiosityGapScore: 0 // Will be computed in the background
      }
    });

    return success({ dispatched: true });
  } catch (err: any) {
    return failure({ code: 'SERVER_ERROR', message: err instanceof Error ? err.message : 'Failed to dispatch community bait generator' });
  }
}

export async function dispatchCohortLtvEvaluation(
  cohortMonth: string,
  initialSubscribers: number
): Promise<Result<{ dispatched: true }, { code: string; message: string }>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return failure({ code: 'UNAUTHORIZED', message: 'You must be logged in to compute cohort LTV' });
    }

    await inngest.send({
      name: 'subscriber.cohort.evaluated',
      data: {
        cohortMonth,
        cumulativeLtvUsd: 0, // Will be computed
        hazardPeakMonth: 0   // Will be computed
      }
    });

    return success({ dispatched: true });
  } catch (err: any) {
    return failure({ code: 'SERVER_ERROR', message: err instanceof Error ? err.message : 'Failed to dispatch cohort LTV evaluation' });
  }
}
