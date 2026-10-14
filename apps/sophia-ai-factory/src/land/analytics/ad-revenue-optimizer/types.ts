/**
 * Ad Revenue Optimizer Domain Contracts & Types
 *
 * Layer: land/analytics/ad-revenue-optimizer
 */

export interface VideoAdMetrics {
  readonly videoId: string;
  readonly views: number;
  readonly watchTimeMinutes: number;
  readonly estimatedRevenueUsd: number;
  readonly durationSeconds: number;
  readonly publishHourUtc?: number;
}

export type DurationCategory = 'short' | 'mid' | 'long';

export interface VideoYieldAnalysis {
  readonly videoId: string;
  readonly rpm: number;
  readonly cpm: number;
  readonly revenuePerMinuteWatched: number;
  readonly durationCategory: DurationCategory;
  readonly optimizationScore: number;
  readonly recommendations: readonly string[];
}

export interface FormatYieldSummary {
  readonly count: number;
  readonly views: number;
  readonly revenueUsd: number;
  readonly avgRpm: number;
}

export interface ChannelAdOptimizationReport {
  readonly totalViews: number;
  readonly totalRevenueUsd: number;
  readonly averageRpm: number;
  readonly topPerformingFormat: DurationCategory;
  readonly optimalDurationRange: { readonly minSeconds: number; readonly maxSeconds: number };
  readonly peakPublishHourUtc: number | null;
  readonly monetizationHealthScore: number;
  readonly formatBreakdown: Record<DurationCategory, FormatYieldSummary>;
  readonly actionableInsights: readonly string[];
}

export interface RevenueProjection {
  readonly estimatedRevenueUsd: number;
  readonly confidenceMinUsd: number;
  readonly confidenceMaxUsd: number;
}
