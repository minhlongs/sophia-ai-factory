/**
 * @file social-creative-events.ts
 * @description Inngest event contracts for social syndication, creative mutations, and multimedia generation.
 * @layer seed
 */

import type {
  NewsjackingFastTrackTriggeredEvent,
  CommentDmDispatchTriggeredEvent,
  LiveStreamStockSurgeDetectedEvent,
  CompetitorLeadDiscoveredEvent,
  VideoSplitTestEvaluationRequestedEvent,
  FleetStaggerPublishRequestedEvent,
} from './social-engagement-events';

export type {
  NewsjackingFastTrackTriggeredEvent,
  CommentDmDispatchTriggeredEvent,
  LiveStreamStockSurgeDetectedEvent,
  CompetitorLeadDiscoveredEvent,
  VideoSplitTestEvaluationRequestedEvent,
  FleetStaggerPublishRequestedEvent,
};

export type SocialSyndicationRequestedEvent = {
  data: {
    jobId: string;
    tenantId: string;
    videoUrl: string;
    caption: string;
    channel: {
      channelId: string;
      platform: 'tiktok' | 'youtube' | 'x';
      todayPublishedCount: number;
      lastPublishedAtMs: number | null;
    };
  };
};

export type SocialPublishDispatchedEvent = {
  data: {
    jobId: string;
    userId: string;
    channelId: string;
    platform: 'YOUTUBE_SHORTS' | 'TIKTOK_V2' | 'INSTAGRAM_REELS';
    videoUrl: string;
    title: string;
    description?: string;
    tags?: string[];
  };
};

export type SocialAnalyticsSyncRequestedEvent = {
  data: {
    userId: string;
    jobId: string;
    channelId?: string;
    platform?: 'YOUTUBE_SHORTS' | 'TIKTOK_V2' | 'INSTAGRAM_REELS';
    platformPostId?: string;
    title?: string;
    mcuCost?: number;
    byokCostUsd?: number;
    revenueUsd?: number;
  };
};

export type SocialAnalyticsFeedbackEvaluatedEvent = {
  data: {
    userId: string;
    jobId: string;
    platform: string;
    hookScore: number;
    retentionScore: number;
    netRoiUsd: number;
    conversions: number;
    revenueUsd: number;
    /** Server-resolved workspace id for persisted learning state. */
    tenantId?: string;
    eventId?: string;
    impressions?: number;
    costUsd?: number;
    observedAtMs?: number;
    seed?: number;
    candidateArmIds?: string[];
    /** Mock/fixture metrics must never enter the production posterior. */
    isFixture?: boolean;
  };
};

export type CreativeMutationRequestedEvent = {
  data: {
    userId: string;
    parentJobId: string;
    generation: number;
    mutationIntensity: 'CONSERVATIVE' | 'MODERATE' | 'RADICAL';
    triggerReason: 'HOOK_FATIGUE' | 'LOW_RETENTION' | 'WINNING_ARM_EXPLORE' | 'MANUAL';
    customOverrides?: {
      targetHookArchetype?: 'STATISTIC_PAIN' | 'POLARIZING_VERDICT' | 'FINANCIAL_LOSS_WARNING' | 'AUTOMATION_PROOF' | 'HIGH_CURIOSITY_LIST' | 'EXCLUSIVE_ACCESS';
      targetVisualStyle?: string;
      pacingMultiplier?: number;
    };
  };
};

export type ViralAudioComposeRequestedEvent = {
  data: {
    userId: string;
    videoJobId: string;
    soundTrackId: string;
    duckingDb?: number;
    subtitlePreset?: 'HORMOZI_HIGHLIGHT' | 'BEAST_POP' | 'MINIMAL_CYBER' | 'NEON_PULSE';
  };
};

export type MultilingualDubbingRequestedEvent = {
  data: {
    userId: string;
    parentVideoJobId: string;
    targetLocales: Array<'en' | 'vi' | 'es' | 'id' | 'ja'>;
    preserveDuration?: boolean;
  };
};

export type LiveStreamLoopRefreshRequestedEvent = {
  data: {
    userId: string;
    sessionId: string;
    loopVideoUrl: string;
    pinnedOfferId?: string | null;
  };
};
