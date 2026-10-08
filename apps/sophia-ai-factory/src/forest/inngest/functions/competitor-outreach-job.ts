/**
 * @file competitor-outreach-job.ts
 * @description Background job processing discovered competitor leads and dispatching conversational outreach
 * @layer forest
 */

import { inngest } from '@/seed/inngest/client';
import { evaluateCompetitorOutreach } from '@/tree/dm-funnel/competitor-outreach-engine';

export const competitorOutreachJob = inngest.createFunction(
  { id: 'competitor-outreach-job', name: 'Competitor Lead Prospecting & Outreach Job' },
  { event: 'competitor.lead.discovered' },
  async ({ event, step }) => {
    const { competitorChannel, targetVideoId, commentAuthorId, commentText, intentScore } = event.data;

    const evaluation = await step.run('evaluate-outreach-opportunity', async () => {
      return evaluateCompetitorOutreach({
        commentText,
        authorUsername: commentAuthorId,
        competitorTopic: competitorChannel,
        targetOfferName: 'Sản Phẩm Độc Quyền Sophia Deal',
      });
    });

    if (!evaluation.isEligibleForOutreach) {
      return { skipped: true, reason: evaluation.complianceWarning ?? 'NOT_ELIGIBLE' };
    }

    return {
      success: true,
      targetVideoId,
      commentAuthorId,
      intentScore,
      outreachMessage: evaluation.outreachMessage,
      intentType: evaluation.detectedIntentType,
    };
  },
);
