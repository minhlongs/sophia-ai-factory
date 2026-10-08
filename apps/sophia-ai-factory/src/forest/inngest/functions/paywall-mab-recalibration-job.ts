/**
 * @file paywall-mab-recalibration-job.ts
 * @description Inngest background job for dynamic paywall MAB recalibration
 * @layer forest
 */

import { inngest } from '@/seed/inngest/client';
import { createServerClient } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';

export const paywallMabRecalibrationJob = inngest.createFunction(
  {
    id: 'growth-paywall-mab-recalibration-job',
    name: 'Growth: Paywall MAB Recalibration Job',
  },
  { event: 'paywall.mab.recalibrated' },
  async ({ event, step }) => {
    const { campaignId, winningArmId, priceUsd, expectedRevenue } = event.data;

    await step.run('log-and-audit-mab-recalibration', async () => {
      logger.info('Recalibrating paywall MAB arm distribution', {
        campaignId,
        winningArmId,
        priceUsd,
        expectedRevenue,
      });

      const db = createServerClient();
      await db
        .prepare(
          `UPDATE mab_paywall_arms
           SET updated_at = ?
           WHERE id = ?`
        )
        .bind(Date.now(), winningArmId)
        .run();

      return { recalibrated: true, armId: winningArmId };
    });

    return { success: true, campaignId, winningArmId };
  }
);
