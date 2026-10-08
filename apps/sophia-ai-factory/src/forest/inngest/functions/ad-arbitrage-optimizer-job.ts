/**
 * @file ad-arbitrage-optimizer-job.ts
 * @description Inngest background job for Ad Arbitrage MAB Thompson Sampling & Stop-Loss
 * @layer forest
 */

import { inngest } from '@/seed/inngest/client';
import { createServerClient } from '@/seed/db/client';
import { evaluateCampaignArbitrage } from '@/tree/ads/ad-arbitrage-mab';

export const adArbitrageOptimizerJob = inngest.createFunction(
  {
    id: 'ad-arbitrage-optimizer-job',
    name: 'Ad Arbitrage: MAB Thompson Sampling Rebalancer',
    concurrency: { limit: 5 },
  },
  { event: 'ads.arbitrage.optimized' },
  async ({ event, step }) => {
    const { campaignId, spend24h, gmv24h } = event.data;

    // Step 1: Run MAB evaluation
    const decision = await step.run('evaluate-campaign-arbitrage', async () => {
      return evaluateCampaignArbitrage({
        campaignId,
        dailyBudget: 1000000,
        spend24h,
        gmv24h,
        clicks24h: 300,
        conversions24h: gmv24h > spend24h ? 5 : 1,
        commissionPerConversion: 250000,
      });
    });

    // Step 2: Persist new budget & action to D1
    await step.run('update-campaign-status', async () => {
      const db = createServerClient();
      await db.execute(
        `UPDATE ad_arbitrage_campaigns
         SET daily_budget = ?,
             recommended_action = ?,
             status = ?,
             last_rebalanced_at = ?,
             updated_at = ?
         WHERE id = ?`,
        [
          decision.newDailyBudget,
          decision.action,
          decision.action === 'PAUSE_STOP_LOSS' ? 'PAUSED_STOP_LOSS' : 'ACTIVE',
          Date.now(),
          Date.now(),
          campaignId,
        ],
      );
    });

    return {
      campaignId,
      action: decision.action,
      newDailyBudget: decision.newDailyBudget,
      reason: decision.reason,
    };
  },
);
