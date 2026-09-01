/** Alert type identifiers */
export type AlertType =
  | 'usage_threshold'
  | 'license_expiring'
  | 'webhook_delivery_failed'
  | 'quota_exceeded'
  | 'payment_failed'
  | 'subscription_cancelled'
  | 'production.run_cancelled'
  | 'production.approval_expired'
  | 'production.budget_cap'
  // P3 platform infrastructure alerts (Phase 3 Production Hardening)
  | 'platform.circuit_breaker'
  | 'platform.billing_anomaly'
  | 'platform.mission_abandon_spike'
  // Phase 2B production alert types (Reality Loop observability)
  | 'platform.agent_cost_overrun'
  | 'platform.creative_quality_drift'
  | 'platform.distribution_pipeline';

/** Alert severity levels */
export type AlertSeverity = 'low' | 'medium' | 'high' | 'critical';

/** Alert creation parameters */
export interface CreateAlertParams {
  userId: string;
  licenseNonce: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  endpoint?: string;
  expiresAt?: Date;
}

/** Alert record for dashboard */
export interface UserAlert {
  id: string;
  userId: string;
  licenseNonce: string | null;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  metadata: Record<string, unknown> | null;
  pushed: boolean;
  pushedAt: string | null;
  read: boolean;
  readAt: string | null;
  dismissed: boolean;
  dismissedAt: string | null;
  createdAt: string;
  expiresAt: string | null;
}

/** Unread alert count breakdown by severity */
export interface UnreadAlertCount {
  total: number;
  critical: number;
  high: number;
}
