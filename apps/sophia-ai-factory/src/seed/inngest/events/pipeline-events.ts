/**
 * @file pipeline-events.ts
 * @description Inngest event contracts for video generation and autonomous campaigns.
 * @layer seed
 */

import type { Tier } from "@/seed/types";

export type CampaignCreatedEvent = {
  data: {
    campaignId: string;
    userId: string;
    topic: string;
    audience: string;
    tier: Tier;
    resume?: boolean;
    resumeFrom?: "script" | "tts" | "video" | "finalize";
  };
};

export type CampaignProgressEvent = {
  data: {
    campaignId: string;
    step: 'scripting' | 'tts' | 'visual' | 'compose' | 'publish' | 'complete' | 'error';
    progress: number;
    message: string;
    timestamp: number;
  };
};

export type VideoJobPayload = {
  data: {
    jobId: string;
    tenantId: string;
    userId: string;
    attempt?: number;
  };
};

export type VideoGenerateRequestedEvent = {
  data: {
    missionId: string;
    userId: string;
    prompt: string;
    voiceoverText?: string;
    aspectRatio?: '16:9' | '9:16' | '1:1';
    durationSec?: number;
    language?: 'en' | 'vi';
  };
};

export type BatchVideoFanoutEvent = { data: { batchId: string; userId: string } };

export type UrlRevenueVideoRequestedEvent = {
  data: {
    jobId: string;
    tenantId: string;
    userId?: string;
    prompt: string;
    locale: string;
    channel: string;
    trackingLink?: string;
  };
};

export type SopExecutionRequestedEvent = {
  data: {
    executionId: string;
    userId: string;
    orgId: string;
    sopTemplateId: string;
    installationId?: string;
    inputJson: string;
  };
};

export type SopStepCompletedEvent = {
  data: { executionId: string; stepOrder: number; result: Record<string, unknown> };
};

export type RepurposeAnalyzeEvent = {
  data: {
    jobId: string;
    userId: string;
    videoUrl: string;
    transcript: Array<{ text: string; start_ms: number; end_ms: number }>;
  };
};

export type RepurposeClipGenerateEvent = {
  data: {
    clipId: string;
    jobId: string;
    videoUrl: string;
    startMs: number;
    endMs: number;
    userId: string;
  };
};

export type AnalyticsSyncRequestedEvent = { data: { userId: string; requestedAt: number } };

export type KeyRotationRequestedEvent = { data: { keyVersion: number; reason?: string } };

export type YouTubeContentPipelineRequestedEvent = {
  data: {
    userId: string;
    channelConfigId: string;
    topic?: string | null;
    requestedAt?: number;
    resume?: boolean;
    resumeFrom?: string;
  };
};

export type CreativeMissionMultiTrackRequestedData = {
  missionId: string;
  userId: string;
  workspaceId: string;
  topic?: string;
  estimatedScenes?: number;
  durationSeconds?: number;
  aspectRatio?: '16:9' | '9:16' | '1:1';
  estimatedCostCents?: number;
};

export type AutonomousVideoPipelineRequestedEvent = {
  data: {
    campaignId: string;
    niche: "saas_global" | "crypto_global";
    productName: string;
    productUrl: string;
    productDescription: string;
    targetDurationSeconds?: number;
    affiliateBaseUrl: string;
    targetPlatforms?: ("youtube_shorts" | "tiktok" | "instagram_reels")[];
  };
};

export type NicheVideoCampaignRequestedEvent = {
  data: {
    campaignId?: string;
    userId: string;
    niche: "saas_global" | "crypto_global";
    blueprintId: string;
    productName: string;
    productUrl: string;
    targetAudience?: string;
    jurisdiction?: string;
    affiliateCode?: string;
    subId?: string | null;
    vanityCoupon?: string | null;
    locale?: "en" | "vi";
  };
};

export type AutonomousCampaignScalingRequestedEvent = {
  data: {
    tenantId: string;
    evaluatedMetrics: {
      campaignId: string;
      hookName: string;
      niche: "saas_global" | "crypto_global" | "ecommerce_tiktok";
      impressions: number;
      clicks: number;
      conversions: number;
      totalEarningsCents: number;
      publishedVideosCount: number;
    }[];
  };
};
