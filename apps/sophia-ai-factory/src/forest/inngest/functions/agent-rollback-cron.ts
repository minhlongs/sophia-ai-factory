/**
 * Agent Rollback Cron — Inngest function
 * Layer: forest (reusable infrastructure orchestrators)
 *
 * Periodically scans for failed agent runs that haven't exhausted retries
 * and re-dispatches them for automatic recovery.
 *
 * Triggered by cron event every 5 minutes.
 *
 * @module forest/inngest/functions
 */

import { inngest } from '@/tree/inngest/client';
import { logger } from '@/seed/utils/logger-utility';
import { getD1 } from '@/seed/db/client';
import { success, failure } from '@/seed/types/result';

const MAX_RETRIES = 3;
const SCAN_WINDOW_MS = 30 * 60 * 1000; // last 30 min

interface FailedRun {
  id: string;
  agentId: string;
  missionId: string;
  workspaceId: string;
  autonomyLevel: number;
  retryCount: number;
  errorMessage: string;
}

export const agentRollbackCron = inngest.createFunction(
  {
    id: 'agent-rollback-cron',
    retries: 0,
  },
  { cron: '*/5 * * * *' },
  async () => {
    logger.info('agentRollbackCron: starting scan');

    const db = getD1();
    if (!db) {
      logger.error('agentRollbackCron: D1 not available');
      return { scanned: 0, retried: 0 };
    }

    const windowCutoff = Math.floor((Date.now() - SCAN_WINDOW_MS) / 1000);

    // Find failed runs in the scan window that haven't exhausted retries
    const rows = await db
      .prepare(
        `SELECT id, agent_id, mission_id, workspace_id, autonomy_level, retry_count, error_message
         FROM agent_runs
         WHERE status = 'failed'
           AND ended_at >= ?
           AND retry_count < ?
         ORDER BY ended_at ASC
         LIMIT 50`
      )
      .bind(windowCutoff, MAX_RETRIES)
      .all<FailedRun>();

    const failedRuns = rows.results ?? [];

    logger.info('agentRollbackCron: scan complete', {
      windowStart: windowCutoff,
      found: failedRuns.length,
    });

    let retried = 0;
    for (const run of failedRuns) {
      try {
        // Mark run as retrying
        const updated = await db
          .prepare(
            `UPDATE agent_runs
             SET status = 'running', phase = 'retrying', retry_count = retry_count + 1
             WHERE id = ? AND status = 'failed'`
          )
          .bind(run.id)
          .run();

        if (updated.meta.changes === 0) continue; // already picked up by another scan

        // Re-dispatch the mission event
        await inngest.send({
          name: 'agent.mission.started',
          data: {
            runId: run.id,
            agentId: run.agentId,
            missionId: run.missionId,
            workspaceId: run.workspaceId,
            autonomyLevel: run.autonomyLevel,
          },
        });

        logger.info('agentRollbackCron: retrying run', {
          runId: run.id,
          agentId: run.agentId,
          attempt: run.retryCount + 1,
        });

        retried++;
      } catch (err) {
        logger.error('agentRollbackCron: failed to retry run', {
          runId: run.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return { scanned: failedRuns.length, retried };
  }
);