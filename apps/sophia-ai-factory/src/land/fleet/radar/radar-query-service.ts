/**
 * @file radar-query-service.ts
 * @description Query service for fetching Fleet creator accounts and Trending SKU Radar items
 */

import { createServerClient } from '@/seed/db/client';
import type { FleetCreatorAccount, TrendingSkuRadarItem } from './types';

export async function fetchFleetAccounts(userId: string): Promise<{
  success: boolean;
  data: FleetCreatorAccount[];
  error?: string;
}> {
  try {
    const db = createServerClient();
    const { data } = await db
      .from<FleetCreatorAccount>('fleet_creator_accounts')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    return {
      success: true,
      data: data ?? [],
    };
  } catch (err) {
    return {
      success: false,
      data: [],
      error: err instanceof Error ? err.message : 'UNKNOWN_ERROR',
    };
  }
}

export async function fetchTrendingRadarItems(): Promise<{
  success: boolean;
  data: TrendingSkuRadarItem[];
  error?: string;
}> {
  try {
    const db = createServerClient();
    const { data } = await db
      .from<TrendingSkuRadarItem>('trending_sku_radar_items')
      .select('*')
      .order('growth_velocity_score', { ascending: false })
      .limit(50);

    return {
      success: true,
      data: data ?? [],
    };
  } catch (err) {
    return {
      success: false,
      data: [],
      error: err instanceof Error ? err.message : 'UNKNOWN_ERROR',
    };
  }
}
