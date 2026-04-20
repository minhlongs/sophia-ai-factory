/**
 * Violation Audit Logger
 *
 * Specialized audit logging for quota violations, throttling events,
 * and billing enforcement actions.
 *
 * Features:
 * - Structured event types for compliance reporting
 * - Links to existing receipt-based audit logging
 * - Queryable violation history
 * - Integration with quota enforcer and RaaS gate
 *
 * @module audit/violation-logger
 */

import { createServerClient } from '@/lib/db/client';
import { logger } from '@/lib/utils/logger-utility';

/**
 * DB row shape for audit_logs table (violation events).
 */
interface ViolationAuditRow {
  id: string;
  event_type: string;
  user_id: string;
  license_nonce: string;
  receipt: string | Record<string, unknown>;
  tier: string;
  created_at: string;
}

/**
 * Insert shape for audit_logs table (violation events).
 */
interface ViolationAuditInsert {
  event_type: string;
  user_id: string;
  license_nonce: string;
  receipt: string;
  tier: string;
}

/**
 * Violation event types
 */
export type ViolationType =
  | 'QUOTA_EXCEEDED'        // User exceeded quota limit
  | 'REQUEST_THROTTLED'     // Request blocked due to quota
  | 'OVERAGE_BILLED'        // Overage event marked as billable
  | 'LICENSE_SUSPENDED'     // License suspended due to repeated violations
  | 'QUOTA_ADJUSTED'        // Admin manually adjusted quota
  | 'PAYMENT_CONFIRMED'     // Payment confirmed, quota restored
  ;

/**
 * Violation event input
 */
export interface ViolationEvent {
  type: ViolationType;
  userId: string;
  licenseNonce: string;
  tier: string;
  // Context data
  exceededType?: 'hourly_credits' | 'daily_credits' | 'monthly_credits' | 'daily_requests';
  exceededLimit?: number;
  exceededCurrent?: number;
  exceededBy?: number;
  requestedCredits?: number;
  // Request context
  endpoint?: string;
  ipAddress?: string;
  userAgent?: string;
  // Billing context
  billable?: boolean;
  pricePerCredit?: number;
  totalCharge?: number;
  // Links to other systems
  auditReceiptId?: string;    // Links to audit_logs.receipt
  overageEventId?: string;    // Links to overage_events.id
  // Metadata
  metadata?: Record<string, unknown>;
}

/**
 * Violation query filters
 */
export interface ViolationFilters {
  userId?: string;
  licenseNonce?: string;
  type?: ViolationType;
  startDate?: number;
  endDate?: number;
  limit?: number;
}

/**
 * Violation summary for reporting
 */
export interface ViolationSummary {
  totalViolations: number;
  byType: Record<string, number>;
  byTier: Record<string, number>;
  billableViolations: number;
  totalBillableCredits: number;
  topViolators: Array<{
    userId: string;
    violationCount: number;
    billableCredits: number;
  }>;
}

/**
 * Log a violation event
 *
 * @param event - Violation event data
 * @returns Violation ID or null on failure
 */
export async function logViolation(event: ViolationEvent): Promise<string | null> {
  try {
    const db = createServerClient();

    const insertPayload: ViolationAuditInsert = {
      event_type: `violation:${event.type}`,
      user_id: event.userId,
      license_nonce: event.licenseNonce,
      receipt: JSON.stringify({
        type: event.type,
        tier: event.tier,
        exceeded_type: event.exceededType,
        exceeded_limit: event.exceededLimit,
        exceeded_current: event.exceededCurrent,
        exceeded_by: event.exceededBy,
        requested_credits: event.requestedCredits,
        endpoint: event.endpoint,
        ip_address: event.ipAddress,
        user_agent: event.userAgent,
        billable: event.billable,
        price_per_credit: event.pricePerCredit,
        total_charge: event.totalCharge,
        audit_receipt_id: event.auditReceiptId,
        overage_event_id: event.overageEventId,
        ...event.metadata,
      }),
      // Use tier for additional metadata
      tier: event.tier,
    };

    const { data, error } = await db.from<ViolationAuditRow>('audit_logs')
      .insert(insertPayload as unknown as Record<string, unknown>)
      .select('id')
      .single();

    if (error) throw error;

    logger.warn('[Violation Logger] Violation logged', {
      violationId: data?.id,
      type: event.type,
      userId: event.userId,
      licenseNonce: event.licenseNonce.slice(0, 8) + '...',
      tier: event.tier,
      billable: event.billable,
    });

    return data?.id ?? null;
  } catch (error) {
    logger.error('[Violation Logger] Failed to log violation', error as Error);
    return null;
  }
}

/**
 * Log quota exceeded event
 * Convenience wrapper for logViolation
 */
export async function logQuotaViolation(event: {
  userId: string;
  licenseNonce: string;
  tier: string;
  exceededType: 'hourly_credits' | 'daily_credits' | 'monthly_credits' | 'daily_requests';
  exceededLimit: number;
  exceededCurrent: number;
  exceededBy: number;
  requestedCredits: number;
  endpoint?: string;
  ipAddress?: string;
  userAgent?: string;
  auditReceiptId?: string;
}): Promise<string | null> {
  return logViolation({
    type: 'QUOTA_EXCEEDED',
    ...event,
    billable: true, // Default to billable
  });
}

/**
 * Log request throttled event
 * Convenience wrapper for logViolation
 */
export async function logThrottlingEvent(event: {
  userId: string;
  licenseNonce: string;
  tier: string;
  endpoint: string;
  ipAddress?: string;
  userAgent?: string;
  auditReceiptId?: string;
}): Promise<string | null> {
  return logViolation({
    type: 'REQUEST_THROTTLED',
    ...event,
  });
}

/**
 * Log billing event
 * Convenience wrapper for logViolation
 */
export async function logBillingEvent(event: {
  userId: string;
  licenseNonce: string;
  tier: string;
  billable: boolean;
  pricePerCredit?: number;
  totalCharge?: number;
  overageEventId?: string;
  metadata?: Record<string, unknown>;
}): Promise<string | null> {
  return logViolation({
    type: 'OVERAGE_BILLED',
    ...event,
  });
}

/**
 * Get violation history for a user/license
 *
 * @param filters - Query filters
 */
export async function getViolationHistory(
  filters: ViolationFilters
): Promise<Array<{
  id: string;
  type: ViolationType;
  userId: string;
  licenseNonce: string;
  tier: string;
  createdAt: number;
  metadata: Record<string, unknown>;
}>> {
  const db = createServerClient();
  const limit = filters.limit ?? 100;

  let query = db.from<ViolationAuditRow>('audit_logs')
    .select('id, event_type, user_id, license_nonce, tier, receipt, created_at')
    .like('event_type', 'violation:%')
    .order('created_at', { ascending: false })
    .limit(limit);

  // Apply filters
  if (filters.userId) {
    query = query.eq('user_id', filters.userId);
  }
  if (filters.licenseNonce) {
    query = query.eq('license_nonce', filters.licenseNonce);
  }
  if (filters.type) {
    query = query.eq('event_type', `violation:${filters.type}`);
  }
  if (filters.startDate) {
    query = query.gte('created_at', filters.startDate);
  }
  if (filters.endDate) {
    query = query.lte('created_at', filters.endDate);
  }

  const { data, error } = await query;

  if (error) {
    logger.error('[Violation Logger] Failed to fetch violation history', new Error(error.message));
    return [];
  }

  const VALID_VIOLATION_TYPES = new Set<string>([
    'QUOTA_EXCEEDED', 'REQUEST_THROTTLED', 'OVERAGE_BILLED',
    'LICENSE_SUSPENDED', 'QUOTA_ADJUSTED', 'PAYMENT_CONFIRMED',
  ]);

  return (data || []).map((row: ViolationAuditRow) => {
    // Parse receipt JSON
    const receipt = typeof row.receipt === 'string'
      ? JSON.parse(row.receipt)
      : row.receipt || {};

    // Extract and validate event type from "violation:EVENT_TYPE"
    const rawType = row.event_type?.replace('violation:', '') ?? '';
    const type: ViolationType = VALID_VIOLATION_TYPES.has(rawType)
      ? (rawType as ViolationType)
      : 'QUOTA_EXCEEDED'; // fallback to defined default

    return {
      id: row.id,
      type,
      userId: row.user_id,
      licenseNonce: row.license_nonce,
      tier: row.tier,
      createdAt: typeof row.created_at === 'number' ? row.created_at : Number(row.created_at),
      metadata: receipt,
    };
  });
}

/**
 * Get violation summary for reporting
 *
 * @param options - Query options
 */
export async function getViolationSummary(options: {
  startDate: number;
  endDate: number;
  limit?: number;
} = {
  startDate: Math.floor(Date.now() / 1000) - (30 * 86400), // Last 30 days
  endDate: Math.floor(Date.now() / 1000),
  limit: 1000,
}): Promise<ViolationSummary> {
  const db = createServerClient();

  // Fetch all violations in date range
  const { data } = await db.from<ViolationAuditRow>('audit_logs')
    .select('event_type, user_id, tier, receipt')
    .like('event_type', 'violation:%')
    .gte('created_at', options.startDate)
    .lte('created_at', options.endDate)
    .limit(options.limit ?? 1000);

  if (!data || data.length === 0) {
    return {
      totalViolations: 0,
      byType: {},
      byTier: {},
      billableViolations: 0,
      totalBillableCredits: 0,
      topViolators: [],
    };
  }

  // Aggregate statistics
  const byType: Record<string, number> = {};
  const byTier: Record<string, number> = {};
  const userViolations = new Map<string, { count: number; billableCredits: number }>();
  let billableViolations = 0;
  let totalBillableCredits = 0;

  for (const row of data) {
    // Extract type
    const type = row.event_type?.replace('violation:', '') || 'UNKNOWN';
    byType[type] = (byType[type] || 0) + 1;

    // Extract tier
    const tier = row.tier || 'UNKNOWN';
    byTier[tier] = (byTier[tier] || 0) + 1;

    // Parse receipt
    const receipt = typeof row.receipt === 'string'
      ? JSON.parse(row.receipt)
      : row.receipt || {};

    // Track user violations
    const userId = row.user_id || 'unknown';
    const existing = userViolations.get(userId) || { count: 0, billableCredits: 0 };
    existing.count += 1;
    if (receipt.billable && receipt.exceeded_by) {
      existing.billableCredits += receipt.exceeded_by || 0;
      billableViolations += 1;
      totalBillableCredits += receipt.exceeded_by || 0;
    }
    userViolations.set(userId, existing);
  }

  // Build top violators
  const topViolators = Array.from(userViolations.entries())
    .map(([userId, data]) => ({
      userId,
      violationCount: data.count,
      billableCredits: data.billableCredits,
    }))
    .sort((a, b) => b.billableCredits - a.billableCredits)
    .slice(0, 10);

  return {
    totalViolations: data.length,
    byType,
    byTier,
    billableViolations,
    totalBillableCredits,
    topViolators,
  };
}
