'use server';

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { createServerClient } from '@/seed/db/client';
import { inngest } from '@/seed/inngest/client';
import {
  AdArbitrageCampaignSchema,
  type AdArbitrageCampaign,
} from '@/seed/types/growth-triad-v2-types';
import { evaluateCampaignArbitrage } from '@/tree/ads/ad-arbitrage-mab';

/**
 * 2. Rebalance Ad Arbitrage budget using MAB Thompson Sampling
 */
export async function rebalanceAdArbitrageAction(input: {
  campaignId: string;
  campaignName: string;
  platform: 'TIKTOK_ADS' | 'META_GRAPH' | 'GOOGLE_ADS';
  dailyBudget: number;
  spend24h: number;
  gmv24h: number;
  clicks24h: number;
  conversions24h: number;
  commissionPerConversion: number;
}): Promise<{ success: boolean; campaign?: AdArbitrageCampaign; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'UNAUTHORIZED' };
    }

    const decision = evaluateCampaignArbitrage({
      campaignId: input.campaignId,
      dailyBudget: input.dailyBudget,
      spend24h: input.spend24h,
      gmv24h: input.gmv24h,
      clicks24h: input.clicks24h,
      conversions24h: input.conversions24h,
      commissionPerConversion: input.commissionPerConversion,
    });

    const now = Math.floor(Date.now() / 1000);
    const campaignRecord = AdArbitrageCampaignSchema.parse({
      id: input.campaignId,
      userId: user.id,
      platform: input.platform,
      campaignExternalId: `ext-${input.campaignId}`,
      campaignName: input.campaignName,
      dailyBudget: decision.newDailyBudget,
      rollingSpend24h: input.spend24h,
      rollingGmv24h: input.gmv24h,
      rollingClicks24h: input.clicks24h,
      rollingConversions24h: input.conversions24h,
      cpa: decision.cpa,
      roas: decision.roas,
      epc: decision.epc,
      status: decision.action === 'PAUSE_STOP_LOSS' ? 'PAUSED_STOP_LOSS' : 'ACTIVE',
      recommendedAction: decision.action,
      lastRebalancedAt: now,
      createdAt: now,
      updatedAt: now,
    });

    const db = createServerClient();
    await db.execute(
      `INSERT INTO ad_arbitrage_campaigns (
        id, user_id, platform, campaign_external_id, campaign_name,
        daily_budget, rolling_spend_24h, rolling_gmv_24h, rolling_clicks_24h,
        rolling_conversions_24h, cpa, roas, epc, status, recommended_action,
        last_rebalanced_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        daily_budget = excluded.daily_budget,
        rolling_spend_24h = excluded.rolling_spend_24h,
        rolling_gmv_24h = excluded.rolling_gmv_24h,
        cpa = excluded.cpa,
        roas = excluded.roas,
        status = excluded.status,
        recommended_action = excluded.recommended_action,
        last_rebalanced_at = excluded.last_rebalanced_at,
        updated_at = excluded.updated_at`,
      [
        campaignRecord.id,
        campaignRecord.userId,
        campaignRecord.platform,
        campaignRecord.campaignExternalId,
        campaignRecord.campaignName,
        campaignRecord.dailyBudget,
        campaignRecord.rollingSpend24h,
        campaignRecord.rollingGmv24h,
        campaignRecord.rollingClicks24h,
        campaignRecord.rollingConversions24h,
        campaignRecord.cpa,
        campaignRecord.roas,
        campaignRecord.epc,
        campaignRecord.status,
        campaignRecord.recommendedAction,
        campaignRecord.lastRebalancedAt,
        campaignRecord.createdAt,
        campaignRecord.updatedAt,
      ],
    );

    // Dispatch Inngest telemetry
    await inngest.send({
      name: 'ads.arbitrage.optimized',
      data: {
        campaignId: campaignRecord.id,
        userId: user.id,
        platform: campaignRecord.platform,
        spend24h: campaignRecord.rollingSpend24h,
        gmv24h: campaignRecord.rollingGmv24h,
        cpa: campaignRecord.cpa,
        roas: campaignRecord.roas,
        actionTaken: campaignRecord.recommendedAction,
        newDailyBudget: campaignRecord.dailyBudget,
      },
    });

    return { success: true, campaign: campaignRecord };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'FAILED_TO_REBALANCE_AD_ARBITRAGE',
    };
  }
}
