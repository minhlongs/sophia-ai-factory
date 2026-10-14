/**
 * Analytics Usage Metrics Types
 *
 * Layer: forest/analytics/types
 */

export type { AiService } from '@/tree/usage-metering/types';
import type { AiService } from '@/tree/usage-metering/types';

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
