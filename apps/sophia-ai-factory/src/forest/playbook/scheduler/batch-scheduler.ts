/**
 * @module forest/playbook/scheduler/batch-scheduler
 * Core batch scheduler runner for recurring campaigns.
 */

import { createServerClient, getD1, type D1Client, type D1Database } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { getUserTier } from '@/seed/db/get-user-tier';
import { checkMissionQuota } from '@/tree/quota/mission-quota';
import { runMissionPreflightCheck } from '@/tree/mission/preflight-check';
import { deductCredits } from '@/tree/mcu/credits-repo';
import { dispatchMultiTrackMission } from '@/tree/mission/executor-bridge';
import { generateCampaignBlueprint } from '../campaign-generator';
import type { BatchRunResult, ScheduledCampaignRow } from './types';
import {
  fetchDueSchedulesFromClient,
  fetchDueSchedulesFromD1,
  advanceScheduleCAS,
} from './batch-queue-manager';
import { processRecurringCampaignRunsTable } from './cron-trigger-evaluator';
import { createScheduledCampaignMission } from './scheduled-mission-factory';

export async function executeSingleSchedule(
  schedule: ScheduledCampaignRow,
  effectiveToday: string,
  d1: D1Database | null,
  db: D1Client,
  result: BatchRunResult,
): Promise<void> {
  result.processed++;
  const userId = schedule.user_id;
  const workspaceId = schedule.workspace_id || userId;

  try {
    const userTier = await getUserTier(userId);
    const quota = await checkMissionQuota(userId, userTier, 'missions');
    if (!quota.allowed) {
      result.skippedQuota++;
      return;
    }

    const blueprint = await generateCampaignBlueprint(workspaceId, schedule.topic);
    const estimatedCostCents = blueprint.estimatedCostCents ?? 150;

    const preflight = await runMissionPreflightCheck({
      userId,
      workspaceId,
      requiredCapabilities: ['AI_TEXT', 'AI_AUDIO', 'AI_IMAGE', 'AI_VIDEO'],
      estimatedCostCents,
    });

    if (!preflight.passed) {
      result.skippedPreflight++;
      return;
    }

    const mission = await createScheduledCampaignMission({
      schedule,
      workspaceId,
      userId,
      effectiveToday,
      blueprint,
      estimatedCostCents,
    });

    const creditDeducted = await deductCredits(
      userId,
      estimatedCostCents,
      mission.id,
      'recurring_campaign_dispatch',
    );

    if (!creditDeducted) {
      result.failures.push(schedule.id);
      return;
    }

    await dispatchMultiTrackMission(mission.id, {
      userId,
      workspaceId,
      topic: schedule.topic,
      durationSeconds: blueprint.durationSeconds,
      aspectRatio: blueprint.aspectRatio,
      estimatedScenes: blueprint.estimatedScenes,
      estimatedCostCents,
      voiceStyle: blueprint.voiceStyle,
    });

    await advanceScheduleCAS(schedule, effectiveToday, d1, db);
    result.dispatched++;
  } catch (err) {
    logger.error(
      '[BatchScheduler] Unexpected error executing scheduled campaign',
      err instanceof Error ? err : new Error(String(err)),
      { scheduleId: schedule.id },
    );
    result.failures.push(schedule.id);
  }
}

/**
 * Process a batch of due recurring campaign schedules.
 */
export async function processRecurringCampaignBatch(todayStr?: string): Promise<BatchRunResult> {
  const effectiveToday = todayStr?.trim() || new Date().toISOString().split('T')[0];

  const result: BatchRunResult = {
    processed: 0,
    dispatched: 0,
    skippedQuota: 0,
    skippedPreflight: 0,
    failures: [],
  };

  const db = createServerClient();
  const d1 = await getD1();

  let dueSchedules = await fetchDueSchedulesFromClient(db, effectiveToday);
  if (dueSchedules.length === 0 && d1) {
    dueSchedules = await fetchDueSchedulesFromD1(d1, effectiveToday);
  }

  for (const schedule of dueSchedules) {
    await executeSingleSchedule(schedule, effectiveToday, d1, db, result);
  }

  if (d1) {
    await processRecurringCampaignRunsTable(d1, effectiveToday, result);
  }

  return result;
}
