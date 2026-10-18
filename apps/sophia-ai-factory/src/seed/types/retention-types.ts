/**
 * Retention & Anti-Churn AI Guardian Domain Types
 * Types for 4-factor Customer Health Scoring (0–100), churn risk detection,
 * automated win-back triggers, and 1-click founder intervention.
 * @module seed/types/retention-types
 */

export type ChurnRiskLevel = 'HEALTHY' | 'WARNING' | 'CRITICAL_CHURN_RISK';

/** Breakdown of 4 core health factors (each scored 0–25, summing to 0–100). */
export interface HealthFactorBreakdown {
  recency: number;
  velocity: number;
  capacity: number;
  reliability: number;
}

/** Raw telemetry inputs used to compute the 4 health factor scores. */
export interface RawCustomerActivityMetrics {
  userId: string;
  userEmail: string;
  userName?: string | null;
  lastActiveAt: string | null;
  daysSinceLastActive: number;
  videosCreated30d: number;
  creditsRemaining: number;
  creditsPurchased: number;
  totalJobs: number;
  completedJobs: number;
  failedJobs: number;
  renderSuccessRate: number;
}

/** Computed Customer Health Metrics for anti-churn monitoring. */
export interface CustomerHealthMetrics {
  userId: string;
  userEmail: string;
  userName?: string;
  recencyScore: number;
  velocityScore: number;
  capacityScore: number;
  reliabilityScore: number;
  totalHealthScore: number;
  status: ChurnRiskLevel;
  lastActiveAt: string;
  breakdown: HealthFactorBreakdown;
  rawMetrics: RawCustomerActivityMetrics;
  lastWinBackAt?: string | null;
  inCooldown?: boolean;
}

/** Result of automated or manual win-back trigger dispatch. */
export interface WinBackTriggerResult {
  userId: string;
  userEmail: string;
  emailSent: boolean;
  telegramNotified: boolean;
  timestamp: string;
  healthScore: number;
  skippedReason?: 'COOLDOWN_ACTIVE' | 'NOT_AT_RISK' | 'DISPATCH_ERROR';
}

export type WinBackOutreachResult = WinBackTriggerResult;

/** Request payload for 1-Click Founder Intervention. */
export interface FounderInterventionRequest {
  userId: string;
  bonusCredits?: number;
  customMessage?: string;
  notifyEmail?: boolean;
  notifyTelegram?: boolean;
  actorUserId?: string;
}

/** Result payload returned from 1-Click Founder Intervention. */
export interface FounderInterventionResult {
  success: boolean;
  userId: string;
  creditsAdded: number;
  emailSent: boolean;
  telegramNotified: boolean;
  auditLogId?: string;
  message: string;
  timestamp: string;
  updatedHealthScore?: number;
}

/** Summary metrics for the customer health monitoring dashboard. */
export interface RetentionSummaryStats {
  totalMonitored: number;
  healthyCount: number;
  warningCount: number;
  criticalRiskCount: number;
  averageHealthScore: number;
  winBackEligibleCount: number;
  lastScanTimestamp: string;
}
