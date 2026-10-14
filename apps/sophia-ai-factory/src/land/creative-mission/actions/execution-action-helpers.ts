/**
 * Inngest event dispatch, rollback, and multi-track trigger helpers for creative mission execution.
 * @module land/creative-mission/actions/execution-action-helpers
 */

import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { inngest } from '@/seed/inngest/client';
import { sendInngestWithRetry } from '@/seed/inngest/send-with-retry';

export async function dispatchMissionInngestWithRollback(params: {
  runId: string;
  agentId: string;
  missionId: string;
  workspaceId: string;
  autonomyLevel: number;
  previousStatus: string;
  previousPhase?: string | null;
}): Promise<void> {
  const { runId, agentId, missionId, workspaceId, autonomyLevel, previousStatus, previousPhase } = params;

  try {
    await sendInngestWithRetry(() =>
      inngest.send({
        id: runId,
        name: 'agent.mission.started',
        data: {
          runId,
          agentId,
          missionId,
          workspaceId,
          autonomyLevel,
        },
        ts: Date.now(),
      }),
    );
  } catch (sendErr) {
    logger.error('[CreativeMission] inngest.send failed, rolling back mission status', {
      missionId,
      runId,
      previousStatus,
      error: sendErr instanceof Error ? sendErr.message : String(sendErr),
    });

    const db = await getD1();
    if (db) {
      try {
        await db
          .prepare(
            `UPDATE creative_missions
             SET status = ?, current_phase = ?, updated_at = ?
             WHERE id = ? AND status = 'running'`,
          )
          .bind(
            previousStatus,
            previousPhase ?? 'init',
            Math.floor(Date.now() / 1000),
            missionId,
          )
          .run();
      } catch (rollbackErr) {
        logger.error('[CreativeMission] Failed to rollback mission status', {
          missionId,
          error: rollbackErr instanceof Error ? rollbackErr.message : String(rollbackErr),
        });
      }
    }

    throw sendErr;
  }
}

export async function triggerMultiTrackMissionAsync(
  missionId: string,
  userId: string,
  workspaceId: string,
): Promise<void> {
  try {
    const { dispatchMultiTrackMission } = await import('@/tree/mission');
    void dispatchMultiTrackMission(missionId, {
      userId,
      workspaceId,
    }).catch((orchErr) => {
      logger.error('[CreativeMission] dispatchMultiTrackMission async execution failed', {
        missionId,
        error: orchErr instanceof Error ? orchErr.message : String(orchErr),
      });
    });
  } catch (importErr) {
    logger.warn('[CreativeMission] multi-track dispatch skipped', {
      error: importErr instanceof Error ? importErr.message : String(importErr),
    });
  }
}
