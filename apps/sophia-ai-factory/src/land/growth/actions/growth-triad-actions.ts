/**
 * @file growth-triad-actions.ts
 * @description Land layer Server Actions for Growth Triad v2: Voice Cart Closer, Ad Arbitrage MAB & Parasite SEO
 * @layer land
 */

'use server';

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { createServerClient } from '@/seed/db/client';
import { inngest } from '@/seed/inngest/client';
import {
  AbandonedCartCallRecordSchema,
  AdArbitrageCampaignSchema,
  ParasiteSeoArticleSchema,
  type AbandonedCartCallRecord,
  type AdArbitrageCampaign,
  type ParasiteSeoArticle,
} from '@/seed/types/growth-triad-v2-types';
import { evaluateCampaignArbitrage } from '@/tree/ads/ad-arbitrage-mab';
import { compileParasiteArticle } from '@/tree/seo/parasite-article-builder';

/**
 * 1. Trigger Voice Cart Closer for an abandoned cart session
 */
export async function triggerVoiceCartRecoveryAction(input: {
  cartSessionId: string;
  customerPhone: string;
  customerName?: string;
  cartValue: number;
  productNames: string[];
}): Promise<{ success: boolean; callRecord?: AbandonedCartCallRecord; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'UNAUTHORIZED' };
    }

    const callId = `vcall-${crypto.randomUUID().slice(0, 12)}`;
    const now = Math.floor(Date.now() / 1000);

    const record = AbandonedCartCallRecordSchema.parse({
      id: callId,
      userId: user.id,
      cartSessionId: input.cartSessionId,
      customerPhone: input.customerPhone,
      customerName: input.customerName,
      cartValue: input.cartValue,
      currency: 'VND',
      productNames: input.productNames,
      callStatus: 'IN_PROGRESS',
      callTimestamp: now,
      recordingDurationSeconds: 0,
      convertedGmv: 0,
      createdAt: now,
      updatedAt: now,
    });

    const db = createServerClient();
    await db.execute(
      `INSERT INTO abandoned_cart_voice_calls (
        id, user_id, cart_session_id, customer_phone, customer_name,
        cart_value, currency, product_names, call_status,
        recording_duration_seconds, converted_gmv, call_timestamp, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        record.id,
        record.userId,
        record.cartSessionId,
        record.customerPhone,
        record.customerName ?? null,
        record.cartValue,
        record.currency,
        JSON.stringify(record.productNames),
        record.callStatus,
        record.recordingDurationSeconds,
        record.convertedGmv,
        record.callTimestamp,
        record.createdAt,
        record.updatedAt,
      ],
    );

    // Dispatch background event to Inngest
    await inngest.send({
      name: 'voice.cart.recovery.triggered',
      data: {
        callId: record.id,
        userId: user.id,
        cartSessionId: record.cartSessionId,
        customerPhone: record.customerPhone,
        customerName: record.customerName,
        cartValue: record.cartValue,
        currency: record.currency,
        productNames: record.productNames,
      },
    });

    return { success: true, callRecord: record };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'FAILED_TO_TRIGGER_VOICE_CLOSER',
    };
  }
}

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

/**
 * 3. Syndicate Parasite SEO Article to High-DA platform
 */
export async function syndicateParasiteArticleAction(input: {
  skuCode: string;
  productName: string;
  price: number;
  targetPlatform: 'MEDIUM' | 'SUBSTACK' | 'LINKEDIN_PULSE' | 'WORDPRESS_NETWORK';
  cloakedBridgeUrl: string;
  keyFeatures: string[];
}): Promise<{ success: boolean; article?: ParasiteSeoArticle; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'UNAUTHORIZED' };
    }

    const compiled = compileParasiteArticle({
      skuCode: input.skuCode,
      productName: input.productName,
      price: input.price,
      targetPlatform: input.targetPlatform,
      cloakedBridgeUrl: input.cloakedBridgeUrl,
      keyFeatures: input.keyFeatures,
    });

    const articleId = `pseo-${crypto.randomUUID().slice(0, 12)}`;
    const now = Math.floor(Date.now() / 1000);

    const articleRecord = ParasiteSeoArticleSchema.parse({
      id: articleId,
      userId: user.id,
      skuCode: input.skuCode,
      title: compiled.title,
      targetPlatform: input.targetPlatform,
      canonicalSlug: compiled.canonicalSlug,
      cloakedBridgeUrl: input.cloakedBridgeUrl,
      targetKeywords: input.keyFeatures,
      schemaOrgJsonLd: compiled.schemaOrgJsonLd,
      seoContentMarkdown: compiled.seoContentMarkdown,
      seoScore: compiled.seoScore,
      status: 'PUBLISHED',
      publishedExternalUrl: `https://${input.targetPlatform.toLowerCase()}.com/p/${compiled.canonicalSlug}`,
      organicImpressions: 0,
      organicClicks: 0,
      createdAt: now,
      updatedAt: now,
    });

    const db = createServerClient();
    await db.execute(
      `INSERT INTO parasite_seo_articles (
        id, user_id, sku_code, title, target_platform, canonical_slug,
        cloaked_bridge_url, target_keywords, schema_org_json_ld,
        seo_content_markdown, seo_score, status, published_external_url,
        organic_impressions, organic_clicks, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        articleRecord.id,
        articleRecord.userId,
        articleRecord.skuCode,
        articleRecord.title,
        articleRecord.targetPlatform,
        articleRecord.canonicalSlug,
        articleRecord.cloakedBridgeUrl,
        JSON.stringify(articleRecord.targetKeywords),
        articleRecord.schemaOrgJsonLd,
        articleRecord.seoContentMarkdown,
        articleRecord.seoScore,
        articleRecord.status,
        articleRecord.publishedExternalUrl ?? null,
        articleRecord.organicImpressions,
        articleRecord.organicClicks,
        articleRecord.createdAt,
        articleRecord.updatedAt,
      ],
    );

    await inngest.send({
      name: 'seo.parasite.syndicated',
      data: {
        articleId: articleRecord.id,
        userId: user.id,
        skuCode: articleRecord.skuCode,
        targetPlatform: articleRecord.targetPlatform,
        canonicalSlug: articleRecord.canonicalSlug,
        cloakedBridgeUrl: articleRecord.cloakedBridgeUrl,
      },
    });

    return { success: true, article: articleRecord };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'FAILED_TO_SYNDICATE_ARTICLE',
    };
  }
}
