/**
 * @module forest/playbook/scheduler/scheduled-mission-factory
 * Builds and persists scheduled recurring campaign missions.
 */

import { createMission } from '@/tree/mission/repository';
import type { generateCampaignBlueprint } from '../campaign-generator';
import type { ScheduledCampaignRow } from './types';

type GeneratedBlueprint = Awaited<ReturnType<typeof generateCampaignBlueprint>>;

export async function createScheduledCampaignMission(params: {
  schedule: ScheduledCampaignRow;
  workspaceId: string;
  userId: string;
  effectiveToday: string;
  blueprint: GeneratedBlueprint;
  estimatedCostCents: number;
}) {
  const { schedule, workspaceId, userId, effectiveToday, blueprint, estimatedCostCents } = params;
  const missionId = `m_sched_${schedule.id}_${Date.now()}`;
  const nowSec = Math.floor(Date.now() / 1000);

  return createMission({
    id: missionId,
    workspaceId,
    creatorId: userId,
    title: `${schedule.topic} — ${effectiveToday}`,
    objective: `Automated recurring playbook campaign for ${schedule.topic}`,
    audience: 'Target audience derived from playbook patterns',
    geography: 'global',
    timeframeStart: nowSec,
    timeframeEnd: nowSec + 7 * 86400,
    budgetCents: estimatedCostCents,
    spentCents: 0,
    autonomyLevel: 3,
    channels: [blueprint.targetPlatform],
    monetizationGoals: ['conversion'],
    constraints: {
      blueprintId: blueprint.id,
      scheduleId: schedule.id,
      source: 'playbook_recurring_batch',
      hookStyle: blueprint.hookStyle,
      voiceStyle: blueprint.voiceStyle,
    },
    successMetrics: {},
    status: 'draft',
    currentPhase: 'init',
    createdAt: nowSec,
    updatedAt: nowSec,
  });
}
