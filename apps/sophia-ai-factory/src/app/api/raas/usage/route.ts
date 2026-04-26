/**
 * GET /api/raas/usage — MCU balance and usage stats
 *
 * Returns balance, monthly used, monthly limit from tier config.
 * Auth: Supabase session.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/db/client';
import { getCurrentUser } from '@/lib/better-auth-session';
import { logger } from '@/lib/utils/logger-utility';
import { getMcuMonthlyLimit } from '@/config/tiers';
import type { Tier } from '@/types';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const db = createServerClient();

    const { searchParams } = new URL(request.url);
    const days = Math.min(parseInt(searchParams.get('days') ?? '30'), 90);

    // Get user tier from profiles table
    const { data: profile } = await db
      .from('profiles')
      .select('tier')
      .eq('id', user.id)
      .single();

    const tier = (profile?.tier as Tier) ?? 'BASIC';
    const monthlyLimit = getMcuMonthlyLimit(tier);

    // Calculate monthly MCU used from completed missions
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const { data: rawUsageData } = await db
      .from('missions')
      .select('mcu_cost, created_at')
      .eq('org_id', user.id)
      .eq('status', 'completed')
      .gte('created_at', startOfMonth.toISOString());
    const usageData = rawUsageData as unknown as { mcu_cost: number; created_at: string }[] | null;

    const monthlyUsed = (usageData ?? []).reduce((sum, m) => sum + (m.mcu_cost ?? 0), 0);
    const balance = Math.max(0, monthlyLimit - monthlyUsed);

    // Daily stats for chart
    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - days);

    const { data: rawDailyData } = await db
      .from('missions')
      .select('mcu_cost, created_at')
      .eq('org_id', user.id)
      .gte('created_at', sinceDate.toISOString());
    const dailyData = rawDailyData as unknown as { mcu_cost: number; created_at: string }[] | null;

    const callsByDay = buildDailyStats(dailyData ?? []);

    const totalCalls = (dailyData ?? []).length;
    const totalMcu = (dailyData ?? []).reduce((sum, m) => sum + (m.mcu_cost ?? 0), 0);

    return NextResponse.json({
      balance,
      monthly_used: monthlyUsed,
      monthly_limit: monthlyLimit,
      tier,
      stats: {
        total_calls: totalCalls,
        total_mcu: totalMcu,
        avg_response_ms: 0,
        calls_by_day: callsByDay,
      },
    });
  } catch (err) {
    logger.error('[GET /api/raas/usage] Error', err instanceof Error ? err : new Error(String(err)));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function buildDailyStats(missions: { mcu_cost: number; created_at: string }[]) {
  const map = new Map<string, { count: number; mcu: number }>();
  for (const m of missions) {
    const date = m.created_at.substring(0, 10);
    const prev = map.get(date) ?? { count: 0, mcu: 0 };
    map.set(date, { count: prev.count + 1, mcu: prev.mcu + (m.mcu_cost ?? 0) });
  }
  return Array.from(map.entries())
    .map(([date, stats]) => ({ date, ...stats }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
