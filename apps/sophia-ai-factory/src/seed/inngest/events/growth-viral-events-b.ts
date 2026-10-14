/**
 * @file growth-viral-events-b.ts
 * @description Inngest event contracts for viral yield, feedback loop, and bandit experimentation (Part B).
 * @layer seed
 */

export * from './growth-viral-yield-events';

export type GrowthV12ReseedTriggerEvent = {
  data: {
    userId: string;
    sourceJobId: string;
    channelId: string;
    platform: 'YOUTUBE_SHORTS' | 'TIKTOK_V2' | 'INSTAGRAM_REELS';
    originalHook: string;
    retentionZScore: number;
    classification: 'ALPHA_VIRAL' | 'STEADY' | 'STAGNANT';
    mutatedHooks: string[];
  };
};

export type GrowthV12WebhookReceivedEvent = {
  data: {
    affiliateNetwork: 'CLICKBANK' | 'PAYOS' | 'NOWPAYMENTS' | 'AWIN';
    externalOrderId: string;
    grossAmountUsd: number;
    commissionAmountUsd: number;
    subId?: string;
    currency?: string;
    rawPayload?: string;
  };
};

export type GrowthV13BanditEvaluateEvent = {
  data: {
    experimentId: string;
    userId: string;
    forceReweight?: boolean;
  };
};

export type GrowthV13DeliberationRequestEvent = {
  data: {
    scriptId: string;
    userId: string;
    originalScript: string;
    targetPlatform?: string;
  };
};

export type GrowthV14RenderScheduleEvent = {
  data: {
    jobId: string;
    userId: string;
    scriptId: string;
    mabArmId?: string;
    deliberationScore: number;
    allocatedMcu: number;
  };
};

export type GrowthV14RenderStage1EvaluateEvent = {
  data: {
    jobId: string;
    userId: string;
    interimRetentionScore: number;
  };
};

export type GrowthV14RenderHaltEvent = {
  data: {
    jobId: string;
    userId: string;
    reason: string;
    savedMcu: number;
  };
};

export type GrowthV15FeedbackIngestEvent = {
  data: {
    id: string;
    userId: string;
    videoManifestId: string;
    channelId: string;
    platform: 'YOUTUBE_SHORTS' | 'TIKTOK' | 'INSTAGRAM_REELS' | 'FACEBOOK_REELS';
    views: number;
    impressions?: number;
    watchTimeSeconds: number;
    durationSeconds: number;
    retentionCurve: { timePct: number; retentionPct: number }[];
    ctr?: number;
    viralityScore?: number;
    collectedAt: number;
  };
};

export type GrowthV15TelemetryPollEvent = {
  data: {
    videoManifestId?: string;
    userId?: string;
    platform?: string;
    interval?: 'T+2h' | 'T+12h' | 'T+24h' | 'T+72h';
  };
};

export type GrowthV15PriorRecalibrateEvent = {
  data: {
    userId: string;
    dimKey: string;
    dimVal: string;
    hookDropoffRate: number;
    normalizedCompletionScore: number;
    priorAlpha?: number;
    priorBeta?: number;
    dampeningFactor?: number;
  };
};
