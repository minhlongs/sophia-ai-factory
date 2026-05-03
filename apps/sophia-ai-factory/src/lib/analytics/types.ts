/**
 * Analytics API Types
 *
 * Type definitions for analytics dashboard data
 */

// Re-export AiService from usage-metering for use in API routes
export type { AiService } from '@/forest/usage-metering/types';
import type { AiService } from '@/forest/usage-metering/types';

// ============================================================================
// Usage Metrics Types
// ============================================================================

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

// ============================================================================
// Revenue Metrics Types
// ============================================================================

/**
 * Revenue period filter
 */
export type RevenuePeriod = 'current_month' | 'last_month' | 'last_7_days' | 'last_30_days';

/**
 * Revenue breakdown by tier
 */
export interface TierRevenue {
  tier: string;
  customers: number;
  revenue: number;
}

/**
 * Revenue trend data point
 */
export interface RevenueTrend {
  date: string; // YYYY-MM-DD
  revenue: number;
}

/**
 * Complete revenue metrics response
 */
export interface RevenueMetrics {
  totalRevenue: number;
  recurringRevenue: number; // MRR
  oneTimeRevenue: number;
  byTier: TierRevenue[];
  trend: RevenueTrend[];
}

// ============================================================================
// License Metrics Types
// ============================================================================

/**
 * License status filter
 */
export type LicenseStatus = 'active' | 'expired' | 'revoked' | 'all';

/**
 * Query filters for license metrics
 */
export interface LicenseFilters {
  status?: LicenseStatus;
  tier?: string;
}

/**
 * License utilization data
 */
export interface LicenseUtilization {
  licenseNonce: string;
  tier: string;
  usedCredits: number;
  limitCredit: number;
  percentage: number;
  expiresAt: number | null;
  // Overage billing fields (Phase 6)
  overageCount?: number;      // Number of overage events
  billableCount?: number;     // Number of billable overage events
  overageCredits?: number;    // Total overage credits
}

/**
 * Complete license metrics response
 */
export interface LicenseMetrics {
  total: number;
  byTier: Record<string, number>;
  utilization: LicenseUtilization[];
}

// ============================================================================
// API Response Types
// ============================================================================

/**
 * Standard API error response
 */
export interface AnalyticsErrorResponse {
  error: string;
  details?: Record<string, string>;
}

/**
 * User context for RBAC
 */
export interface UserContext {
  userId: string;
  tier: string;
  is_admin: boolean;
}

// ============================================================================
// Violation & Quota Enforcement Types
// ============================================================================

/**
 * Violation type enum
 */
export type ViolationType =
  | 'quota_exceeded'
  | 'invalid_license'
  | 'expired_license'
  | 'revoked_license'
  | 'rate_limit_exceeded'
  | 'unauthorized_access'
  | 'cross_tenant_access';

/**
 * Violation severity levels
 */
export type ViolationSeverity = 'low' | 'medium' | 'high' | 'critical';

/**
 * Violation event for analytics dashboard
 */
export interface ViolationEvent {
  id: string;
  type: ViolationType;
  severity: ViolationSeverity;
  userId: string;
  licenseNonce: string;
  tier: string;
  endpoint: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, string>;
  createdAt: number;
  resolved: boolean;
  resolvedAt?: number;
}

/**
 * Violation summary statistics
 */
export interface ViolationSummary {
  totalViolations: number;
  byType: Record<ViolationType, number>;
  bySeverity: Record<ViolationSeverity, number>;
  byTier: Record<string, number>;
  resolvedCount: number;
  unresolvedCount: number;
  trend: Array<{
    date: string;
    count: number;
  }>;
}

/**
 * Query filters for violation events
 */
export interface ViolationFilters {
  licenseNonce?: string;
  userId?: string;
  type?: ViolationType;
  severity?: ViolationSeverity;
  startTimestamp?: number;
  endTimestamp?: number;
  resolved?: boolean;
}
