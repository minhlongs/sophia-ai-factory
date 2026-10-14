/**
 * Provider Capabilities & Health Definitions
 *
 * Layer: seed/ai/provider
 */

/**
 * What a provider/model combination supports.
 */
export interface ProviderCapabilities {
  streaming: boolean;
  systemRole: boolean;
  maxOutputTokens: number;
  maxInputTokens: number;
  functionCalling: boolean;
  vision: boolean;
}

/**
 * Runtime health snapshot for a provider.
 */
export interface ProviderHealth {
  healthy: boolean;
  inCooldown: boolean;
  cooldownUntil?: number;
  avgLatencyMs: number;
  lastSuccess: number;
  lastFailure: number;
  consecutiveFailures: number;
  totalRequests: number;
  totalSuccesses: number;
  totalFailures: number;
}
