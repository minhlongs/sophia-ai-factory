import { createLogger } from '@/seed/utils/logger-utility';
import {
  shouldAllowRequest,
  getState,
  reset,
} from '@/seed/security/circuit-breaker';
import type { ProviderHealthStatus } from '@/seed/types/unit-economics-types';

const logger = createLogger('tree/ai/cost-arbitrage-fallback');

/**
 * Evaluates real-time health and circuit breaker status for a specific provider.
 */
export function evaluateProviderHealth(
  provider: string,
  tenantKeyRef = 'platform',
): ProviderHealthStatus {
  const entry = getState(provider, tenantKeyRef);
  const isAvailable = shouldAllowRequest(provider, tenantKeyRef);

  return {
    provider,
    circuitState: entry.state,
    isAvailable,
    failureCount: entry.failureCount,
    consecutiveNetworkFailures: entry.consecutiveConnectionFailures ?? 0,
    cooldownUntil: entry.cooldownUntil,
    lastFailureAt: entry.lastFailureAt,
  };
}

/**
 * Manually resets circuit breaker state for a provider.
 */
export function resetProviderHealth(provider: string, tenantKeyRef = 'platform'): void {
  reset(provider, tenantKeyRef);
  logger.info('ARBITRAGE_PROVIDER_RESET', { provider, tenantKeyRef });
}
