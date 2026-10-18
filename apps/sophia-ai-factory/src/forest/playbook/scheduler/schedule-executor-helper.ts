/**
 * Helper to execute preflight checks and create/dispatch recurring campaign mission.
 * Layer: forest/playbook/scheduler
 * @module forest/playbook/scheduler/schedule-executor-helper
 */

import { getUserTier } from '@/seed/db/get-user-tier';
import { checkMissionQuota } from '@/tree/quota/mission-quota';
import { runMissionPreflightCheck } from '@/tree/mission/preflight-check';
import { deductCredits } from '@/tree/mcu/credits-repo';
import { dispatchMultiTrackMission } from '@/tree/mission/executor-bridge';
import { generateCampaignBlueprint } from '../campaign-generator';
import type { BatchRunResult, ScheduledCampaignRow } from './types';
import { createScheduledCampaignMission } from './scheduled-mission-factory';

export async function preflightAndDispatchMission(
  schedule: ScheduledCampaignRow,
  effectiveToday: string,
  result: BatchRunResult,
): Promise<boolean> {
  const userId = schedule.user_id;
  const workspaceId = schedule.workspace_id || userId;

  const userTier = await getUserTier(userId);
  const quota = await checkMissionQuota(userId, userTier, 'missions');
  if (!quota.allowed) {
    result.skippedQuota++;
    return false;
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
    return false;
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
    return false;
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

  return true;
}
