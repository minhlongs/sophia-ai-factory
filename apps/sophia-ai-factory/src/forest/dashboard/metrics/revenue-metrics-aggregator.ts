/**
 * @module forest/dashboard/metrics/revenue-metrics-aggregator
 * Revenue, transaction, and affiliate commission metrics aggregations.
 */

import { createServerClient } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import type {
  DashboardResult,
  RevenueDataPoint,
  AffiliateStats,
  DashboardTimeframe,
} from './types';

/**
 * Fetch recent payment transactions
 */
export async function fetchRecentTransactions(
  userId: string,
  limit: number = 10
): Promise<DashboardResult<{ id: string; date: string; customer: string; amount: string; status: string }[]>> {
  try {
    const db = createServerClient();

    const result = await db
      .from('transactions')
      .select('id, created_at, customer_name, amount_cents, status')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (result.error || !result.data) {
      return { ok: true, data: [] };
    }

    const rows = result.data as Array<{
      id: string;
      created_at: string;
      customer_name: string;
      amount_cents: number;
      status: string;
    }>;

    const transactions = rows.map(row => ({
      id: row.id,
      date: row.created_at,
      customer: row.customer_name,
      amount: `$${(row.amount_cents / 100).toFixed(2)}`,
      status: row.status,
    }));

    return { ok: true, data: transactions };
  } catch (error) {
    logger.warn('[dashboard] Could not fetch transactions', toError(error));
    return { ok: true, data: [] };
  }
}

/**
 * Fetch real revenue data points for the dashboard chart.
 */
export async function fetchRevenueData(
  userId: string,
  _timeframe?: DashboardTimeframe
): Promise<DashboardResult<RevenueDataPoint[]>> {
  try {
    const db = createServerClient();

    const result = await db
      .from('transactions')
      .select('created_at, amount_cents, status')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (result.error || !result.data || result.data.length === 0) {
      return { ok: true, data: [] };
    }

    const rows = result.data as Array<{
      created_at: string;
      amount_cents: number;
      status: string;
    }>;

    const revenueMap = new Map<string, number>();
    for (const row of rows) {
      const label = new Date(row.created_at).toLocaleDateString('en-US', {
        weekday: 'short',
      });
      revenueMap.set(label, (revenueMap.get(label) || 0) + (row.amount_cents || 0) / 100);
    }

    const maxRevenue = Math.max(...Array.from(revenueMap.values()), 1);

    const points: RevenueDataPoint[] = Array.from(revenueMap.entries()).map(
      ([label, revenue]) => ({
        label,
        revenue,
        percentage: Math.round((revenue / maxRevenue) * 100),
      })
    );

    return { ok: true, data: points };
  } catch (error) {
    logger.warn('[dashboard] Could not fetch revenue data', toError(error));
    return { ok: true, data: [] };
  }
}

/**
 * Fetch top affiliate partners by commission
 */
export async function fetchTopAffiliates(
  userId: string,
  limit: number = 5
): Promise<DashboardResult<AffiliateStats[]>> {
  try {
    const db = createServerClient();

    const result = await db
      .from('affiliates')
      .select('id, name, initials, avatar_url, stats, total_commission')
      .eq('user_id', userId)
      .order('total_commission', { ascending: false })
      .limit(limit);

    if (result.error || !result.data) {
      return { ok: true, data: [] };
    }

    const affiliates = (result.data as Array<{
      id: string;
      name: string;
      initials: string;
      avatar_url: string | null;
      stats: string;
      total_commission: number;
    }>).map(aff => ({
      id: aff.id,
      name: aff.name,
      initials: aff.initials,
      avatar: aff.avatar_url,
      stats: aff.stats,
      commission: `+$${aff.total_commission.toFixed(0)}`,
    }));

    return { ok: true, data: affiliates };
  } catch (error) {
    logger.warn('[dashboard] Could not fetch affiliates', toError(error));
    return { ok: true, data: [] };
  }
}
