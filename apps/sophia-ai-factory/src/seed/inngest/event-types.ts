/**
 * Merged Inngest event schema — canonical seed event contract.
 *
 * Union of the former seed and tree clients plus the production-graph
 * events (38 event keys). Agent-mission payload types live in
 * ./agent-event-types; production-graph payload types live in
 * @/seed/types/production-factory. Reconciliation notes:
 * `url_revenue.video.requested.userId` is optional (handler reads tenantId);
 * `agent.mission.started` carries the rich autonomy payload its sender emits.
 *
 * Layer: seed (foundational — no domain imports).
 *
 * @module seed/inngest/event-types
 */

import { Tier } from "@/seed/types";
import type {
  AgentMissionStartedData,
  AgentApprovalRequestedData,
  AgentApprovalResolvedData,
  AgentMissionCompletedData,
  AgentMissionFailedData,
} from "./agent-event-types";
import type {
  ProductionGraphStartedEvent,
  ProductionGraphCompletedEvent,
  ProductionGraphFailedEvent,
  ProductionGraphCancelledEvent,
} from "@/seed/types/production-factory";
import type { DubbingJobInput } from "@/seed/types/dubbing";
import type {
  CommerceCatalogSyncEvent,
  CommerceProductDeltaEvent,
  CommerceVideoBatchDispatchEvent,
  AffiliateConversionReconciledEvent,
  AffiliateConversionRecordedEvent,
} from "@/seed/types/inngest-ecommerce";

type CampaignCreatedEvent = {
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

type CampaignProgressEvent = {
  data: {
    campaignId: string;
    step: 'scripting' | 'tts' | 'visual' | 'compose' | 'publish' | 'complete' | 'error';
    progress: number;
    message: string;
    timestamp: number;
  };
};

type VideoJobPayload = {
  data: {
    jobId: string;
    tenantId: string;
    userId: string;
    attempt?: number;
  };
};

type VideoGenerateRequestedEvent = {
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

type BatchVideoFanoutEvent = { data: { batchId: string; userId: string } };

type UrlRevenueVideoRequestedEvent = {
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

type SopExecutionRequestedEvent = {
  data: {
    executionId: string;
    userId: string;
    orgId: string;
    sopTemplateId: string;
    installationId?: string;
    inputJson: string;
  };
};

type SopStepCompletedEvent = {
  data: { executionId: string; stepOrder: number; result: Record<string, unknown> };
};

type RepurposeAnalyzeEvent = {
  data: {
    jobId: string;
    userId: string;
    videoUrl: string;
    transcript: Array<{ text: string; start_ms: number; end_ms: number }>;
  };
};

type RepurposeClipGenerateEvent = {
  data: {
    clipId: string;
    jobId: string;
    videoUrl: string;
    startMs: number;
    endMs: number;
    userId: string;
  };
};

type AnalyticsSyncRequestedEvent = { data: { userId: string; requestedAt: number } };

type KeyRotationRequestedEvent = { data: { keyVersion: number; reason?: string } };

type YouTubeContentPipelineRequestedEvent = {
  data: {
    userId: string;
    channelConfigId: string;
    topic?: string | null;
    requestedAt?: number;
    resume?: boolean;
    resumeFrom?: string;
  };
};

type ConversionCreatedEvent = { data: { conversionEventId: string; tenantId: string } };

type DistributionPlanCreatedEvent = { data: { planId: string; workspaceId: string } };

type CommissionMaturedEvent = { data: { updatedCount: number; promotedAt: number } };

type RevenueEventRecordedEvent = {
  data: {
    source: 'ad-revenue' | 'sponsorship' | 'affiliate' | 'commerce';
    externalId: string;
    amountCents: number;
    currency: string;
    workspaceId: string;
    assetId?: string;
    projectId?: string;
    recordedAtMs: number;
    metadata?: Record<string, unknown>;
  };
};

type CommercePaymentConfirmedEvent = {
  data: {
    orderId: string;
    productId: string;
    workspaceId: string;
    paymentId: string;
    /** Order total in INTEGER cents. */
    amountCents: number;
    currency: string;
  };
};

type PayoutBatchedEvent = {
  data: {
    batchId: string;
    affiliateId: string;
    /** Payout amount in INTEGER cents (no float drift). */
    totalCents: number;
    externalPaymentId: string;
  };
};

type PayoutConfirmedEvent = {
  data: { batchId: string; externalPaymentId: string; confirmedAt: number };
};

type PayoutReconcileAlertEvent = {
  data: {
    tenantId: string;
    /** All amounts in INTEGER cents. */
    ledgerTotalCents: number;
    batchTotalCents: number;
    diffCents: number;
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

/**
 * Merged event record served by the single canonical Inngest client.
 * 41 keys: the 28 former seed events, the 5 agent-mission events that
 * previously lived only in the tree client, the 4 production-graph
 * events added for the autonomous production factory (including
 * cancelled), the revenue/event.recorded event added for revenue
 * ingestion, the commerce/payment.confirmed event added for
 * digital product commerce, and the creative.mission.multitrack.requested
 * event for decoupled multi-track orchestration.
 */
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

export type Events = {
  "campaign.created": CampaignCreatedEvent;
  "campaign.progress": CampaignProgressEvent;
  "test/hello.world": { data: Record<string, unknown> };
  "key.rotation.requested": KeyRotationRequestedEvent;
  "url_revenue.video.requested": UrlRevenueVideoRequestedEvent;
  "video.requested": VideoJobPayload;
  "video.script.ready": VideoJobPayload;
  "video.tts.ready": VideoJobPayload;
  "video.visual.ready": VideoJobPayload;
  "video.composed": VideoJobPayload;
  "video.uploaded": VideoJobPayload;
  "video.published": VideoJobPayload;
  "video.dubbing.requested": { data: DubbingJobInput };
  "publish.scheduled": VideoJobPayload;
  "publish.token.refresh": { data: Record<string, never> };
  "video/generate.requested": VideoGenerateRequestedEvent;
  "batch/video.fanout": BatchVideoFanoutEvent;
  "sop/execution.requested": SopExecutionRequestedEvent;
  "sop/step.completed": SopStepCompletedEvent;
  "repurpose/analyze.requested": RepurposeAnalyzeEvent;
  "repurpose/clip.generate": RepurposeClipGenerateEvent;
  "analytics/sync.requested": AnalyticsSyncRequestedEvent;
  "conversion.created": ConversionCreatedEvent;
  "distribution/plan.created": DistributionPlanCreatedEvent;
  "commission.matured": CommissionMaturedEvent;
  "revenue/event.recorded": RevenueEventRecordedEvent;
  "commerce/payment.confirmed": CommercePaymentConfirmedEvent;
  "payout.batched": PayoutBatchedEvent;
  "payout.confirmed": PayoutConfirmedEvent;
  "payout.reconcile.alert": PayoutReconcileAlertEvent;
  "creative-memory/signal-accumulated": { data: { workspaceId: string; signalCount: number } };
  "youtube.content.pipeline.requested": YouTubeContentPipelineRequestedEvent;
  "agent.mission.started": AgentMissionStartedData;
  "agent.approval.requested": AgentApprovalRequestedData;
  "agent.approval.resolved": AgentApprovalResolvedData;
  "agent.mission.completed": AgentMissionCompletedData;
  "agent.mission.failed": AgentMissionFailedData;
  "production.graph.started": ProductionGraphStartedEvent;
  "production.graph.completed": ProductionGraphCompletedEvent;
  "production.graph.failed": ProductionGraphFailedEvent;
  "production.graph.cancelled": ProductionGraphCancelledEvent;
  "creative.mission.multitrack.requested": { data: CreativeMissionMultiTrackRequestedData };
  "commerce/catalog.sync.requested": CommerceCatalogSyncEvent;
  "commerce/product.delta.detected": CommerceProductDeltaEvent;
  "commerce/video.batch.dispatch.requested": CommerceVideoBatchDispatchEvent;
  "affiliate/conversion.reconciled": AffiliateConversionReconciledEvent;
  "affiliate/conversion.recorded": AffiliateConversionRecordedEvent;
  "niche.video.campaign.requested": NicheVideoCampaignRequestedEvent;
  "autonomous.video.pipeline.requested": AutonomousVideoPipelineRequestedEvent;
  "autonomous.campaign.scaling.requested": AutonomousCampaignScalingRequestedEvent;
  "social.syndication.requested": SocialSyndicationRequestedEvent;
  "social.publish.dispatched": SocialPublishDispatchedEvent;
  "social.analytics.sync_requested": SocialAnalyticsSyncRequestedEvent;
  "social.analytics.feedback_evaluated": SocialAnalyticsFeedbackEvaluatedEvent;
  "creative.mutation.requested": CreativeMutationRequestedEvent;
};

