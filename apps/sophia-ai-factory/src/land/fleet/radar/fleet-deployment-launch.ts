/**
 * @file fleet-deployment-launch.ts
 * @description Mutation helper for launching staggered fleet campaign deployments
 */

import { createServerClient } from '@/seed/db/client';
import { inngest } from '@/seed/inngest/client';
import {
  FleetCampaignDeploymentSchema,
  type FleetCreatorAccount,
} from '@/seed/types/fleet-matrix-sku-radar-types';
import { buildStaggerSchedule } from '@/tree/fleet/fleet-stagger-scheduler';
import type { LaunchFleetDeploymentInput } from './types';

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
