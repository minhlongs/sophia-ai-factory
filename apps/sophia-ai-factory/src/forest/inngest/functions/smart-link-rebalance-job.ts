/**
 * @file smart-link-rebalance-job.ts
 * @description Inngest background job for affiliate smart-link yield recalibration & routing update
 * @layer forest
 */

import { inngest } from '@/seed/inngest/client';
import { createServerClient } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';

export const smartLinkRebalanceJob = inngest.createFunction(
  {
    id: 'growth-smart-link-rebalance-job',
    name: 'Growth: Smart-Link Yield Rebalance Job',
  },
  { event: 'smartlink.yield.rebalanced' },
  async ({ event, step }) => {
    const { offerId, expectedYieldUsd, network, niche } = event.data;

    await step.run('update-offer-yield-and-routing', async () => {
      logger.info('Rebalancing affiliate offer expected yield', {
        offerId,
        expectedYieldUsd,
        network,
        niche,
      });

      const db = createServerClient();
      await db
        .prepare(
          `UPDATE affiliate_smart_offers
           SET expected_yield_usd = ?, updated_at = ?
           WHERE id = ?`
        )
        .bind(expectedYieldUsd, Date.now(), offerId)
        .run();

      return { rebalanced: true, offerId, expectedYieldUsd };
    });

    return { success: true, offerId, expectedYieldUsd };
  }
);
