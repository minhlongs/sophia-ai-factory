/**
 * Analytics API Types — Violations, Enforcement & Learning Velocity
 *
 * @module land/analytics/types/violations-learning
 */

export interface AnalyticsErrorResponse {
  error: string;
  details?: Record<string, string>;
}

export interface UserContext {
  userId: string;
  tier: string;
  is_admin: boolean;
}

export type ViolationType =
  | 'quota_exceeded'
  | 'invalid_license'
  | 'expired_license'
  | 'revoked_license'
  | 'rate_limit_exceeded'
  | 'unauthorized_access'
  | 'cross_tenant_access';

export type ViolationSeverity = 'low' | 'medium' | 'high' | 'critical';

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

export interface ViolationFilters {
  licenseNonce?: string;
  userId?: string;
  type?: ViolationType;
  severity?: ViolationSeverity;
  startTimestamp?: number;
  endTimestamp?: number;
  resolved?: boolean;
}

export interface LearningVelocitySummary {
  entityType: string;
  channel: string;
  velocityScore: number;
  eventCount: number;
  trend: 'improving' | 'stable' | 'declining';
  avgMetrics: Record<string, number>;
}

export interface LearningVelocityResponse {
  workspaceId: string;
  summaries: LearningVelocitySummary[];
  totalEntities: number;
  totalChannels: number;
}
