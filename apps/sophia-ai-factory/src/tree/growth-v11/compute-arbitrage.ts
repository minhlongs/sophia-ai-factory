/**
 * @file compute-arbitrage.ts
 * @description Zero-IO mathematical optimization engine for opportunistic compute arbitrage,
 * dynamic model routing, and circuit breaker failover.
 * @layer tree
 */

import { CircuitState } from '@/seed/types/failure-kind';

export type ModelProvider = 'HEYGEN_STUDIO' | 'DID_EXPRESS' | 'FAL_WAN' | 'DEFERRED_OFFPEAK';

export type PriorityLane = 'PRIORITY' | 'OFFPEAK_BATCH';

export type QualityRequirement = 'PHOTOREAL' | 'STANDARD' | 'EXPRESS';

export type UrgencyLevel = 'HIGH' | 'NORMAL' | 'BATCH' | 'LOW';

export interface ComputeArbitrageSpec {
  durationSeconds: number;
  isHighVelocity?: boolean;
  qualityRequirement?: QualityRequirement;
  allowDeferred?: boolean;
  urgency?: UrgencyLevel;
  resolution?: '720p' | '1080p' | '4k';
  sceneCount?: number;
}

export type CircuitBreakerMap =
  | Record<string, CircuitState | 'CLOSED' | 'OPEN' | 'HALF_OPEN' | 'DEGRADED' | string>
  | Map<string, CircuitState | string>;

export interface ComputeArbitrageResult {
  /** Optimal selected model provider */
  provider: ModelProvider;
  /** Alias for provider */
  optimalProvider: ModelProvider;
  /** Estimated cost in USD */
  estimatedDollarCost: number;
  /** Alias for estimatedDollarCost */
  estimatedCostUsd: number;
  /** Execution lane */
  priorityLane: PriorityLane;
  /** Whether the evaluation occurred during off-peak UTC window */
  isOffPeak: boolean;
  /** Estimated dollar savings vs standard peak baseline */
  savingsUsd: number;
  /** Optimization explanation */
  reason: string;
}

/**
 * Base cost per second of render across models (USD)
 */
export const MODEL_BASE_COST_PER_SECOND: Record<ModelProvider, number> = {
  HEYGEN_STUDIO: 0.10, // $6.00/min - photoreal avatar
  DID_EXPRESS: 0.04,   // $2.40/min - fast digital avatar
  FAL_WAN: 0.015,      // $0.90/min - open-weight diffusion
  DEFERRED_OFFPEAK: 0, // $0.00 while in deferred hold queue
};

/**
 * Off-peak UTC window hours [02:00, 08:00)
 */
export const OFF_PEAK_START_HOUR_UTC = 2;
export const OFF_PEAK_END_HOUR_UTC = 8;

/**
 * Off-peak discount factor (42% discount = 0.58 multiplier)
 */
export const OFF_PEAK_DISCOUNT_PERCENT = 42;
export const OFF_PEAK_COST_MULTIPLIER = 0.58;

/**
 * Determines if a given UTC hour falls within the off-peak compute window [02:00, 08:00)
 */
export function isOffPeakUtcHour(hour: number): boolean {
  if (typeof hour !== 'number' || isNaN(hour)) {
    return false;
  }
  const normalizedHour = ((Math.floor(hour) % 24) + 24) % 24;
  return normalizedHour >= OFF_PEAK_START_HOUR_UTC && normalizedHour < OFF_PEAK_END_HOUR_UTC;
}

/**
 * Inspects circuit breaker state for a specific model provider
 */
function isProviderAvailable(provider: ModelProvider, breakerState?: CircuitBreakerMap): boolean {
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

interface TargetSelection {
  targetProvider: ModelProvider;
  priorityLane: PriorityLane;
}

function selectTargetProvider(
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

interface DegradationResult {
  provider: ModelProvider;
  priorityLane: PriorityLane;
  reason: string;
}

function degradeProvider(
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

/**
 * Pure Zero-IO mathematical evaluation for compute and model arbitrage.
 */
export function evaluateComputeArbitrage(
  spec: ComputeArbitrageSpec,
  currentHourUtc: number,
  circuitBreakerState?: CircuitBreakerMap
): ComputeArbitrageResult {
  const duration = Math.max(0, spec.durationSeconds || 0);
  const isOffPeak = isOffPeakUtcHour(currentHourUtc);
  const isHighVelocity = Boolean(spec.isHighVelocity);
  const urgency = spec.urgency || (isHighVelocity ? 'HIGH' : 'NORMAL');
  const allowDeferred = Boolean(spec.allowDeferred || urgency === 'BATCH' || urgency === 'LOW');
  const quality = spec.qualityRequirement || (isHighVelocity ? 'PHOTOREAL' : 'STANDARD');

  // Baseline cost (Peak HeyGen Photoreal) for savings comparison
  const baselineCost = duration * MODEL_BASE_COST_PER_SECOND.HEYGEN_STUDIO;

  // 1. Opportunistic Deferral: Non-urgent jobs outside off-peak hours
  if (!isHighVelocity && allowDeferred && !isOffPeak) {
    return {
      provider: 'DEFERRED_OFFPEAK',
      optimalProvider: 'DEFERRED_OFFPEAK',
      estimatedDollarCost: 0,
      estimatedCostUsd: 0,
      priorityLane: 'OFFPEAK_BATCH',
      isOffPeak: false,
      savingsUsd: Number(baselineCost.toFixed(4)),
      reason: 'Non-urgent batch generation deferred to off-peak window (02:00-08:00 UTC) for 42% cost reduction.',
    };
  }

  // 2. Select initial target provider based on quality & urgency
  const target = selectTargetProvider(isHighVelocity, quality, urgency);
  let selectedProvider: ModelProvider = target.targetProvider;
  let priorityLane: PriorityLane = target.priorityLane;
  let reason = `Selected ${selectedProvider} for ${quality} quality profile.`;

  // 3. Circuit breaker degradation chain if needed
  if (!isProviderAvailable(selectedProvider, circuitBreakerState)) {
    const degraded = degradeProvider(selectedProvider, priorityLane, circuitBreakerState);
    selectedProvider = degraded.provider;
    priorityLane = degraded.priorityLane;
    reason = degraded.reason;
  }

  // 4. Calculate final dollar cost & savings
  if (selectedProvider === 'DEFERRED_OFFPEAK') {
    return {
      provider: 'DEFERRED_OFFPEAK',
      optimalProvider: 'DEFERRED_OFFPEAK',
      estimatedDollarCost: 0,
      estimatedCostUsd: 0,
      priorityLane: 'OFFPEAK_BATCH',
      isOffPeak,
      savingsUsd: Number(baselineCost.toFixed(4)),
      reason,
    };
  }

  const baseRate = MODEL_BASE_COST_PER_SECOND[selectedProvider];
  const multiplier = isOffPeak || priorityLane === 'OFFPEAK_BATCH' ? OFF_PEAK_COST_MULTIPLIER : 1.0;
  const cost = duration * baseRate * multiplier;
  const savings = Math.max(0, baselineCost - cost);

  if (isOffPeak) {
    reason += ` Applied 42% off-peak discount in window [02:00-08:00 UTC].`;
  }

  return {
    provider: selectedProvider,
    optimalProvider: selectedProvider,
    estimatedDollarCost: Number(cost.toFixed(4)),
    estimatedCostUsd: Number(cost.toFixed(4)),
    priorityLane,
    isOffPeak,
    savingsUsd: Number(savings.toFixed(4)),
    reason,
  };
}
