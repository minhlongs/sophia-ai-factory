/**
 * Usage Tracker
 *
 * Logs MCU consumption for billable features.
 */

import { getD1Client } from '@/lib/db/client';
import { calculateMcuCost } from './mcu-pricing';
import type { OrgBalance, UsageLog as UsageLogRow } from '@/lib/db/types';

export interface UsageEvent {
  orgId: string;
  feature: string;
  metadata?: Record<string, unknown>;
  tierName?: string;
}

export interface UsageLog {
  id: string;
  org_id: string;
  feature: string;
  mcu_cost: number;
  metadata: Record<string, unknown>;
  created_at: string;
}

/**
 * Log usage and deduct MCU balance atomically
 *
 * @returns true if successful, false if insufficient balance
 */
export async function logUsage(event: UsageEvent): Promise<{
  success: boolean;
  mcuCost: number;
  remainingBalance?: number;
  error?: string;
}> {
  const db = await getD1Client();

  try {
    // Calculate MCU cost for this feature
    const mcuCost = calculateMcuCost(event.feature, event.tierName);

    if (mcuCost <= 0) {
      // Free feature, just log it
      await db.from('usage_logs').insert({
        org_id: event.orgId,
        feature: event.feature,
        mcu_cost: 0,
        metadata: event.metadata || {},
      });

      return { success: true, mcuCost: 0 };
    }

    // Use database function to atomically check and deduct
    const { data, error } = await db.rpc('deduct_mcu_balance', {
      p_org_id: event.orgId,
      p_amount: mcuCost,
      p_feature: event.feature,
      p_metadata: event.metadata || {},
    });

    if (error) {
      console.error('Usage tracking error:', error);
      return {
        success: false,
        mcuCost,
        error: error.message,
      };
    }

    // Get updated balance
    const { data: balanceData } = await db
      .from('org_balances')
      .select('balance')
      .eq('org_id', event.orgId)
      .single();

    return {
      success: Boolean(data), // RPC returns true if successful
      mcuCost,
      remainingBalance: (balanceData as OrgBalance | null)?.balance,
    };
  } catch (error) {
    console.error('Unexpected usage tracking error:', error);
    return {
      success: false,
      mcuCost: 0,
      error: 'Internal error tracking usage',
    };
  }
}

/**
 * Get usage history for an organization
 */
export async function getUsageHistory(
  orgId: string,
  limit: number = 100,
  offset: number = 0
): Promise<UsageLog[]> {
  const db = await getD1Client();

  const { data, error } = await db
    .from<UsageLogRow>('usage_logs')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error('Failed to fetch usage history:', error);
    return [];
  }

  return (data as UsageLog[]) || [];
}

/**
 * Get usage summary with aggregations
 */
export async function getUsageSummary(
  orgId: string,
  days: number = 30
): Promise<{
  totalMcuUsed: number;
  totalCost: number;
  byFeature: Array<{ feature: string; count: number; mcuUsed: number }>;
  dailyUsage: Array<{ date: string; mcuUsed: number }>;
}> {
  const db = await getD1Client();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  // Get raw usage data
  const { data: logs } = await db
    .from<UsageLogRow>('usage_logs')
    .select('feature, mcu_cost, created_at')
    .eq('org_id', orgId)
    .gte('created_at', startDate.toISOString())
    .order('created_at', { ascending: true });

  if (!logs) {
    return {
      totalMcuUsed: 0,
      totalCost: 0,
      byFeature: [],
      dailyUsage: [],
    };
  }

  // Aggregate by feature
  const byFeatureMap = new Map<
    string,
    { count: number; mcuUsed: number }
  >();

  // Aggregate by day
  const dailyMap = new Map<string, number>();

  let totalMcuUsed = 0;

  for (const log of logs) {
    totalMcuUsed += log.mcu_cost;

    // By feature
    const feature = log.feature;
    const existing = byFeatureMap.get(feature) || { count: 0, mcuUsed: 0 };
    existing.count++;
    existing.mcuUsed += log.mcu_cost;
    byFeatureMap.set(feature, existing);

    // By day
    const date = new Date(log.created_at).toISOString().split('T')[0];
    dailyMap.set(date, (dailyMap.get(date) || 0) + log.mcu_cost);
  }

  return {
    totalMcuUsed,
    totalCost: totalMcuUsed, // MCU = cost in this model
    byFeature: Array.from(byFeatureMap.entries()).map(([feature, data]) => ({
      feature,
      count: data.count,
      mcuUsed: data.mcuUsed,
    })),
    dailyUsage: Array.from(dailyMap.entries())
      .map(([date, mcuUsed]) => ({ date, mcuUsed }))
      .sort((a, b) => a.date.localeCompare(b.date)),
  };
}
