/**
 * @file growth-viral-yield-events.ts
 * @description Inngest event contracts for viral yield, rate card, and aspect ratio rendering.
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
