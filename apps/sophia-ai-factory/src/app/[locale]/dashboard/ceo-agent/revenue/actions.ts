'use server';

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { logger } from '@/seed/utils/logger-utility';
import { resolveUserTier } from '@/seed/db/resolve-user-tier';
import { getD1 } from '@/seed/db/client';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface TrendPoint {
  date: string;
  spentUsd: number;
  creditsUsed: number;
}

export interface RevenueInsights {
  totalSpentUsd: number;
  totalCreditsUsed: number;
  totalCreditsPurchased: number;
  remainingCredits: number;
  avgDailySpend7d: number;
  trend30d: TrendPoint[];
  tier: 'BASIC' | 'PREMIUM' | 'ENTERPRISE' | 'MASTER';
}

export interface RevenueActionResult {
  ok: boolean;
  insights?: RevenueInsights;
  error?: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function toTrendPoint(row: { date: string; spent_cents: number; credits_used: number }): TrendPoint {
  return {
    date: row.date.slice(5),
    spentUsd: Math.round((row.spent_cents ?? 0) / 100),
    creditsUsed: row.credits_used ?? 0,
  };
}

function rowToTransaction(row: {
  id: string;
  date: number;
  amount_cents: number;
  credits_total: number;
  sku: string;
}): { id: string; date: string; amountUsd: number; credits: number; sku: string } {
  return {
    id: row.id,
    date: new Date((row.date ?? 0) * 1000).toISOString().slice(0, 10),
    amountUsd: Math.round((row.amount_cents ?? 0) / 100),
    credits: row.credits_total ?? 0,
    sku: row.sku,
  };
}

interface RevenueQueryResult {
  totalSpentUsd: number;
  totalCredits: number;
  remaining: number;
  trend: TrendPoint[];
  transactions: Array<{ id: string; date: string; amountUsd: number; credits: number; sku: string }>;
}

async function queryRevenueFromPurchases(userId: string): Promise<RevenueQueryResult> {
  const d1 = getD1();
  if (!d1) {
    return {
      totalSpentUsd: 0,
      totalCredits: 0,
      remaining: 0,
      trend: [],
      transactions: [],
    };
  }

  try {
    const nowSec = Math.floor(Date.now() / 1000);
    const sevenDaysAgo = nowSec - 7 * 24 * 60 * 60;

    const [totalResult, recentResult, sevenDayResult, remainingResult] = await Promise.all([
      d1
        .prepare(
          `SELECT COALESCE(SUM(amount_cents), 0) as spent_cents,
                  COALESCE(SUM(credits_total), 0) as credits_total
           FROM user_purchases
           WHERE user_id = ? AND status IN ('paid', 'pending')`,
        )
        .bind(userId)
        .first<{ spent_cents: number; credits_total: number }>(),
      d1
        .prepare(
          `SELECT id, created_at as date, amount_cents, credits_total, sku, status
           FROM user_purchases
           WHERE user_id = ? AND status IN ('paid', 'pending')
           ORDER BY created_at DESC
           LIMIT 20`,
        )
        .bind(userId)
        .all<{ id: string; date: number; amount_cents: number; credits_total: number; sku: string; status: string }>(),
      d1
        .prepare(
          `SELECT DATE(created_at, 'unixepoch') as date,
                  COALESCE(SUM(amount_cents), 0) as spent_cents,
                  COALESCE(SUM(credits_total), 0) as credits_used
           FROM user_purchases
           WHERE user_id = ? AND created_at >= ? AND status IN ('paid', 'pending')
           GROUP BY DATE(created_at, 'unixepoch')
           ORDER BY date ASC`,
        )
        .bind(userId, sevenDaysAgo)
        .all<{ date: string; spent_cents: number; credits_used: number }>(),
      d1
        .prepare(
          `SELECT COALESCE(SUM(credits_remaining), 0) as credits_remaining
           FROM user_purchases
           WHERE user_id = ? AND credits_remaining > 0
             AND (expires_at IS NULL OR expires_at > ?)
             AND status = 'paid'`,
        )
        .bind(userId, nowSec)
        .first<{ credits_remaining: number }>(),
    ]);

    const spentCents = (totalResult?.spent_cents ?? 0) as number;
    const totalCredits = (totalResult?.credits_total ?? 0) as number;
    const remaining = (remainingResult?.credits_remaining ?? 0) as number;

    const sevenDayRows = (sevenDayResult?.results ?? []) as Array<{ date: string; spent_cents: number; credits_used: number }>;
    const sevenDaySpendCents = sevenDayRows.reduce((sum, r) => sum + (r.spent_cents ?? 0), 0);
    const avgDailySpend7d = Math.round((sevenDaySpendCents / 7) * 100) / 100;

    const transactions = (recentResult?.results ?? []).map(rowToTransaction);

    return {
      totalSpentUsd: Math.round((spentCents / 100) * 100) / 100,
      totalCredits,
      remaining,
      trend: sevenDayRows.map(toTrendPoint),
      transactions,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown_error';
    logger.warn('[RevenueActions] queryRevenueFromPurchases failed', { error: message });
    return {
      totalSpentUsd: 0,
      totalCredits: 0,
      remaining: 0,
      trend: [],
      transactions: [],
    };
  }
}

// ── Actions ─────────────────────────────────────────────────────────────────────

/**
 * Fetch revenue insights for the current user. Safe to call from Server Component.
 * Tier: callers are expected to gate BASIC before invoking (matches page.tsx pattern).
 */
export async function getRevenueInsights(): Promise<RevenueActionResult> {
  try {
    const user = await getCurrentUser();
    if (!user) return { ok: false, error: 'auth_required' };

    const tier = await resolveUserTier(user.id);
    const data = await queryRevenueFromPurchases(user.id);
    const totalCreditsUsed = data.totalCredits - data.remaining;
    const avgDailySpend7d = data.trend.length > 0
      ? Math.round((data.trend.reduce((s, t) => s + t.spentUsd, 0) / 7) * 100) / 100
      : 0;

    return {
      ok: true,
      insights: {
        totalSpentUsd: data.totalSpentUsd,
        totalCreditsUsed,
        totalCreditsPurchased: data.totalCredits,
        remainingCredits: data.remaining,
        avgDailySpend7d,
        trend30d: data.trend,
        tier: tier as RevenueInsights['tier'],
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown_error';
    logger.error('[RevenueActions] getRevenueInsights failed', { error: message });
    return { ok: false, error: message };
  }
}

/**
 * Recent transactions for the current user.
 */
export async function getRecentTransactions(): Promise<
  RevenueActionResult & { transactions?: Array<{ id: string; date: string; amountUsd: number; credits: number; sku: string }> }
> {
  try {
    const user = await getCurrentUser();
    if (!user) return { ok: false, error: 'auth_required' };

    const tier = await resolveUserTier(user.id);
    const data = await queryRevenueFromPurchases(user.id);

    return {
      ok: true,
      transactions: data.transactions,
      insights: {
        totalSpentUsd: data.totalSpentUsd,
        totalCreditsUsed: data.totalCredits - data.remaining,
        totalCreditsPurchased: data.totalCredits,
        remainingCredits: data.remaining,
        avgDailySpend7d: data.trend.length > 0
          ? Math.round((data.trend.reduce((s, t) => s + t.spentUsd, 0) / 7) * 100) / 100
          : 0,
        trend30d: data.trend,
        tier: tier as RevenueInsights['tier'],
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown_error';
    logger.error('[RevenueActions] getRecentTransactions failed', { error: message });
    return { ok: false, error: message };
  }
}
