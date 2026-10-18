/**
 * @file growth-viral-events-a-ext.ts
 * @description Extended Inngest event contracts for viral marketing, winback, and SEO surges (Part A extension).
 * @layer seed
 */

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
