/**
 * @file fleet-stagger-publish-job.ts
 * @description Inngest background job for staggered multi-account fleet video publication
 * @layer forest
 */

import { inngest } from '@/seed/inngest/client';
import { createServerClient } from '@/seed/db/client';
import { buildStaggerSchedule } from '@/tree/fleet/fleet-stagger-scheduler';
import type { FleetCreatorAccount } from '@/seed/types/fleet-matrix-sku-radar-types';

export const fleetStaggerPublishJob = inngest.createFunction(
  {
    id: 'fleet-stagger-publish-job',
    name: 'Fleet Matrix: Staggered Multi-Account Publishing',
    concurrency: { limit: 5 },
  },
  { event: 'fleet.stagger.publish.requested' },
  async ({ event, step }) => {
    const { deploymentId, targetAccountIds, hookAngles, staggerMinutes } = event.data;

    // Step 1: Fetch target creator accounts from D1
    const accounts = await step.run('fetch-target-accounts', async () => {
      const db = createServerClient();
      if (targetAccountIds.length === 0) return [];

      const { data } = await db
        .from<FleetCreatorAccount>('fleet_creator_accounts')
        .select('*')
        .in('id', targetAccountIds);
      return data ?? [];
    });

    // Step 2: Compute anti-shadowban staggered schedule
    const schedulePlan = await step.run('compute-schedule-plan', async () => {
      return buildStaggerSchedule({
        deploymentId,
        accounts,
        hookCount: hookAngles.length,
        baseIntervalMinutes: staggerMinutes,
      });
    });

    // Step 3: Update campaign deployment status to SCHEDULED
    await step.run('update-deployment-status', async () => {
      const db = createServerClient();
      await db.execute(
        `UPDATE fleet_campaign_deployments
         SET status = 'SCHEDULED',
             total_assigned_accounts = ?,
             updated_at = ?
         WHERE id = ?`,
        [schedulePlan.totalScheduled, Date.now(), deploymentId],
      );
    });

    return {
      deploymentId,
      totalScheduled: schedulePlan.totalScheduled,
      skippedCount: schedulePlan.skippedAccounts.length,
      estimatedDurationMinutes: schedulePlan.estimatedTotalDurationMinutes,
    };
  },
);
