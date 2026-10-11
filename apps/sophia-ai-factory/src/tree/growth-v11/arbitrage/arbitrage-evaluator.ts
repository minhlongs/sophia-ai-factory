import type {
  ComputeArbitrageSpec,
  ComputeArbitrageResult,
  CircuitBreakerMap,
  ModelProvider,
  PriorityLane,
} from './types';
import {
  MODEL_BASE_COST_PER_SECOND,
  OFF_PEAK_COST_MULTIPLIER,
  isOffPeakUtcHour,
} from './constants';
import {
  isProviderAvailable,
  selectTargetProvider,
  degradeProvider,
} from './provider-routing';

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
      reason:
        'Non-urgent batch generation deferred to off-peak window (02:00-08:00 UTC) for 42% cost reduction.',
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
