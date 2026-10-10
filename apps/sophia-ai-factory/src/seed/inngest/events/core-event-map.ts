/**
 * @file core-event-map.ts
 * @description Core Inngest event map for pipeline, commerce, agent missions, and production graph.
 * @layer seed
 */

import type {
  CampaignCreatedEvent,
  CampaignProgressEvent,
  VideoJobPayload,
  VideoGenerateRequestedEvent,
  BatchVideoFanoutEvent,
  UrlRevenueVideoRequestedEvent,
  SopExecutionRequestedEvent,
  SopStepCompletedEvent,
  RepurposeAnalyzeEvent,
  RepurposeClipGenerateEvent,
  AnalyticsSyncRequestedEvent,
  KeyRotationRequestedEvent,
  YouTubeContentPipelineRequestedEvent,
  CreativeMissionMultiTrackRequestedData,
  AutonomousVideoPipelineRequestedEvent,
  NicheVideoCampaignRequestedEvent,
  AutonomousCampaignScalingRequestedEvent,
  VideoMultiTrackPipelineRequestedEvent,
} from './pipeline-events';

import type {
  ConversionCreatedEvent,
  DistributionPlanCreatedEvent,
  CommissionMaturedEvent,
  RevenueEventRecordedEvent,
  CommercePaymentConfirmedEvent,
  PayoutBatchedEvent,
  PayoutConfirmedEvent,
  PayoutReconcileAlertEvent,
} from './commerce-payout-events';

import type {
  AgentMissionStartedData,
  AgentApprovalRequestedData,
  AgentApprovalResolvedData,
  AgentMissionCompletedData,
  AgentMissionFailedData,
} from '../agent-event-types';

import type {
  ProductionGraphStartedEvent,
  ProductionGraphCompletedEvent,
  ProductionGraphFailedEvent,
  ProductionGraphCancelledEvent,
} from '@/seed/types/production-factory';

import type { DubbingJobInput } from '@/seed/types/dubbing';

import type {
  CommerceCatalogSyncEvent,
  CommerceProductDeltaEvent,
  CommerceVideoBatchDispatchEvent,
  AffiliateConversionReconciledEvent,
  AffiliateConversionRecordedEvent,
} from '@/seed/types/inngest-ecommerce';

export type CoreEvents = {
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
  "video.multitrack.pipeline.requested": VideoMultiTrackPipelineRequestedEvent;
};
