/**
 * @file flash-sale-sync-job.ts
 * @description Background job evaluating live stream stock surge and issuing flash vouchers
 * @layer forest
 */

import { inngest } from '@/seed/inngest/client';
import { evaluateLiveSurgeVoucher } from '@/tree/live-stream/live-stock-synchronizer';

export const flashSaleSyncJob = inngest.createFunction(
  { id: 'flash-sale-sync-job', name: 'Live Flash-Sale & Cart Surge Monitor Job' },
  { event: 'live.stream.stock.surge.detected' },
  async ({ event, step }) => {
    const { sessionId, offerId, currentViewers, surgePercentage, remainingStock } = event.data;

    const evaluation = await step.run('evaluate-surge-voucher', async () => {
      const baseline = surgePercentage > 0
        ? Math.round(currentViewers / (1 + surgePercentage / 100))
        : currentViewers;

      return evaluateLiveSurgeVoucher({
        currentViewers,
        baselineViewers: baseline,
        remainingStock,
      });
    });

    if (!evaluation.shouldTriggerSurge) {
      return { skipped: true, reason: 'NO_SURGE_TRIGGER_NEEDED' };
    }

    return {
      success: true,
      sessionId,
      offerId,
      voucherCode: evaluation.recommendedVoucherCode,
      discountPercent: evaluation.recommendedDiscountPercent,
      urgencyLevel: evaluation.urgencyLevel,
      announcement: evaluation.fomoAnnouncementText,
    };
  },
);
