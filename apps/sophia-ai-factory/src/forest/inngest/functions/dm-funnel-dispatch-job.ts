/**
 * @file dm-funnel-dispatch-job.ts
 * @description Inngest background job dispatching conversational closer actions
 * @layer forest
 */

import { inngest } from '@/seed/inngest/client';
import { matchCommentIntent } from '@/tree/dm-funnel/comment-intent-matcher';
import { insertDmLead } from '@/tree/dm-funnel/lead-attribution-store';

export const dmFunnelDispatchJob = inngest.createFunction(
  { id: 'dm-funnel-dispatch-job', name: 'Comment-to-DM Funnel Dispatch Job' },
  { event: 'comment.dm.dispatch.triggered' },
  async ({ event, step }) => {
    const { platform, platformUserId, commentText, sourceVideoId, sourceCommentId, targetOfferId } = event.data;

    const intent = await step.run('evaluate-intent', async () => {
      return matchCommentIntent(commentText);
    });

    if (!intent.isIntentDetected) {
      return { skipped: true, reason: 'NO_INTENT_DETECTED' };
    }

    const leadId = `lead_${platform}_${platformUserId.slice(0, 8)}_${Date.now()}`;

    await step.run('create-or-update-lead', async () => {
      await insertDmLead({
        id: leadId,
        platform,
        platformUserId,
        platformUsername: undefined,
        sourceVideoId: sourceVideoId ?? undefined,
        sourceCommentId: sourceCommentId ?? undefined,
        initialIntent: intent.matchedKeyword ?? undefined,
        funnelState: 'QUALIFIED',
        assignedOfferId: targetOfferId ?? undefined,
        leadScore: intent.priorityScore,
        optedOut: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      return { leadId, state: 'QUALIFIED' };
    });

    return {
      success: true,
      leadId,
      matchedKeyword: intent.matchedKeyword,
    };
  },
);
