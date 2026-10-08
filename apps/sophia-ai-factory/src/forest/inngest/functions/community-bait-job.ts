/**
 * @file community-bait-job.ts
 * @description Inngest background job for Pillar 2: Community Viral Bait Campaign Generator
 * @layer forest
 */

import { inngest } from '@/seed/inngest/client';
import { NonRetriableError } from 'inngest';
import { createServerClient } from '@/seed/db/client';
import { invalidateQuotaCache } from '@/seed/kv/quota-cache-ops';
import { recordSuccess, recordFailure, shouldAllowRequest } from '@/seed/security/circuit-breaker';
import { FailureKind } from '@/seed/types/failure-kind';

export const submitCommunityBaitJob = inngest.createFunction(
  {
    id: 'community-bait-job',
    name: 'Growth Triad v8 - Community Viral Bait Generator',
    retries: 3,
  },
  { event: 'community.bait.generated' },
  async ({ event, step }) => {
    const { videoId, campaignId, primaryHookQuestion, curiosityGapScore } = event.data;

    if (!videoId || !campaignId) {
      throw new NonRetriableError('Missing critical fields (videoId, campaignId)');
    }

    // Step 1: Simulated moderation check with circuit breaker
    await step.run('moderation-check', async () => {
      const allowed = await shouldAllowRequest('content-moderation-api');
      if (!allowed) {
        throw new Error('Circuit breaker open for content-moderation-api');
      }

      try {
        await new Promise((resolve) => setTimeout(resolve, 30));
        await recordSuccess('content-moderation-api');
      } catch (error) {
        await recordFailure('content-moderation-api', FailureKind.SERVER_ERROR);
        throw error;
      }
    });

    // Step 2: Persist generated campaign to D1 synchronously
    await step.run('persist-community-bait-campaign', async () => {
      const db = createServerClient();

      const insertQuery = `
        INSERT INTO community_bait_campaigns (campaign_id, video_id, primary_hook_question, curiosity_gap_score)
        VALUES (?, ?, ?, ?)
      `;

      try {
        const stmt = db.prepare(insertQuery).bind(
          campaignId,
          videoId,
          primaryHookQuestion,
          curiosityGapScore
        );
        await stmt.run();
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        throw new Error(`Failed to insert community_bait_campaigns record: ${msg}`);
      }
    });

    // Step 3: Clear quota cache
    await step.run('invalidate-campaign-quota', async () => {
      await invalidateQuotaCache(`user_campaigns_${campaignId}`, 'bait_generation');
    });

    return {
      status: 'completed',
      campaignId,
      videoId,
      processedAt: new Date().toISOString()
    };
  }
);
