/**
 * @file newsjacking-actions.ts
 * @description Authenticated Server Actions for Newsjacking Signals & Fast-Track Pipelines
 * @layer land
 */

'use server';

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { inngest } from '@/seed/inngest/client';
import { createServerClient } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import type { NewsjackSignal, TrendSource } from '@/seed/types/live-stream-newsjack-dm-types';

export async function createNewsjackSignalAction(
  trendTopic: string,
  trendSource: TrendSource,
  viralityScore: number,
  pairedOfferId?: string | null,
): Promise<{ success: boolean; signal?: NewsjackSignal; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user?.id) return { success: false, error: 'Unauthorized' };

    const signalId = `signal_${Date.now()}`;
    const db = createServerClient();
    const now = Date.now();

    db.prepare(`
      INSERT INTO newsjack_signals (
        id, user_id, trend_topic, trend_source, virality_score,
        paired_offer_id, paired_similarity_score, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, 0.85, 'PENDING', ?)
    `).bind(
      signalId,
      user.id,
      trendTopic,
      trendSource,
      viralityScore,
      pairedOfferId ?? null,
      now,
    ).run();

    const signal: NewsjackSignal = {
      id: signalId,
      userId: user.id,
      trendTopic,
      trendSource,
      viralityScore,
      pairedOfferId: pairedOfferId ?? null,
      pairedSimilarityScore: 0.85,
      status: 'PENDING',
      generatedVideoJobId: null,
      createdAt: now,
    };

    return { success: true, signal };
  } catch (err) {
    logger.error('Failed to create newsjack signal', { err });
    return { success: false, error: 'Failed to record signal' };
  }
}

export async function triggerFastTrackNewsjackAction(
  signalId: string,
  trendTopic: string,
  pairedOfferId?: string | null,
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user?.id) return { success: false, error: 'Unauthorized' };

    await inngest.send({
      name: 'newsjacking.fasttrack.triggered',
      data: {
        userId: user.id,
        signalId,
        trendTopic,
        pairedOfferId,
      },
    });

    return { success: true };
  } catch (err) {
    logger.error('Failed to trigger fast track newsjack', { err });
    return { success: false, error: 'Failed to dispatch newsjack job' };
  }
}
