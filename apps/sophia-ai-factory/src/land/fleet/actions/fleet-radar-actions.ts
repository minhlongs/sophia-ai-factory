/**
 * @file fleet-radar-actions.ts
 * @description Land layer Server Actions for Fleet Matrix multi-account management & SKU Radar
 * @layer land
 */

'use server';

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { createServerClient } from '@/seed/db/client';
import { inngest } from '@/seed/inngest/client';
import {
  FleetCreatorAccountSchema,
  FleetCampaignDeploymentSchema,
  TrendingSkuRadarItemSchema,
  type FleetCreatorAccount,
  type TrendingSkuRadarItem,
  type FleetCampaignDeployment,
} from '@/seed/types/fleet-matrix-sku-radar-types';
import { calculateSkuVelocity, type SkuMetricsInput } from '@/tree/radar/sku-velocity-calculator';
import { buildStaggerSchedule } from '@/tree/fleet/fleet-stagger-scheduler';

/**
 * Fetch all fleet creator accounts for the authenticated user
 */
export async function getFleetAccountsAction(): Promise<{
  success: boolean;
  data: FleetCreatorAccount[];
  error?: string;
}> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, data: [], error: 'UNAUTHORIZED' };
    }

    const db = createServerClient();
    const { data } = await db
      .from<FleetCreatorAccount>('fleet_creator_accounts')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    return {
      success: true,
      data: data ?? [],
    };
  } catch (err) {
    return {
      success: false,
      data: [],
      error: err instanceof Error ? err.message : 'UNKNOWN_ERROR',
    };
  }
}

/**
 * Register a new synthetic influencer account in the fleet
 */
export async function registerFleetAccountAction(input: {
  platform: 'TIKTOK' | 'YOUTUBE' | 'INSTAGRAM' | 'FACEBOOK';
  handle: string;
  displayName: string;
  proxyConfigId?: string | null;
  dailyPostLimit?: number;
}): Promise<{ success: boolean; data?: FleetCreatorAccount; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'UNAUTHORIZED' };
    }

    const accountId = `facc-${crypto.randomUUID().slice(0, 12)}`;
    const now = Math.floor(Date.now() / 1000);

    const validated = FleetCreatorAccountSchema.parse({
      id: accountId,
      userId: user.id,
      platform: input.platform,
      handle: input.handle,
      displayName: input.displayName,
      proxyConfigId: input.proxyConfigId ?? null,
      status: 'ACTIVE',
      dailyPostLimit: input.dailyPostLimit ?? 3,
      postsPublishedToday: 0,
      lastPostAt: null,
      totalViews: 0,
      totalClicks: 0,
      totalGmv: 0,
      totalCommission: 0,
      createdAt: now,
      updatedAt: now,
    });

    const db = createServerClient();
    await db.execute(
      `INSERT INTO fleet_creator_accounts (
        id, user_id, platform, handle, display_name, proxy_config_id,
        status, daily_post_limit, posts_published_today, last_post_at,
        total_views, total_clicks, total_gmv, total_commission,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        validated.id,
        validated.userId,
        validated.platform,
        validated.handle,
        validated.displayName,
        validated.proxyConfigId ?? null,
        validated.status,
        validated.dailyPostLimit,
        validated.postsPublishedToday,
        validated.lastPostAt ?? null,
        validated.totalViews,
        validated.totalClicks,
        validated.totalGmv,
        validated.totalCommission,
        validated.createdAt,
        validated.updatedAt,
      ],
    );

    return { success: true, data: validated };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'FAILED_TO_REGISTER_ACCOUNT',
    };
  }
}

/**
 * Launch an Anti-Shadowban staggered fleet publishing campaign
 */
export async function launchFleetDeploymentAction(input: {
  skuId?: string;
  campaignName: string;
  targetAccountIds: string[];
  videoAssetUrl?: string;
  hookAngles: string[];
  staggerMinutes: number;
  bridgePageSlug?: string;
}): Promise<{ success: boolean; deploymentId?: string; scheduledCount?: number; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'UNAUTHORIZED' };
    }

    if (input.targetAccountIds.length === 0) {
      return { success: false, error: 'NO_ACCOUNTS_SELECTED' };
    }

    const db = createServerClient();
    const { data: accountsData } = await db
      .from<FleetCreatorAccount>('fleet_creator_accounts')
      .select('*')
      .in('id', input.targetAccountIds)
      .eq('user_id', user.id);

    const accounts = accountsData ?? [];
    const deploymentId = `fdep-${crypto.randomUUID().slice(0, 12)}`;

    const plan = buildStaggerSchedule({
      deploymentId,
      accounts,
      hookCount: input.hookAngles.length,
      baseIntervalMinutes: input.staggerMinutes,
    });

    const now = Math.floor(Date.now() / 1000);
    const skuId = input.skuId ?? 'sku-default';
    const videoAssetUrl = input.videoAssetUrl ?? 'https://assets.sophia.ai/default.mp4';
    const deploymentRecord = FleetCampaignDeploymentSchema.parse({
      id: deploymentId,
      userId: user.id,
      skuId,
      campaignName: input.campaignName,
      targetFleetAccountIds: input.targetAccountIds,
      generatedHookAngles: input.hookAngles,
      bridgePageSlug: input.bridgePageSlug ?? `deal-${deploymentId}`,
      status: 'SCHEDULED',
      staggerIntervalMinutes: input.staggerMinutes,
      totalAssignedAccounts: plan.totalScheduled,
      totalPublishedVideos: 0,
      aggregateGmv: 0,
      aggregateCommission: 0,
      createdAt: now,
      updatedAt: now,
    });

    await db.execute(
      `INSERT INTO fleet_campaign_deployments (
        id, user_id, sku_id, campaign_name, target_fleet_account_ids,
        generated_hook_angles, bridge_page_slug, status,
        stagger_interval_minutes, total_assigned_accounts,
        total_published_videos, aggregate_gmv, aggregate_commission,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        deploymentRecord.id,
        deploymentRecord.userId,
        deploymentRecord.skuId,
        deploymentRecord.campaignName,
        JSON.stringify(deploymentRecord.targetFleetAccountIds),
        JSON.stringify(deploymentRecord.generatedHookAngles),
        deploymentRecord.bridgePageSlug,
        deploymentRecord.status,
        deploymentRecord.staggerIntervalMinutes,
        deploymentRecord.totalAssignedAccounts,
        deploymentRecord.totalPublishedVideos,
        deploymentRecord.aggregateGmv,
        deploymentRecord.aggregateCommission,
        deploymentRecord.createdAt,
        deploymentRecord.updatedAt,
      ],
    );

    // Trigger Inngest background event
    await inngest.send({
      name: 'fleet.stagger.publish.requested',
      data: {
        deploymentId,
        userId: user.id,
        skuId,
        targetAccountIds: input.targetAccountIds,
        videoAssetUrl,
        hookAngles: input.hookAngles,
        staggerMinutes: input.staggerMinutes,
      },
    });

    return {
      success: true,
      deploymentId,
      scheduledCount: plan.totalScheduled,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'FAILED_TO_LAUNCH_DEPLOYMENT',
    };
  }
}

/**
 * Scan & Ingest a trending SKU into the Radar, calculating velocity
 */
export async function ingestTrendingSkuRadarAction(
  input: SkuMetricsInput & { affiliateUrl?: string },
): Promise<{ success: boolean; radarItem?: TrendingSkuRadarItem; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'UNAUTHORIZED' };
    }

    const calculated = calculateSkuVelocity(input);
    const radarItemId = `radar-${crypto.randomUUID().slice(0, 12)}`;
    const now = Math.floor(Date.now() / 1000);

    const radarItem = TrendingSkuRadarItemSchema.parse({
      id: radarItemId,
      platform: input.platform,
      skuCode: input.skuCode,
      productName: input.productName,
      productCategory: 'ELECTRONICS',
      price: input.price,
      currency: 'VND',
      commissionRate: input.commissionRate,
      estimatedCommission: calculated.estimatedCommissionPerOrder,
      dailySalesVolume: input.salesVolume24h,
      growthVelocityScore: calculated.velocityScore,
      hotTrendTier: calculated.hotTrendTier,
      affiliateUrl: input.affiliateUrl ?? `https://tiktok.com/shop/p/${input.skuCode}`,
      topSellingHookSummary: calculated.oneClickCampaignRecommendation.recommendedHooks[0],
      createdAt: now,
      updatedAt: now,
    });

    const db = createServerClient();
    await db.execute(
      `INSERT INTO trending_sku_radar_items (
        id, platform, sku_code, product_name, product_category, price, currency,
        commission_rate, estimated_commission, daily_sales_volume, growth_velocity_score,
        hot_trend_tier, affiliate_url, top_selling_hook_summary, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(sku_code, platform) DO UPDATE SET
        price = excluded.price,
        commission_rate = excluded.commission_rate,
        estimated_commission = excluded.estimated_commission,
        growth_velocity_score = excluded.growth_velocity_score,
        hot_trend_tier = excluded.hot_trend_tier,
        daily_sales_volume = excluded.daily_sales_volume,
        top_selling_hook_summary = excluded.top_selling_hook_summary,
        updated_at = excluded.updated_at`,
      [
        radarItem.id,
        radarItem.platform,
        radarItem.skuCode,
        radarItem.productName,
        radarItem.productCategory,
        radarItem.price,
        radarItem.currency,
        radarItem.commissionRate,
        radarItem.estimatedCommission,
        radarItem.dailySalesVolume,
        radarItem.growthVelocityScore,
        radarItem.hotTrendTier,
        radarItem.affiliateUrl,
        radarItem.topSellingHookSummary ?? null,
        radarItem.createdAt,
        radarItem.updatedAt,
      ],
    );

    // If breakout or surging, send inngest notification
    if (calculated.hotTrendTier === 'BREAKOUT' || calculated.hotTrendTier === 'SURGING') {
      await inngest.send({
        name: 'trending.sku.detected',
        data: {
          skuId: radarItemId,
          skuCode: input.skuCode,
          productName: input.productName,
          platform: input.platform,
          growthVelocityScore: calculated.velocityScore,
          commissionRate: input.commissionRate,
          suggestedHook: calculated.oneClickCampaignRecommendation.recommendedHooks[0],
        },
      });
    }

    return { success: true, radarItem };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'FAILED_TO_INGEST_SKU',
    };
  }
}

/**
 * Fetch all trending SKU radar items
 */
export async function getTrendingRadarItemsAction(): Promise<{
  success: boolean;
  data: TrendingSkuRadarItem[];
  error?: string;
}> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, data: [], error: 'UNAUTHORIZED' };
    }

    const db = createServerClient();
    const { data } = await db
      .from<TrendingSkuRadarItem>('trending_sku_radar_items')
      .select('*')
      .order('growth_velocity_score', { ascending: false })
      .limit(50);

    return {
      success: true,
      data: data ?? [],
    };
  } catch (err) {
    return {
      success: false,
      data: [],
      error: err instanceof Error ? err.message : 'UNKNOWN_ERROR',
    };
  }
}
