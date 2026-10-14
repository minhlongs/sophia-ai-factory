/**
 * @module seed/types/unit-economics-types
 *
 * Unit Economics, Multimodal Cost Arbitrage & Hybrid Edge Fallback Data Models
 * (Milestone M4: Autonomous Scale & Agency Multi-Tenancy Engine)
 *
 * Layer Rule: seed layer — pure types only, zero dependencies on tree, forest, land.
 */

export type EconomicsProviderId = 'openrouter' | 'fal' | 'elevenlabs' | 'mekong';

export type PipelineStage = 'script' | 'visuals' | 'audio' | 'render';

export interface StageProviderOption {
  provider: EconomicsProviderId | string;
  model: string;
  unitCostUsd: number;
  unitDescription: string;
  isUnmetered: boolean;
  latencyAvgMs: number;
}

export interface PipelineStageCosts {
  scriptCostUsd: number;
  visualsCostUsd: number;
  audioCostUsd: number;
  renderCostUsd: number;
  totalPipelineCostUsd: number;
  durationSeconds: number;
  costPerSecondUsd: number;
}

export type ArbitrageStrategy =
  | 'cheapest_healthy'
  | 'mekong_edge_first'
  | 'quality_priority'
  | 'emergency_cloud_fallback';

export interface StageSelection {
  stage: PipelineStage;
  provider: EconomicsProviderId | string;
  model: string;
  estimatedCostUsd: number;
  isUnmetered: boolean;
  circuitState: 'CLOSED' | 'DEGRADED' | 'OPEN' | 'HALF_OPEN';
}

export interface CostArbitrageDecision {
  selectedStages: {
    script: StageSelection;
    visuals: StageSelection;
    audio: StageSelection;
    render: StageSelection;
  };
  totalEstimatedCostUsd: number;
  durationSeconds: number;
  costPerSecondUsd: number;
  isMekongGpuAccelerated: boolean;
  savingsVsCloudUsd: number;
  savingsPercentage: number;
  strategy: ArbitrageStrategy;
  decisionReason: string;
  evaluatedAt: string;
  withinBudget: boolean;
  budgetLimitUsd?: number;
}

export interface VideoPipelineSpec {
  targetDurationSeconds: number;
  frameCount?: number;
  scriptPromptTokens?: number;
  scriptCompletionTokens?: number;
  audioCharacterCount?: number;
  maxBudgetUsd?: number;
  preferLocalEdge?: boolean;
  bypassEdge?: boolean;
}

export interface ProviderHealthStatus {
  provider: string;
  circuitState: 'CLOSED' | 'DEGRADED' | 'OPEN' | 'HALF_OPEN';
  isAvailable: boolean;
  failureCount: number;
  consecutiveNetworkFailures: number;
  cooldownUntil: number | null;
  lastFailureAt: number | null;
  lastFailureReason?: string;
  latencyMs?: number;
}

export interface FallbackExecutionResult<T> {
  result: T;
  providerUsed: string;
  fallbackTriggered: boolean;
  primaryProvider: string;
  fallbackReason?: string;
  latencyMs: number;
  attemptsCount: number;
}

export type {
  UnitEconomicsMetrics,
  ProviderCostItem,
  TierMarginItem,
  LtvCacMetrics,
  DailyEconomicsTrend,
  UnitEconomicsSummary,
} from './unit-economics-summary-types';
