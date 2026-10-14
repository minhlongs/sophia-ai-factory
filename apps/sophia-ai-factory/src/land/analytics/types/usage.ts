/**
 * Analytics API Types — Usage & Telemetry Metrics
 *
 * @module land/analytics/types/usage
 */

export type { AiService } from '@/seed/types/ai-service';
import type { AiService } from '@/seed/types/ai-service';

/**
 * Granularity for time-series data
 */
export type AnalyticsGranularity = 'hour' | 'day';

/**
 * Query filters for usage metrics
 */
export interface UsageFilters {
  licenseNonce?: string;
  startTimestamp: number;
  endTimestamp: number;
  granularity?: AnalyticsGranularity;
  service?: AiService;
}

/**
 * Summary statistics for usage metrics
 */
export interface UsageSummary {
  totalRequests: number;
  totalTokensInput: number;
  totalTokensOutput: number;
  totalCredits: number;
  avgResponseTimeMs: number;
  errorRate: number;
}

/**
 * Single point in time-series data
 */
export interface TimeSeriesPoint {
  timestamp: number;
  requests: number;
  credits: number;
  tokens: number;
  errors: number;
}

/**
 * Service-level breakdown
 */
export interface ServiceBreakdown {
  service: string;
  requests: number;
  credits: number;
  percentage: number;
}

/**
 * Complete usage metrics response
 */
export interface UsageMetrics {
  summary: UsageSummary;
  timeSeries: TimeSeriesPoint[];
  serviceBreakdown: ServiceBreakdown[];
}
