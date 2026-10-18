/**
 * Query parsing and summary calculation helpers for GET /api/admin/quota/overage-summary.
 */

import type { OverageEventRow } from '@/tree/database/supabase-types';

export interface OverageDateRange {
  period: string;
  startDate: number;
  endDate: number;
  tier: string | null;
  limit: number;
}

export function parseOverageQueryParams(searchParams: URLSearchParams): OverageDateRange {
  const period = searchParams.get('period') || 'day';
  const tier = searchParams.get('tier');
  const limit = parseInt(searchParams.get('limit') || '100');

  const now = Math.floor(Date.now() / 1000);
  let startDate: number;
  let endDate = now;

  if (period === 'custom') {
    startDate = parseInt(searchParams.get('start') || '0');
    endDate = parseInt(searchParams.get('end') || String(now));
  } else {
    switch (period) {
      case 'day':
        startDate = now - 86400;
        break;
      case 'week':
        startDate = now - 7 * 86400;
        break;
      case 'month':
        startDate = now - 30 * 86400;
        break;
      default:
        startDate = now - 86400;
    }
  }

  return { period, startDate, endDate, tier, limit };
}

export function buildOverageSummaryResponse(
  range: OverageDateRange,
  events: OverageEventRow[] | null,
) {
  const summary = {
    totalEvents: events?.length || 0,
    totalCreditsExceeded: events?.reduce((sum, e) => sum + (e.exceeded_by || 0), 0) || 0,
    billableEvents: events?.filter((e) => e.billable).length || 0,
    billableCredits:
      events?.filter((e) => e.billable).reduce((sum, e) => sum + (e.exceeded_by || 0), 0) || 0,
    byType: {} as Record<string, number>,
    byTier: {} as Record<string, number>,
    topUsers: [] as Array<{ userId: string; count: number; credits: number }>,
  };

  events?.forEach((event) => {
    const type = event.exceeded_type || 'unknown';
    summary.byType[type] = (summary.byType[type] || 0) + 1;
  });

  events?.forEach((event) => {
    const eventTier = event.tier_at_exceeded || 'UNKNOWN';
    summary.byTier[eventTier] = (summary.byTier[eventTier] || 0) + 1;
  });

  const userOverages = new Map<string, { count: number; credits: number }>();
  events?.forEach((event) => {
    const userId = event.user_id || 'unknown';
    const existing = userOverages.get(userId) || { count: 0, credits: 0 };
    userOverages.set(userId, {
      count: existing.count + 1,
      credits: existing.credits + (event.exceeded_by || 0),
    });
  });

  summary.topUsers = Array.from(userOverages.entries())
    .map(([userId, data]) => ({ userId, count: data.count, credits: data.credits }))
    .sort((a, b) => b.credits - a.credits)
    .slice(0, 10);

  return {
    period: {
      type: range.period,
      startDate: range.startDate,
      endDate: range.endDate,
    },
    summary,
    events: events?.slice(0, 20).map((e) => ({
      id: e.id,
      userId: e.user_id,
      licenseNonce: e.license_nonce?.slice(0, 8) + '...',
      exceededType: e.exceeded_type,
      exceededLimit: e.exceeded_limit,
      exceededCurrent: e.exceeded_current,
      exceededBy: e.exceeded_by,
      tier: e.tier_at_exceeded,
      billable: e.billable,
      createdAt: e.created_at,
    })),
  };
}
