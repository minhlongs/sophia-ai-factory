/**
 * @file fleet-deployment-mutations.ts
 * @description Mutation operations for registering fleet accounts and launching staggered campaigns
 */

import { createServerClient } from '@/seed/db/client';
import { inngest } from '@/seed/inngest/client';
import {
  FleetCreatorAccountSchema,
  FleetCampaignDeploymentSchema,
  type FleetCreatorAccount,
} from '@/seed/types/fleet-matrix-sku-radar-types';
import { buildStaggerSchedule } from '@/tree/fleet/fleet-stagger-scheduler';
import type { RegisterFleetAccountInput, LaunchFleetDeploymentInput } from './types';

export async function executeRegisterFleetAccount(
  userId: string,
  input: RegisterFleetAccountInput,
): Promise<{ success: boolean; data?: FleetCreatorAccount; error?: string }> {
  try {
    const accountId = `facc-${crypto.randomUUID().slice(0, 12)}`;
    const now = Math.floor(Date.now() / 1000);

    const validated = FleetCreatorAccountSchema.parse({
      id: accountId,
      userId,
      platform: input.platform,
      handle: input.handle,
      displayName: input.displayName,
      proxyConfigId: input.proxyConfigId ?? null,
      status: 'ACTIVE',
      dailyPostLimit: input.dailyPostLimit ?? 3,
      postsPublishedToday: 0,
      lastPostAt: null,
      totalViews: 0,
      totalClicks: 0,
      totalGmv: 0,
      totalCommission: 0,
      createdAt: now,
      updatedAt: now,
    });

    const db = createServerClient();
    await db.execute(
      `INSERT INTO fleet_creator_accounts (
        id, user_id, platform, handle, display_name, proxy_config_id,
        status, daily_post_limit, posts_published_today, last_post_at,
        total_views, total_clicks, total_gmv, total_commission,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        validated.id,
        validated.userId,
        validated.platform,
        validated.handle,
        validated.displayName,
        validated.proxyConfigId ?? null,
        validated.status,
        validated.dailyPostLimit,
        validated.postsPublishedToday,
        validated.lastPostAt ?? null,
        validated.totalViews,
        validated.totalClicks,
        validated.totalGmv,
        validated.totalCommission,
        validated.createdAt,
        validated.updatedAt,
      ],
    );

    return { success: true, data: validated };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'FAILED_TO_REGISTER_ACCOUNT',
    };
  }
}

export async function executeLaunchFleetDeployment(
  userId: string,
  input: LaunchFleetDeploymentInput,
): Promise<{ success: boolean; deploymentId?: string; scheduledCount?: number; error?: string }> {
  try {
    if (input.targetAccountIds.length === 0) {
      return { success: false, error: 'NO_ACCOUNTS_SELECTED' };
    }

    const db = createServerClient();
    const { data: accountsData } = await db
      .from<FleetCreatorAccount>('fleet_creator_accounts')
      .select('*')
      .in('id', input.targetAccountIds)
      .eq('user_id', userId);

    const accounts = accountsData ?? [];
    const deploymentId = `fdep-${crypto.randomUUID().slice(0, 12)}`;

    const plan = buildStaggerSchedule({
      deploymentId,
      accounts,
      hookCount: input.hookAngles.length,
      baseIntervalMinutes: input.staggerMinutes,
    });

    const now = Math.floor(Date.now() / 1000);
    const skuId = input.skuId ?? 'sku-default';
    const videoAssetUrl = input.videoAssetUrl ?? 'https://assets.sophia.ai/default.mp4';
    const deploymentRecord = FleetCampaignDeploymentSchema.parse({
      id: deploymentId,
      userId,
      skuId,
      campaignName: input.campaignName,
      targetFleetAccountIds: input.targetAccountIds,
      generatedHookAngles: input.hookAngles,
      bridgePageSlug: input.bridgePageSlug ?? `deal-${deploymentId}`,
      status: 'SCHEDULED',
      staggerIntervalMinutes: input.staggerMinutes,
      totalAssignedAccounts: plan.totalScheduled,
      totalPublishedVideos: 0,
      aggregateGmv: 0,
      aggregateCommission: 0,
      createdAt: now,
      updatedAt: now,
    });

    await db.execute(
      `INSERT INTO fleet_campaign_deployments (
        id, user_id, sku_id, campaign_name, target_fleet_account_ids,
        generated_hook_angles, bridge_page_slug, status,
        stagger_interval_minutes, total_assigned_accounts,
        total_published_videos, aggregate_gmv, aggregate_commission,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        deploymentRecord.id,
        deploymentRecord.userId,
        deploymentRecord.skuId,
        deploymentRecord.campaignName,
        JSON.stringify(deploymentRecord.targetFleetAccountIds),
        JSON.stringify(deploymentRecord.generatedHookAngles),
        deploymentRecord.bridgePageSlug,
        deploymentRecord.status,
        deploymentRecord.staggerIntervalMinutes,
        deploymentRecord.totalAssignedAccounts,
        deploymentRecord.totalPublishedVideos,
        deploymentRecord.aggregateGmv,
        deploymentRecord.aggregateCommission,
        deploymentRecord.createdAt,
        deploymentRecord.updatedAt,
      ],
    );

    await inngest.send({
      name: 'fleet.stagger.publish.requested',
      data: {
        deploymentId,
        userId,
        skuId,
        targetAccountIds: input.targetAccountIds,
        videoAssetUrl,
        hookAngles: input.hookAngles,
        staggerMinutes: input.staggerMinutes,
      },
    });

    return {
      success: true,
      deploymentId,
      scheduledCount: plan.totalScheduled,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'FAILED_TO_LAUNCH_DEPLOYMENT',
    };
  }
}
