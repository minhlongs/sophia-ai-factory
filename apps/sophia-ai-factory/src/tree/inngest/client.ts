import { Inngest, EventSchemas } from "inngest";
import { Tier } from "@/seed/types";

export type AgentMissionStartedData = {
  data: {
    runId: string;
    agentId: string;
    missionId: string;
    workspaceId: string;
    autonomyLevel?: number;
    inputJson?: Record<string, unknown>;
  };
};

export type AgentApprovalRequestedData = {
  data: {
    runId: string;
    approvalId: string;
    actionType: string;
    actionSummary: string;
    missionId: string;
  };
};

export type AgentApprovalResolvedData = {
  data: {
    approvalId: string;
    runId: string;
    status: "approved" | "rejected";
    reviewerId: string;
    comment?: string;
  };
};

export type AgentMissionCompletedData = {
  data: {
    runId: string;
    agentId: string;
    missionId: string;
    totalCostCents: number;
    totalTokens: number;
  };
};

export type AgentMissionFailedData = {
  data: {
    runId: string;
    agentId: string;
    missionId: string;
    errorCode: string;
    errorMessage: string;
  };
};

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

type VideoJobPayload = {
  data: {
    jobId: string;
    tenantId: string;
    userId: string;
    attempt?: number;
  };
};

type ConversionCreatedEvent = {
  data: {
    conversionEventId: string;
    tenantId: string;
  };
};

type CommissionMaturedEvent = {
  data: {
    updatedCount: number;
    promotedAt: number;
  };
};

type PayoutBatchedEvent = {
  data: {
    batchId: string;
    affiliateId: string;
    totalCents: number;
    externalPaymentId: string;
  };
};

type PayoutConfirmedEvent = {
  data: {
    batchId: string;
    externalPaymentId: string;
    confirmedAt: number;
  };
};

type PayoutReconcileAlertEvent = {
  data: {
    tenantId: string;
    ledgerTotalCents: number;
    batchTotalCents: number;
    diffCents: number;
  };
};

type UrlRevenueVideoRequestedEvent = {
  data: {
    jobId: string;
    tenantId: string;
    userId: string;
    prompt: string;
    locale: string;
    channel: string;
    trackingLink?: string;
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
  data: {
    executionId: string;
    stepOrder: number;
    result: Record<string, unknown>;
  };
};

type BatchVideoFanoutEvent = {
  data: {
    batchId: string;
    userId: string;
  };
};

type AnalyticsSyncRequestedEvent = {
  data: {
    userId: string;
    requestedAt: number;
  };
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

type KeyRotationRequestedEvent = {
  data: {
    keyVersion: number;
    reason?: string;
  };
};

type Events = {
  "campaign.created": CampaignCreatedEvent;
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
  "commission.matured": CommissionMaturedEvent;
  "payout.batched": PayoutBatchedEvent;
  "payout.confirmed": PayoutConfirmedEvent;
  "payout.reconcile.alert": PayoutReconcileAlertEvent;
  "agent.mission.started": AgentMissionStartedEvent;
  "agent.approval.requested": AgentApprovalRequestedEvent;
  "agent.approval.resolved": AgentApprovalResolvedEvent;
  "agent.mission.completed": AgentMissionCompletedEvent;
  "agent.mission.failed": AgentMissionFailedEvent;
};

type AgentMissionStartedEvent = {
  data: {
    runId: string;
    agentId: string;
    missionId: string;
    workspaceId: string;
  };
};

type AgentApprovalRequestedEvent = {
  data: {
    runId: string;
    approvalId: string;
    actionType: string;
    actionSummary: string;
    missionId: string;
  };
};

type AgentApprovalResolvedEvent = {
  data: {
    approvalId: string;
    runId: string;
    status: "approved" | "rejected";
    reviewerId: string;
    comment?: string;
  };
};

type AgentMissionCompletedEvent = {
  data: {
    runId: string;
    agentId: string;
    missionId: string;
    totalCostCents: number;
    totalTokens: number;
  };
};

type AgentMissionFailedEvent = {
  data: {
    runId: string;
    agentId: string;
    missionId: string;
    errorCode: string;
    errorMessage: string;
  };
};

export const inngest = new Inngest({
  id: "sophia-ai-factory",
  schemas: new EventSchemas().fromRecord<Events>(),
});
