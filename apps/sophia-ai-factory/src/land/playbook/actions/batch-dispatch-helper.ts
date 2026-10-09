/**
 * Helper for creating and dispatching batch missions.
 *
 * Layer: land (business workflows / Server Actions)
 *
 * @module land/playbook/actions/batch-dispatch-helper
 */

import { logger } from '@/seed/utils/logger-utility';
import type { CampaignBlueprintRow } from '@/seed/types/playbook-pattern';
import { createMission } from '@/tree/mission/repository';
import { dispatchMultiTrackMission } from '@/tree/mission/executor-bridge';

export interface DispatchBatchMissionsParams {
  batchId: string;
  batchSize: number;
  blueprint: CampaignBlueprintRow;
  blueprintId: string;
  workspaceId: string;
  userId: string;
  singleCostCents: number;
}

export async function dispatchBatchMissions(
  p: DispatchBatchMissionsParams,
): Promise<string[]> {
  const missionIds: string[] = [];
  const nowSec = Math.floor(Date.now() / 1000);

  for (let i = 0; i < p.batchSize; i++) {
    const missionId = `m_batch_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 6)}`;
    try {
      await createMission({
        id: missionId,
        workspaceId: p.workspaceId,
        creatorId: p.userId,
        title: `${p.blueprint.name_en || 'Batch Campaign'} #${i + 1}`,
        objective: `Automated batch video variation #${i + 1} for blueprint ${p.blueprintId}`,
        audience: 'Playbook target audience',
        geography: 'global',
        timeframeStart: nowSec,
        timeframeEnd: nowSec + 7 * 86400,
        budgetCents: p.singleCostCents,
        spentCents: 0,
        autonomyLevel: 3,
        channels: [p.blueprint.target_platform || 'youtube_shorts'],
        monetizationGoals: ['conversion'],
        constraints: {
          blueprintId: p.blueprintId,
          batchIndex: i,
          batchId: p.batchId,
          totalBatch: p.batchSize,
        },
        successMetrics: {},
        status: 'draft',
        currentPhase: 'init',
        createdAt: nowSec,
        updatedAt: nowSec,
      });

      missionIds.push(missionId);

      await dispatchMultiTrackMission(missionId, {
        workspaceId: p.workspaceId,
        userId: p.userId,
        platform: p.blueprint.target_platform || 'youtube_shorts',
      });
    } catch (dispatchErr) {
      logger.warn('[dispatchBatchMissions] Multi-track dispatch error for mission', {
        missionId,
        error: String(dispatchErr),
      });
    }
  }

  return missionIds;
}
