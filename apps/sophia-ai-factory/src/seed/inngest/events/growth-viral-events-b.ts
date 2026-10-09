/**
 * @file growth-viral-events-b.ts
 * @description Inngest event contracts for viral yield, feedback loop, and bandit experimentation (Part B).
 * @layer seed
 */

import type {
  TrafficRedirect,
  YieldRouterHealthCheck,
  ShadowbanTelemetryEvent,
  ScriptCultureIndexRequest,
} from "@/seed/types/growth-triad-v9-types";

export type SmartLinkYieldRebalancedEvent = {
  data: {
    offerId: string;
    expectedYieldUsd: number;
    network: string;
    niche: string;
  };
};

export type RetentionCliffTrimmedEvent = {
  data: {
    videoId: string;
    cliffStartSec: number;
    trimDurationSec: number;
    thirtySecRetention: number;
  };
};

export type SponsorshipRateCardCalculatedEvent = {
  data: {
    channelId: string;
    niche: string;
    effectiveCpmUsd: number;
    dedicatedUsd: number;
  };
};

export type ReframeAspectRenderedEvent = {
  data: {
    videoId: string;
    targetAspect: string;
    jitterScore: number;
    tokenCount: number;
  };
};

export type ThumbnailGazeScoredEvent = {
  data: {
    thumbnailId: string;
    saliencyScore: number;
    predictedCtrPct: number;
    gazeGrade: string;
  };
};

export type AudioResonanceSyncedEvent = {
  data: {
    audioTrackId: string;
    resonanceScore: number;
    bpm: number;
    syncQuality: string;
  };
};

export type CommunityBaitGeneratedEvent = {
  data: {
    videoId: string;
    campaignId: string;
    primaryHookQuestion: string;
    curiosityGapScore: number;
  };
};

export type SubscriberCohortEvaluatedEvent = {
  data: {
    cohortMonth: string;
    cumulativeLtvUsd: number;
    hazardPeakMonth: number;
  };
};

export type AffiliateYieldRoutedEvent = {
  data: {
    routerId: string;
    redirects: TrafficRedirect[];
    healthStatus: YieldRouterHealthCheck['status'];
  };
};

export type ShadowbanAnomalyDetectedEvent = {
  data: ShadowbanTelemetryEvent;
};

export type SemanticCultureScoredEvent = {
  data: ScriptCultureIndexRequest & {
    score: number;
    cultureMatch: "HIGH" | "MEDIUM" | "LOW";
  };
};

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
