/**
 * @module forest/playbook/scheduler/cron-trigger-evaluator
 * Recurring campaign runs evaluator and mission dispatcher.
 */

import type { D1Database } from '@/seed/db/client';
import { getUserTier } from '@/seed/db/get-user-tier';
import { checkMissionQuota } from '@/tree/quota/mission-quota';
import { runMissionPreflightCheck } from '@/tree/mission/preflight-check';
import { deductCredits } from '@/tree/mcu/credits-repo';
import { createMission } from '@/tree/mission/repository';
import { dispatchMultiTrackMission } from '@/tree/mission/executor-bridge';
import { generateCampaignBlueprint } from '../campaign-generator';
import type { RecurringCampaignScheduleRow } from '@/seed/types/playbook-pattern';
import type { BatchRunResult } from './types';

export async function processRecurringCampaignRunsTable(
  d1: D1Database,
  effectiveToday: string,
  result: BatchRunResult,
): Promise<void> {
  try {
    const nowMs = Date.now();
    const recurringRunsRes = await d1
      .prepare(
        `SELECT * FROM recurring_campaign_runs
         WHERE is_active = 1 AND next_run_at <= ?`,
      )
      .bind(nowMs)
      .all<RecurringCampaignScheduleRow>();

    const recurringRuns = recurringRunsRes.results ?? [];
    for (const rec of recurringRuns) {
      result.processed++;
      const userTier = await getUserTier(rec.user_id);
      const quota = await checkMissionQuota(rec.user_id, userTier, 'missions');
      if (!quota.allowed) {
        result.skippedQuota++;
        continue;
      }

      const blueprint = await generateCampaignBlueprint(rec.workspace_id, 'Recurring Playbook Campaign');
      const batchSize = Math.max(1, rec.batch_size ?? 1);
      const totalCostCents = batchSize * (blueprint.estimatedCostCents ?? 150);

      const preflight = await runMissionPreflightCheck({
        userId: rec.user_id,
        workspaceId: rec.workspace_id,
        requiredCapabilities: ['AI_TEXT', 'AI_AUDIO', 'AI_IMAGE', 'AI_VIDEO'],
        estimatedCostCents: totalCostCents,
      });

      if (!preflight.passed) {
        result.skippedPreflight++;
        continue;
      }

      const missionId = `m_rec_${rec.id}_${Date.now()}`;
      const nowSec = Math.floor(Date.now() / 1000);
      const mission = await createMission({
        id: missionId,
        workspaceId: rec.workspace_id,
        creatorId: rec.user_id,
        title: `Campaign Run — ${effectiveToday}`,
        objective: `Automated recurring run for blueprint ${rec.blueprint_id}`,
        audience: 'Playbook audience',
        geography: 'global',
        timeframeStart: nowSec,
        timeframeEnd: nowSec + 7 * 86400,
        budgetCents: totalCostCents,
        spentCents: 0,
        autonomyLevel: 3,
        channels: [blueprint.targetPlatform],
        monetizationGoals: ['conversion'],
        constraints: { blueprintId: rec.blueprint_id, scheduleId: rec.id, batchSize },
        successMetrics: {},
        status: 'draft',
        currentPhase: 'init',
        createdAt: nowSec,
        updatedAt: nowSec,
      });

      const creditDeducted = await deductCredits(
        rec.user_id,
        totalCostCents,
        mission.id,
        'recurring_campaign_dispatch',
      );

      if (!creditDeducted) {
        result.failures.push(rec.id);
        continue;
      }

      await dispatchMultiTrackMission(mission.id, {
        userId: rec.user_id,
        workspaceId: rec.workspace_id,
        topic: 'Recurring Campaign Batch',
        durationSeconds: blueprint.durationSeconds,
        aspectRatio: blueprint.aspectRatio,
        estimatedScenes: blueprint.estimatedScenes,
        estimatedCostCents: totalCostCents,
      });

      const nextRunAt = nowMs + 7 * 86400 * 1000;
      await d1
        .prepare(
          `UPDATE recurring_campaign_runs
           SET next_run_at = ?, last_run_at = ?, total_runs = total_runs + 1, last_status = 'running', updated_at = ?
           WHERE id = ? AND next_run_at = ?`,
        )
        .bind(nextRunAt, nowMs, nowMs, rec.id, rec.next_run_at)
        .run();

      result.dispatched++;
    }
  } catch {
    // Non-fatal if table does not exist or query fails
  }
}
