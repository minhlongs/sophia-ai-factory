/**
 * @file pipeline-events.ts
 * @description Inngest event contracts for video generation and autonomous campaigns.
 * @layer seed
 */

export type {
  CampaignCreatedEvent,
  CampaignProgressEvent,
  VideoJobPayload,
  VideoGenerateRequestedEvent,
  BatchVideoFanoutEvent,
  UrlRevenueVideoRequestedEvent,
} from './pipeline-campaign-events';

export type {
  SopExecutionRequestedEvent,
  SopStepCompletedEvent,
  RepurposeAnalyzeEvent,
  RepurposeClipGenerateEvent,
  AnalyticsSyncRequestedEvent,
  KeyRotationRequestedEvent,
  YouTubeContentPipelineRequestedEvent,
} from './pipeline-sop-repurpose-events';

export type {
  CreativeMissionMultiTrackRequestedData,
  AutonomousVideoPipelineRequestedEvent,
  NicheVideoCampaignRequestedEvent,
  AutonomousCampaignScalingRequestedEvent,
  VideoMultiTrackPipelineRequestedEvent,
} from './pipeline-autonomous-events';
