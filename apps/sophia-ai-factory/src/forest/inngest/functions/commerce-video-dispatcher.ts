/**
 * Commerce Video Batch Dispatcher Background Inngest Function
 *
 * Consumes product batches from catalog sync, checks pre-flight quota,
 * and triggers autonomous video creative missions with telemetry emission.
 *
 * Layer: forest (infrastructure orchestrator)
 * @module forest/inngest/functions/commerce-video-dispatcher
 */

import { inngest } from '@/seed/inngest/client';
import { triggerProductVideoMission } from '@/land/commerce/mission-trigger';
import { emitMissionCostRecorded } from '@/tree/performance';
import { logger } from '@/seed/utils/logger-utility';
import { checkMissionQuota } from '@/tree/quota/mission-quota';
import type { UnifiedProductItem } from '@/seed/types/ecommerce';

// Estimated creative pipeline costs in cents ($0.75 per video)
const ESTIMATED_VIDEO_COST_CENTS = 75;

export const commerceVideoBatchDispatcher = inngest.createFunction(
  {
    id: 'commerce-video-batch-dispatcher',
    retries: 2,
    concurrency: { key: 'event.data.workspaceId', limit: 2 },
  },
  { event: 'commerce/video.batch.dispatch.requested' },
  async ({ event, step }) => {
    const { batchId, workspaceId, storeHost, products, autonomyLevel = 1 } = event.data;

    // Step 1: Pre-flight Quota Gate
    const quotaStatus = await step.run('check-preflight-quota', async () => {
      try {
        const quota = await checkMissionQuota(workspaceId, 'PREMIUM', 'missions');
        return {
          allowed: quota.allowed,
          remaining: 'remaining' in quota ? (quota as unknown as { remaining: number }).remaining : Math.max(0, quota.limit - quota.used),
          current: 'current' in quota ? (quota as unknown as { current: number }).current : quota.used,
        };
      } catch (err) {
        logger.warn('Quota check fallback allowing mission dispatch', { workspaceId, err });
        return { allowed: true, remaining: 10, current: 0 };
      }
    });

    if (!quotaStatus.allowed) {
      logger.warn('Video batch dispatch halted due to quota limit', { batchId, workspaceId });
      return {
        batchId,
        dispatchedCount: 0,
        skippedCount: products.length,
        reason: 'QUOTA_EXCEEDED',
      };
    }

    // Step 2: Dispatch individual video rendering missions
    const dispatchResults = await step.run('dispatch-product-missions', async () => {
      const successfulMissions: Array<{ productId: string; missionId: string }> = [];
      const failedProducts: Array<{ productId: string; reason: string }> = [];

      for (const product of products as UnifiedProductItem[]) {
        try {
          const res = await triggerProductVideoMission({
            workspaceId,
            product,
            autonomyLevel,
            budgetCents: ESTIMATED_VIDEO_COST_CENTS,
          });

          if (res.ok) {
            successfulMissions.push({
              productId: product.id,
              missionId: res.value.missionId,
            });
          } else {
            failedProducts.push({
              productId: product.id,
              reason: res.error.message,
            });
          }
        } catch (err) {
          failedProducts.push({
            productId: product.id,
            reason: err instanceof Error ? err.message : String(err),
          });
        }
      }

      return { successfulMissions, failedProducts };
    });

    // Step 3: Emit Reality Loop v1.2 cost telemetry
    await step.run('record-batch-telemetry', async () => {
      for (const m of dispatchResults.successfulMissions) {
        try {
          await emitMissionCostRecorded({
            workspaceId,
            recordedAt: Date.now(),
            missionId: m.missionId,
            amountCents: ESTIMATED_VIDEO_COST_CENTS,
            totalSpentCents: ESTIMATED_VIDEO_COST_CENTS,
            budgetCents: 1000,
          });
        } catch (err) {
          logger.warn('Telemetry emission non-fatal failure', { missionId: m.missionId, err });
        }
      }
      return { telemetryRecorded: dispatchResults.successfulMissions.length };
    });

    return {
      batchId,
      workspaceId,
      storeHost,
      totalRequested: products.length,
      dispatchedCount: dispatchResults.successfulMissions.length,
      failedCount: dispatchResults.failedProducts.length,
      missionIds: dispatchResults.successfulMissions.map((m) => m.missionId),
    };
  }
);
