/**
 * @file fleet-radar-actions.ts
 * @description Server actions boundary for Fleet Creator accounts and Trending SKU Radar
 */

'use server';

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import type {
  FleetCreatorAccount,
  TrendingSkuRadarItem,
  RegisterFleetAccountInput,
  LaunchFleetDeploymentInput,
  IngestTrendingSkuRadarInput,
} from './types';
import { fetchFleetAccounts, fetchTrendingRadarItems } from './radar-query-service';
import {
  executeRegisterFleetAccount,
  executeLaunchFleetDeployment,
  executeIngestTrendingSkuRadar,
} from './fleet-action-mutations';

export async function getFleetAccountsAction(): Promise<{
  success: boolean;
  data: FleetCreatorAccount[];
  error?: string;
}> {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, data: [], error: 'UNAUTHORIZED' };
  }
  return fetchFleetAccounts(user.id);
}

export async function registerFleetAccountAction(
  input: RegisterFleetAccountInput,
): Promise<{ success: boolean; data?: FleetCreatorAccount; error?: string }> {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: 'UNAUTHORIZED' };
  }
  return executeRegisterFleetAccount(user.id, input);
}

export async function launchFleetDeploymentAction(
  input: LaunchFleetDeploymentInput,
): Promise<{ success: boolean; deploymentId?: string; scheduledCount?: number; error?: string }> {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: 'UNAUTHORIZED' };
  }
  return executeLaunchFleetDeployment(user.id, input);
}

export async function ingestTrendingSkuRadarAction(
  input: IngestTrendingSkuRadarInput,
): Promise<{ success: boolean; radarItem?: TrendingSkuRadarItem; error?: string }> {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: 'UNAUTHORIZED' };
  }
  return executeIngestTrendingSkuRadar(user.id, input);
}

export async function getTrendingRadarItemsAction(): Promise<{
  success: boolean;
  data: TrendingSkuRadarItem[];
  error?: string;
}> {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, data: [], error: 'UNAUTHORIZED' };
  }
  return fetchTrendingRadarItems();
}
