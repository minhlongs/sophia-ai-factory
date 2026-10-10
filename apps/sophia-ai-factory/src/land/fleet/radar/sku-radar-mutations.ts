/**
 * @file sku-radar-mutations.ts
 * @description Mutation operations for calculating velocity and ingesting trending SKU items
 */

import { createServerClient } from '@/seed/db/client';
import { inngest } from '@/seed/inngest/client';
import {
  TrendingSkuRadarItemSchema,
  type TrendingSkuRadarItem,
} from '@/seed/types/fleet-matrix-sku-radar-types';
import { calculateSkuVelocity } from '@/tree/radar/sku-velocity-calculator';
import type { IngestTrendingSkuRadarInput } from './types';

export async function executeIngestTrendingSkuRadar(
  _userId: string,
  input: IngestTrendingSkuRadarInput,
): Promise<{ success: boolean; radarItem?: TrendingSkuRadarItem; error?: string }> {
  try {
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
