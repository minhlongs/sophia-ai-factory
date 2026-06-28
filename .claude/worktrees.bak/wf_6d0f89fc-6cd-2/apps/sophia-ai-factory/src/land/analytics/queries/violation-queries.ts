/**
 * Analytics - Violation / Security Event Queries
 *
 * Fetches violation events with pagination and builds summary statistics.
 */

import { createServerClient } from '@/seed/db/client';
import type { D1QueryChain } from '@/seed/db/d1-query-chain';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import type { ViolationFilters, ViolationEvent, ViolationSummary, ViolationType, ViolationSeverity } from '../types';

/**
 * Apply common violation filters to a Supabase query builder
 */
function applyViolationFilters(query: D1QueryChain, filters: ViolationFilters): D1QueryChain {
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

  const { data: rawViolations, error, count } = await query;

  if (error) {
    logger.error('[Analytics] Failed to fetch violations', toError(error));
    throw new Error('Failed to fetch violations');
  }

  const violations = rawViolations as ViolationRow[] | null;
  if (!violations || violations.length === 0) {
    return { violations: [], total: 0, hasMore: false };
  }

  const typedViolations: ViolationEvent[] = violations.map((v: ViolationRow) => ({
    id: v.id,
    type: v.type as ViolationType,
    severity: v.severity as ViolationSeverity,
    userId: v.user_id,
    licenseNonce: v.license_nonce,
    tier: v.tier,
    endpoint: v.endpoint,
    ipAddress: v.ip_address ?? undefined,
    userAgent: v.user_agent ?? undefined,
    metadata: (v.metadata ?? undefined) as Record<string, string> | undefined,
    createdAt: typeof v.created_at === 'number' ? v.created_at : Number(v.created_at),
    resolved: v.resolved,
    resolvedAt: v.resolved_at ? Number(v.resolved_at) : undefined,
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
  query = query.gte('created_at', startTimestamp).lte('created_at', endTimestamp);

  const { data: rawViolations, error } = await query;

  if (error) {
    logger.error('[Analytics] Failed to fetch violation summary', toError(error));
    throw new Error('Failed to fetch violation summary');
  }

  const violations = rawViolations as ViolationRow[] | null;
  if (!violations || violations.length === 0) {
    return {
      totalViolations: 0,
      byType: {} as Record<ViolationType, number>,
      bySeverity: {} as Record<ViolationSeverity, number>,
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
    const ts = typeof v.created_at === 'number' ? v.created_at : Number(v.created_at);
    const date = new Date(ts * 1000).toISOString().split('T')[0];
    trendMap.set(date, (trendMap.get(date) || 0) + 1);
  }

  const trend = Array.from(trendMap.entries())
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    totalViolations: violations.length,
    byType: byType as Record<ViolationType, number>,
    bySeverity: bySeverity as Record<ViolationSeverity, number>,
    byTier,
    resolvedCount,
    unresolvedCount: violations.length - resolvedCount,
    trend,
  };
}
