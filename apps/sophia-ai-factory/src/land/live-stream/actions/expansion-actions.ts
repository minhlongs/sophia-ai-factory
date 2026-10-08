/**
 * @file expansion-actions.ts
 * @description Authenticated Server Actions for Flash-Sale, Competitor Outreach & Split-Test Attribution
 * @layer land
 */

'use server';

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { inngest } from '@/seed/inngest/client';
import { logger } from '@/seed/utils/logger-utility';

export async function triggerLiveSurgeVoucherAction(input: {
  sessionId: string;
  offerId: string;
  currentViewers: number;
  surgePercentage: number;
  remainingStock: number;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user?.id) return { success: false, error: 'Unauthorized' };

    await inngest.send({
      name: 'live.stream.stock.surge.detected',
      data: input,
    });

    return { success: true };
  } catch (err) {
    logger.error('Failed to trigger live surge voucher', { err });
    return { success: false, error: 'Failed to trigger voucher' };
  }
}

export async function dispatchCompetitorLeadAction(input: {
  competitorChannel: string;
  targetVideoId: string;
  commentAuthorId: string;
  commentText: string;
  intentScore: number;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user?.id) return { success: false, error: 'Unauthorized' };

    await inngest.send({
      name: 'competitor.lead.discovered',
      data: input,
    });

    return { success: true };
  } catch (err) {
    logger.error('Failed to dispatch competitor lead', { err });
    return { success: false, error: 'Failed to dispatch lead' };
  }
}

export async function requestSplitTestEvaluationAction(input: {
  experimentId: string;
  campaignId: string;
  variantAViews: number;
  variantAConversions: number;
  variantBViews: number;
  variantBConversions: number;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user?.id) return { success: false, error: 'Unauthorized' };

    await inngest.send({
      name: 'video.splittest.evaluation.requested',
      data: input,
    });

    return { success: true };
  } catch (err) {
    logger.error('Failed to request split test evaluation', { err });
    return { success: false, error: 'Failed to request evaluation' };
  }
}
