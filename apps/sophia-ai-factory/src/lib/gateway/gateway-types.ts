/**
 * OpenClaw Gateway type definitions.
 * Multi-channel content distribution gateway with self-healing capabilities.
 */

/** Content output from a completed campaign, ready for distribution */
export interface CampaignOutput {
  campaignId: string;
  videoUrl: string;
  thumbnailUrl?: string;
  title: string;
  description: string;
  tags: string[];
}

/** Result of publishing content to a single channel */
export interface PublishResult {
  channelId: string;
  success: boolean;
  publishedUrl?: string;
  error?: string;
}

/** Status of a distribution channel */
export interface ChannelStatus {
  channelId: string;
  healthy: boolean;
  lastPublished?: Date;
  queueSize: number;
}

/** Aggregated result of distributing content to all channels */
export interface DistributionResult {
  campaignId: string;
  results: PublishResult[];
  allSucceeded: boolean;
}

/** Overall health report for all registered channels */
export interface HealthReport {
  timestamp: Date;
  channels: ChannelStatus[];
  overallHealthy: boolean;
}

/** Configuration for retry behavior with exponential backoff */
export interface RetryPolicy {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

/** Interface that all channel adapters must implement */
export interface ChannelAdapter {
  publish(content: CampaignOutput): Promise<PublishResult>;
  getStatus(): Promise<ChannelStatus>;
  healthCheck(): Promise<boolean>;
}

/** A registered distribution channel with its adapter and configuration */
export interface GatewayChannel {
  id: string;
  name: string;
  adapter: ChannelAdapter;
  enabled: boolean;
  rateLimitPerHour: number;
}
