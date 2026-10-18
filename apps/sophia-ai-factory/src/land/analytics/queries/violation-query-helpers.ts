/**
 * Analytics - Violation Query Filtering & Aggregation Helpers
 *
 * Extracted from violation-queries.ts for modularization.
 */

import type { D1QueryChain } from '@/seed/db/d1-query-chain';
import type {
  ViolationFilters,
  ViolationEvent,
  ViolationSummary,
  ViolationType,
  ViolationSeverity,
} from '../types';

/**
 * DB row shape for violation records
 */
export interface ViolationRow {
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
 * Apply common violation filters to a D1 query builder
 */
export function applyViolationFilters(
  query: D1QueryChain,
  filters: ViolationFilters
): D1QueryChain {
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
 * Map a raw DB violation row to a typed ViolationEvent
 */
export function mapViolationRowToEvent(v: ViolationRow): ViolationEvent {
  return {
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
  };
}

/**
 * Aggregate raw violation rows into a ViolationSummary
 */
export function aggregateViolationSummary(
  violations: ViolationRow[] | null
): ViolationSummary {
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

  const byType: Record<string, number> = {};
  const bySeverity: Record<string, number> = {};
  const byTier: Record<string, number> = {};
  const trendMap = new Map<string, number>();
  let resolvedCount = 0;

  for (const v of violations) {
    byType[v.type] = (byType[v.type] || 0) + 1;
    bySeverity[v.severity] = (bySeverity[v.severity] || 0) + 1;
    byTier[v.tier] = (byTier[v.tier] || 0) + 1;
    if (v.resolved) resolvedCount += 1;

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
