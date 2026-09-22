/**
 * @module seed/types/unit-economics-types
 *
 * Unit Economics, Multimodal Cost Arbitrage & Hybrid Edge Fallback Data Models
 * (Milestone M4: Autonomous Scale & Agency Multi-Tenancy Engine)
 *
 * Defines contracts for:
 * - Multimodal AI provider cost arbitrage (OpenRouter, fal.ai, ElevenLabs, Mekong GPU)
 * - Per-second video pipeline cost breakdown
 * - Circuit breaker fallback state & failover decisions
 * - Gross Margin %, COGS per video, LTV, CAC, and LTV:CAC unit economics
 *
 * Layer Rule: seed layer — pure types only, zero dependencies on tree, forest, land.
 */

// ─── Provider & Pipeline Stages ──────────────────────────────────────────────

export type EconomicsProviderId = 'openrouter' | 'fal' | 'elevenlabs' | 'mekong';

export type PipelineStage = 'script' | 'visuals' | 'audio' | 'render';

export interface StageProviderOption {
  provider: EconomicsProviderId | string;
  model: string;
  unitCostUsd: number;
  unitDescription: string; // e.g. "per 1K tokens", "per image frame", "per char", "unmetered"
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
  frameCount?: number; // default: Math.ceil(duration / 5)
  scriptPromptTokens?: number; // default: 1200
  scriptCompletionTokens?: number; // default: 400
  audioCharacterCount?: number; // default: duration * 14 chars
  maxBudgetUsd?: number;
  preferLocalEdge?: boolean;
  bypassEdge?: boolean;
}

// ─── Fallback & Circuit Breaker Types ────────────────────────────────────────

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

// ─── Unit Economics Metrics ──────────────────────────────────────────────────

/**
 * Core Unit Economics Metrics Contract
 * Directly aligned with PROJECT.md Interface Contract § 4
 */
export interface UnitEconomicsMetrics {
  grossMarginPct: number;
  totalRevenueUsd: number;
  totalCogsUsd: number;
  cogsPerVideoUsd: number;
  ltvUsd: number;
  cacUsd: number;
  ltvCacRatio: number;
  breakdownByProvider: Array<{
    provider: EconomicsProviderId;
    totalCostUsd: number;
    percentageOfTotal: number;
  }>;
}

export interface ProviderCostItem {
  provider: EconomicsProviderId | string;
  displayName: string;
  totalJobs: number;
  successfulJobs: number;
  failedJobs: number;
  totalCostUsd: number;
  avgCostPerJobUsd: number;
  costSharePct: number;
  failureRatePct: number;
  avgLatencyMs: number;
}

export interface TierMarginItem {
  tier: 'BASIC' | 'PREMIUM' | 'ENTERPRISE' | 'MASTER';
  monthlyPriceUsd: number;
  monthlyMcuQuota: number;
  estimatedVideoQuota: number;
  activeSubscribers: number;
  monthlyRevenueUsd: number;
  estimatedCogsUsd: number;
  grossMarginPct: number;
  status: 'OPTIMAL' | 'HEALTHY' | 'COMPRESSED';
}

export interface LtvCacMetrics {
  ltvUsd: number;
  cacUsd: number;
  ltvCacRatio: number;
  arpuUsd: number;
  estimatedMonthlyChurnPct: number;
  estimatedPaybackPeriodMonths: number;
  affiliateCommissionCogsUsd: number;
  directPromoDiscountCogsUsd: number;
  organicPaidCustomers: number;
  affiliateAcquiredCustomers: number;
}

export interface DailyEconomicsTrend {
  date: string;
  revenueUsd: number;
  cogsUsd: number;
  marginPct: number;
  videoJobsCompleted: number;
}

export interface UnitEconomicsSummary {
  metrics: UnitEconomicsMetrics;
  timeframeDays: number;
  totalVideosCompleted: number;
  activePayingCustomers: number;
  arpuUsd: number;
  activeEdgeNodes: number;
  edgeNodeSavingsUsd: number;
  tierEconomics: TierMarginItem[];
  providerCosts: ProviderCostItem[];
  ltvCacMetrics: LtvCacMetrics;
  trends: DailyEconomicsTrend[];
  generatedAt: string;
}
