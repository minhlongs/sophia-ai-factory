/**
 * OpenClaw Gateway module barrel export.
 * Re-exports all gateway types, classes, and adapters.
 */

export { OpenClawGateway } from "./openclaw-gateway";
export type {
  CampaignOutput,
  ChannelAdapter,
  ChannelStatus,
  Checkpoint,
  DistributionResult,
  GatewayChannel,
  HealthReport,
  PublishResult,
  RetryPolicy,
} from "./gateway-types";
export { SmartResumeEngine } from "./smart-resume-engine";
export type { PipelineStep } from "./smart-resume-engine";
export { YouTubeChannelAdapter } from "./adapters/youtube-channel-adapter";
export { TikTokChannelAdapter } from "./adapters/tiktok-channel-adapter";
export { TelegramNotificationAdapter } from "./adapters/telegram-notification-adapter";
