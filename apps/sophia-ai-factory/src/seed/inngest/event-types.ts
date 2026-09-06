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

type CreativeImageRequestedEvent = {
  data: {
    missionId: string;
    userId: string;
    jobId: string;
    prompt: string;
    negativePrompt?: string;
    aspectRatio?: '1:1' | '16:9' | '9:16' | '4:3';
    style?: string;
    seed?: number;
    idempotencyKey?: string;
    constraints?: {
      aspectRatio: '1:1' | '16:9' | '9:16' | '4:3';
      style?: string;
      timeoutMs: number;
      maxCostCents?: number;
    };
  };
};

type CreativeImageCompletedEvent = {
  data: {
    jobId: string;
    missionId: string;
    userId: string;
    assetRef: string;
    provider: string;
    costCents?: number;
    latencyMs?: number;
    promptHash: string;
    generatedAt: string;
  };
};

type CreativeImageFailedEvent = {
  data: {
    jobId: string;
    missionId: string;
    userId: string;
    error: string;
    code: string;
    kind: import('@/seed/types/failure-kind').FailureKind;
    attempt: number;
  };
};

/**
 * Merged event record served by the single canonical Inngest client.
 * 43 keys: the 28 former seed events, the 5 agent-mission events that
 * previously lived only in the tree client, the 4 production-graph
 * events added for the autonomous production factory (including
 * cancelled), the revenue/event.recorded event added for revenue
 * ingestion, the commerce/payment.confirmed event added for
 * digital product commerce, and the 3 creative image lifecycle events
 * added for Creative Cell V1.
 */
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
  "creative/image.requested": CreativeImageRequestedEvent;
  "creative/image.completed": CreativeImageCompletedEvent;
  "creative/image.failed": CreativeImageFailedEvent;
};
