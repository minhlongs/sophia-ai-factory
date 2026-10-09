/**
 * @file growth-viral-events-a.ts
 * @description Inngest event contracts for viral marketing, arbitrage, and omnichannel attribution (Part A).
 * @layer seed
 */

export type TrendingSkuDetectedEvent = {
  data: {
    skuId: string;
    skuCode: string;
    platform: 'TIKTOK_SHOP' | 'SHOPEE' | 'CLICKBANK';
    productName: string;
    growthVelocityScore: number;
    commissionRate: number;
    suggestedHook: string;
  };
};

export type VoiceCartRecoveryTriggeredEvent = {
  data: {
    callId: string;
    userId: string;
    cartSessionId: string;
    customerPhone: string;
    customerName?: string;
    cartValue: number;
    currency: string;
    productNames: string[];
  };
};

export type AdsArbitrageOptimizedEvent = {
  data: {
    campaignId: string;
    userId: string;
    platform: 'TIKTOK_ADS' | 'META_GRAPH' | 'GOOGLE_ADS';
    spend24h: number;
    gmv24h: number;
    cpa: number;
    roas: number;
    actionTaken: 'SCALE_BUDGET' | 'MAINTAIN' | 'REDUCE_BUDGET' | 'PAUSE_STOP_LOSS';
    newDailyBudget: number;
  };
};

export type SeoParasiteSyndicatedEvent = {
  data: {
    articleId: string;
    userId: string;
    skuCode: string;
    targetPlatform: 'MEDIUM' | 'SUBSTACK' | 'LINKEDIN_PULSE' | 'WORDPRESS_NETWORK';
    canonicalSlug: string;
    cloakedBridgeUrl: string;
  };
};

export type B2bOutreachDispatchedEvent = {
  data: {
    leadId: string;
    userId: string;
    email: string;
    channel: 'EMAIL' | 'LINKEDIN' | 'TWITTER';
    rampDay: number;
    intentScore: number;
  };
};

export type TiktokSampleEvaluatedEvent = {
  data: {
    creatorId: string;
    userId: string;
    creatorHandle: string;
    sampleStatus: 'AUTO_APPROVED' | 'MANUAL_REVIEW' | 'REJECTED_LOW_METRICS';
    tier: 'TIER_1_STANDARD' | 'TIER_2_GROWTH' | 'TIER_3_ELITE';
  };
};

export type OmnichannelAttributionCalculatedEvent = {
  data: {
    conversionId: string;
    userId: string;
    model: 'FIRST_TOUCH' | 'LAST_TOUCH' | 'TIME_DECAY';
    totalAttributedGmv: number;
    touchpointCount: number;
  };
};

export type RetargetingWinbackEvaluatedEvent = {
  data: {
    userId: string;
    recordId: string;
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    discountPercentage: number;
    bonusMcu: number;
  };
};

export type AffiliateDealMatchedEvent = {
  data: {
    userId: string;
    recordId: string;
    campaignId: string;
    calculatedEpc: number;
    tier: 'STANDARD' | 'SILVER_SCALE' | 'GOLD_SCALE' | 'DIAMOND_ELITE';
  };
};

export type ViralRepurposeDispatchedEvent = {
  data: {
    userId: string;
    recordId: string;
    sourceVideoId: string;
    targetFormat: 'TIKTOK_9_16' | 'YOUTUBE_SHORTS_9_16' | 'INSTAGRAM_REELS_9_16' | 'SQUARE_FEED_1_1';
    saliencyScore: number;
  };
};

export type PaywallMabRecalibratedEvent = {
  data: {
    campaignId: string;
    winningArmId: string;
    priceUsd: number;
    expectedRevenue: number;
  };
};

export type KolOutreachEnrolledEvent = {
  data: {
    kolId: string;
    handle: string;
    platform: string;
    stepIndex: number;
    offeredSplitPct: number;
  };
};

export type HookAbWinnerPromotedEvent = {
  data: {
    experimentId: string;
    winnerVariantId: string;
    confidenceLevelPct: number;
  };
};

export type SeoSurgeDetectedEvent = {
  data: {
    keyword: string;
    zScore: number;
    currentVelocity: number;
    intent: string;
    generatedTitle: string;
  };
};
