import { CircuitState } from '@/seed/types/failure-kind';
import type {
  ModelProvider,
  PriorityLane,
  QualityRequirement,
  UrgencyLevel,
  CircuitBreakerMap,
} from './types';

export interface TargetSelection {
  targetProvider: ModelProvider;
  priorityLane: PriorityLane;
}

export interface DegradationResult {
  provider: ModelProvider;
  priorityLane: PriorityLane;
  reason: string;
}

/**
 * Inspects circuit breaker state for a specific model provider
 */
export function isProviderAvailable(
  provider: ModelProvider,
  breakerState?: CircuitBreakerMap
): boolean {
  if (!breakerState) return true;

  let state: string | undefined;
  if (breakerState instanceof Map) {
    state = breakerState.get(provider);
  } else if (typeof breakerState === 'object') {
    state = breakerState[provider];
  }

  if (!state) return true;
  return state !== CircuitState.OPEN && state !== 'OPEN';
}

export function selectTargetProvider(
  isHighVelocity: boolean,
  quality: QualityRequirement,
  urgency: UrgencyLevel
): TargetSelection {
  if (isHighVelocity || quality === 'PHOTOREAL') {
    return { targetProvider: 'HEYGEN_STUDIO', priorityLane: 'PRIORITY' };
  }
  if (quality === 'EXPRESS' || urgency === 'BATCH' || urgency === 'LOW') {
    return { targetProvider: 'FAL_WAN', priorityLane: 'OFFPEAK_BATCH' };
  }
  return {
    targetProvider: 'DID_EXPRESS',
    priorityLane: isHighVelocity || urgency === 'HIGH' ? 'PRIORITY' : 'OFFPEAK_BATCH',
  };
}

export function degradeProvider(
  current: ModelProvider,
  currentLane: PriorityLane,
  breakerState?: CircuitBreakerMap
): DegradationResult {
  if (current === 'HEYGEN_STUDIO') {
    if (isProviderAvailable('DID_EXPRESS', breakerState)) {
      return {
        provider: 'DID_EXPRESS',
        priorityLane: currentLane,
        reason: 'Circuit breaker OPEN for HEYGEN_STUDIO: degraded to DID_EXPRESS.',
      };
    }
    if (isProviderAvailable('FAL_WAN', breakerState)) {
      return {
        provider: 'FAL_WAN',
        priorityLane: currentLane,
        reason: 'Circuit breakers OPEN for HEYGEN_STUDIO and DID_EXPRESS: degraded to FAL_WAN.',
      };
    }
    return {
      provider: 'DEFERRED_OFFPEAK',
      priorityLane: 'OFFPEAK_BATCH',
      reason: 'All upstream visual providers tripped circuit breakers: deferred to off-peak queue.',
    };
  }

  if (current === 'DID_EXPRESS') {
    if (isProviderAvailable('FAL_WAN', breakerState)) {
      return {
        provider: 'FAL_WAN',
        priorityLane: currentLane,
        reason: 'Circuit breaker OPEN for DID_EXPRESS: degraded to FAL_WAN.',
      };
    }
    if (isProviderAvailable('HEYGEN_STUDIO', breakerState)) {
      return {
        provider: 'HEYGEN_STUDIO',
        priorityLane: currentLane,
        reason: 'Circuit breaker OPEN for DID_EXPRESS: upgraded to available HEYGEN_STUDIO.',
      };
    }
    return {
      provider: 'DEFERRED_OFFPEAK',
      priorityLane: 'OFFPEAK_BATCH',
      reason: 'All express providers tripped: deferred to off-peak queue.',
    };
  }

  if (current === 'FAL_WAN') {
    if (isProviderAvailable('DID_EXPRESS', breakerState)) {
      return {
        provider: 'DID_EXPRESS',
        priorityLane: currentLane,
        reason: 'Circuit breaker OPEN for FAL_WAN: failed over to DID_EXPRESS.',
      };
    }
    return {
      provider: 'DEFERRED_OFFPEAK',
      priorityLane: 'OFFPEAK_BATCH',
      reason: 'FAL_WAN circuit breaker OPEN: deferred to off-peak queue.',
    };
  }

  return {
    provider: 'DEFERRED_OFFPEAK',
    priorityLane: 'OFFPEAK_BATCH',
    reason: 'Provider unavailable: deferred to off-peak queue.',
  };
}
