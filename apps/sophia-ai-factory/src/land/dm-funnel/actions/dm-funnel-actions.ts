/**
 * @file dm-funnel-actions.ts
 * @description Authenticated Server Actions for Comment Triggers & Leads
 * @layer land
 */

'use server';

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { inngest } from '@/seed/inngest/client';
import { logger } from '@/seed/utils/logger-utility';
import { listRecentDmLeads } from '@/tree/dm-funnel/lead-attribution-store';
import type { DmLead, CommentTriggerInput } from '@/seed/types/live-stream-newsjack-dm-types';

export async function processCommentTriggerAction(
  input: CommentTriggerInput,
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user?.id) return { success: false, error: 'Unauthorized' };

    await inngest.send({
      name: 'comment.dm.dispatch.triggered',
      data: {
        platform: input.platform,
        platformUserId: input.platformUserId,
        commentText: input.commentText,
        sourceVideoId: input.sourceVideoId,
        sourceCommentId: input.sourceCommentId,
        targetOfferId: input.targetOfferId,
      },
    });

    return { success: true };
  } catch (err) {
    logger.error('Failed to trigger comment dm dispatch', { err });
    return { success: false, error: 'Failed to process comment' };
  }
}

export async function fetchRecentLeadsAction(
  limit = 20,
): Promise<{ success: boolean; data?: DmLead[]; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user?.id) return { success: false, error: 'Unauthorized' };

    const leads = await listRecentDmLeads(limit);
    return { success: true, data: leads };
  } catch (err) {
    logger.error('Failed to fetch dm leads', { err });
    return { success: false, error: 'Failed to fetch leads' };
  }
}
