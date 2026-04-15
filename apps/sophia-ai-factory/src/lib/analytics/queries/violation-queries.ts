/**
 * Analytics - Violation / Security Event Queries
 *
 * Fetches violation events with pagination and builds summary statistics.
 */

import { createServerClient } from '@/lib/db/client';
import { logger } from '@/lib/utils/logger-utility';
import type { ViolationFilters, ViolationEvent, ViolationSummary } from '../types';

/**
 * Apply common violation filters to a Supabase query builder
 */
function applyViolationFilters(query: any, filters: ViolationFilters): any {
  if (filters.licenseNonce) query = query.eq('license_nonce', filters.licenseNonce);
  if (filters.userId) query = query.eq('user_id', filters.userId);
  if (filters.type) query = query.eq('type', filters.type);
  if (filters.severity) query = query.eq('severity', filters.severity);
  if (filters.startTimestamp) query = query.gte('created_at', filters.startTimestamp);
  if (filters.endTimestamp) query = query.lte('created_at', filters.endTimestamp);
  if (filters.resolved !== undefined) query = query.eq('resolved', filters.resolved);
  return query;
}

/**
 * DB row shape for violation records
 */
interface ViolationRow {
  id: string;
  type: string;
  severity: string;
  user_id: string;
  license_nonce: string;
  tier: string;
  endpoint: string;
  ip_address: string | null;
  user_agent: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  resolved: boolean;
  resolved_at?: string;
}

/**
 * Fetch violation events from Supabase with pagination
 *
 * @param filters - Query filters for violation data
 * @param page - Page number (default: 1)
 * @param limit - Items per page (default: 50, max: 100)
 */
export async function fetchViolations(
  filters: ViolationFilters = {},
  page: number = 1,
  limit: number = 50
): Promise<{ violations: ViolationEvent[]; total: number; hasMore: boolean }> {
  const db = createServerClient();

  let query = db.from('violations').select('*', { count: 'exact' });
  query = applyViolationFilters(query, filters);

  // Apply pagination
  const from = (page - 1) * limit;
  query = query.range(from, from + limit - 1).order('created_at', { ascending: false });

  const { data: violations, error, count } = await query as any;

  if (error) {
    logger.error('[Analytics] Failed to fetch violations', error);
    throw new Error('Failed to fetch violations');
  }

  if (!violations || violations.length === 0) {
    return { violations: [], total: 0, hasMore: false };
  }

  const typedViolations: ViolationEvent[] = violations.map((v: ViolationRow) => ({
    id: v.id,
    type: v.type,
    severity: v.severity,
    userId: v.user_id,
    licenseNonce: v.license_nonce,
    tier: v.tier,
    endpoint: v.endpoint,
    ipAddress: v.ip_address,
    userAgent: v.user_agent,
    metadata: v.metadata,
    createdAt: v.created_at,
    resolved: v.resolved,
    resolvedAt: v.resolved_at,
  }));

  const total = count || violations.length;
  return { violations: typedViolations, total, hasMore: from + violations.length < total };
}

/**
 * Fetch violation summary statistics
 *
 * @param filters - Query filters for violation data
 * @param startTimestamp - Start timestamp for trend data
 * @param endTimestamp - End timestamp for trend data
 */
export async function fetchViolationSummary(
  filters: ViolationFilters = {},
  startTimestamp: number,
  endTimestamp: number
): Promise<ViolationSummary> {
  const db = createServerClient();

  let query = db.from('violations').select('*');
  query = applyViolationFilters(query, filters);

  const { data: violations, error } = await query as any;

  if (error) {
    logger.error('[Analytics] Failed to fetch violation summary', error);
    throw new Error('Failed to fetch violation summary');
  }

  if (!violations || violations.length === 0) {
    return {
      totalViolations: 0,
      byType: {} as any,
      bySeverity: {} as any,
      byTier: {},
      resolvedCount: 0,
      unresolvedCount: 0,
      trend: [],
    };
  }

  // Calculate breakdowns
  const byType: Record<string, number> = {};
  const bySeverity: Record<string, number> = {};
  const byTier: Record<string, number> = {};
  let resolvedCount = 0;

  for (const v of violations) {
    byType[v.type] = (byType[v.type] || 0) + 1;
    bySeverity[v.severity] = (bySeverity[v.severity] || 0) + 1;
    byTier[v.tier] = (byTier[v.tier] || 0) + 1;
    if (v.resolved) resolvedCount += 1;
  }

  // Calculate daily trend
  const trendMap = new Map<string, number>();
  for (const v of violations) {
    const date = new Date(v.created_at * 1000).toISOString().split('T')[0];
    trendMap.set(date, (trendMap.get(date) || 0) + 1);
  }

  const trend = Array.from(trendMap.entries())
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Suppress unused param warning — timestamps are for caller filtering
  void startTimestamp;
  void endTimestamp;

  return {
    totalViolations: violations.length,
    byType: byType as any,
    bySeverity: bySeverity as any,
    byTier,
    resolvedCount,
    unresolvedCount: violations.length - resolvedCount,
    trend,
  };
}
