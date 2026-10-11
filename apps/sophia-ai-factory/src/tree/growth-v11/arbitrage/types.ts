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
