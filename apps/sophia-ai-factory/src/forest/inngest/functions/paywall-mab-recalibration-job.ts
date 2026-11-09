/**
 * @file paywall-mab-recalibration-job.ts
 * @description Inngest background worker for Paywall MAB posterior recalibration with Track B Sparse-Data Guard
 * @layer forest
 */

import { inngest } from '@/seed/inngest/client';
import { createServerClient } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import type { PaywallArm } from '@/seed/types/growth-triad-v5-types';
import { evaluatePaywallArmsSparseDataGate } from '@/tree/monetization/paywall-mab-engine';

export const paywallMabRecalibrationJob = inngest.createFunction(
  {
    id: 'growth-paywall-mab-recalibration-job',
    name: 'Growth: Paywall MAB Recalibration Job',
  },
  { event: 'paywall.mab.recalibrated' },
  async ({ event, step }) => {
    const { campaignId, winningArmId, priceUsd, expectedRevenue, accountAgeDays } = event.data;

    const result = await step.run('log-and-audit-mab-recalibration', async () => {
      const db = createServerClient();
      const rows = await db
        .prepare(
          `SELECT id, campaign_id as campaignId, price_tier as priceTier,
                  price_usd as priceUsd, alpha_success as alphaSuccess,
                  beta_failure as betaFailure, impressions, conversions,
                  revenue_usd as revenueUsd, is_active as isActive
           FROM mab_paywall_arms
           WHERE campaign_id = ? AND is_active = 1`
        )
        .bind(campaignId)
        .all<PaywallArm>();

      const activeArms = rows?.results ?? [];
      const gateDecision = evaluatePaywallArmsSparseDataGate(
        activeArms,
        typeof accountAgeDays === 'number' ? accountAgeDays : undefined
      );

      if (!gateDecision.allowThompsonSampling) {
        logger.info('Holding paywall MAB recalibration under sparse-data guard', {
          campaignId,
          winningArmId,
          mode: gateDecision.mode,
          reason: gateDecision.reason,
        });
        return {
          recalibrated: false,
          armId: winningArmId,
          mode: gateDecision.mode,
          skippedReason: gateDecision.reason,
        };
      }

      logger.info('Recalibrating paywall MAB arm distribution', {
        campaignId,
        winningArmId,
        priceUsd,
        expectedRevenue,
        mode: gateDecision.mode,
      });

      await db
        .prepare(
          `UPDATE mab_paywall_arms
           SET updated_at = ?
           WHERE id = ?`
        )
        .bind(Date.now(), winningArmId)
        .run();

      return {
        recalibrated: true,
        armId: winningArmId,
        mode: gateDecision.mode,
      };
    });

    return {
      success: true,
      campaignId,
      winningArmId,
      recalibrated: result.recalibrated,
      mode: result.mode,
    };
  }
);
