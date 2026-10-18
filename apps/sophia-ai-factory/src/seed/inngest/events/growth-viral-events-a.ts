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

export type {
  RetargetingWinbackEvaluatedEvent,
  AffiliateDealMatchedEvent,
  ViralRepurposeDispatchedEvent,
  PaywallMabRecalibratedEvent,
  KolOutreachEnrolledEvent,
  HookAbWinnerPromotedEvent,
  SeoSurgeDetectedEvent,
} from './growth-viral-events-a-ext';
