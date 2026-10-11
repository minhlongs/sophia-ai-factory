export type {
  CampaignOutput,
  ChannelAdapter,
  ChannelStatus,
  DistributionResult,
  GatewayChannel,
  HealthReport,
  PublishResult,
  RetryPolicy,
} from '@/tree/gateway/gateway-types';

export const DEFAULT_RETRY_POLICY = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
};

/**
 * Bounded retry policy for selfHeal: max 3 attempts, delays [0, 1s, 2s].
 * Caps total per-channel wall-clock at ~3s so CF Worker CPU budget is safe.
 */
export const SELF_HEAL_RETRY_POLICY = {
  maxRetries: 2,
  baseDelayMs: 1000,
  maxDelayMs: 2000,
};

/** Concurrency cap for selfHeal parallel retries (CF Worker CPU budget). */
export const SELF_HEAL_CONCURRENCY = 5;

export interface SelfHealResult {
  healed: number;
  failed: number;
  errors: string[];
}
