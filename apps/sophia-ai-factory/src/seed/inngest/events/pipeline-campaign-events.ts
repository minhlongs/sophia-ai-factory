/**
 * @file pipeline-campaign-events.ts
 * @description Inngest event contracts for campaign creation, progress and video job requests.
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
