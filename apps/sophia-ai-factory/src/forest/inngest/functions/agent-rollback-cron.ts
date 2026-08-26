/**
 * Agent Rollback Cron — Inngest function
 * Layer: forest (reusable infrastructure orchestrators)
 *
 * Periodically scans failed agent runs and either:
 *   1. re-dispatches them once their exponential backoff window has elapsed
 *      (retry-backoff policy: min(30 min, 5 min · 2^retryCount)), or
 *   2. flips them to the terminal 'cancelled' status with error code
 *      RETRIES_EXHAUSTED once they have consumed every automatic retry.
 *
 * The old fixed 30-minute scan window is gone: any failed run — no matter how
 * old — is evaluated per row in JS, so runs that failed hours ago are no
 * longer silently abandoned forever. Backoff math lives in the pure
 * tree/mission/retry-backoff module (no SQL math — D1/SQLite has no pow()).
 *
 * Triggered by cron event every 5 minutes. Function id and schedule unchanged.
 *
 * @module forest/inngest/functions
 */

import { inngest } from '@/seed/inngest/client';
import { logger } from '@/seed/utils/logger-utility';
import { getD1 } from '@/seed/db/client';
import {
  isRetriesExhausted,
  isRetryDue,
} from '@/tree/mission/retry-backoff';

/** Fallback automatic-retry cap when no mission_type_policies row applies. */
const DEFAULT_MAX_AUTO_RETRIES = 3;

/** Max failed runs evaluated per scan (oldest first). */
const SCAN_LIMIT = 100;

type D1Database = NonNullable<Awaited<ReturnType<typeof getD1>>>;

/**
 * Per-workspace retry caps keyed by mission type, loaded from
 * mission_type_policies (migration 0257). Empty when the table is absent or
 * unreadable — the cron then falls back to DEFAULT_MAX_AUTO_RETRIES.
 */
type PolicyCaps = Map<string, Map<string, number>>;

interface FailedRun {
  id: string;
  agentId: string;
  missionId: string | null;
  workspaceId: string;
  autonomyLevel: number;
  retryCount: number;
  endedAt: number | null;
  errorMessage: string;
  inputJson?: Record<string, unknown>;
  missionType: string | null;
}

interface PolicyRow {
  workspaceId: string;
  missionType: string;
  maxAutoRetries: number;
}

/** Outcome of processing one failed run row. */
type RowOutcome = 'retried' | 'cancelled' | 'skipped';

/**
 * Load per-(workspace, mission_type) retry caps. Non-fatal: any failure
 * (table not yet migrated, D1 error) yields an empty map and the cron keeps
 * working with the default cap.
 */
async function loadPolicyCaps(db: D1Database): Promise<PolicyCaps> {
  const caps: PolicyCaps = new Map();
  try {
    const rows = await db
      .prepare(
        `SELECT workspace_id AS workspaceId,
                mission_type AS missionType,
                max_auto_retries AS maxAutoRetries
         FROM mission_type_policies`
      )
      .all<PolicyRow>();
    for (const row of rows.results ?? []) {
      if (!row.workspaceId || !row.missionType) continue;
      const cap = Number(row.maxAutoRetries);
      if (!Number.isFinite(cap) || cap < 0) continue;
      let byType = caps.get(row.workspaceId);
      if (!byType) {
        byType = new Map();
        caps.set(row.workspaceId, byType);
      }
      byType.set(row.missionType, Math.floor(cap));
    }
  } catch (err) {
    logger.warn('agentRollbackCron: mission_type_policies unavailable, using default cap', {
      error: err instanceof Error ? err.message : String(err),
    });
  }
  return caps;
}

/** Resolve the retry cap for one run: policy row → default constant. */
function resolveMaxAutoRetries(
  caps: PolicyCaps,
  workspaceId: string,
  missionType: string | null
): number {
  if (!missionType) return DEFAULT_MAX_AUTO_RETRIES;
  return caps.get(workspaceId)?.get(missionType) ?? DEFAULT_MAX_AUTO_RETRIES;
}

/** Parse the input_json TEXT column; malformed or non-object JSON degrades to undefined. */
function parseInputJson(raw: unknown): Record<string, unknown> | undefined {
  if (!raw) return undefined;
  if (typeof raw === 'object') return raw as Record<string, unknown>;
  if (typeof raw !== 'string') return undefined;
  try {
    const parsed: unknown = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null
      ? (parsed as Record<string, unknown>)
      : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Terminal flip for a run that consumed every automatic retry. Guarded:
 * only a scan that still sees status='failed' wins the claim.
 * Returns true when this scan performed the flip.
 */
async function cancelExhaustedRun(
  db: D1Database,
  run: FailedRun,
  maxAutoRetries: number,
  nowMs: number
): Promise<boolean> {
  const errorJson = JSON.stringify({
    code: 'RETRIES_EXHAUSTED',
    retryCount: run.retryCount,
    maxAutoRetries,
    lastError: run.errorMessage ?? null,
  });
  const updated = await db
    .prepare(
      `UPDATE agent_runs
       SET status = 'cancelled',
           phase = 'cancelled',
           error_json = ?,
           ended_at = ?
       WHERE id = ? AND status = 'failed'`
    )
    .bind(errorJson, Math.floor(nowMs / 1000), run.id)
    .run();
  if (updated.meta.changes === 0) return false; // picked up by another scan
  logger.info('agentRollbackCron: retries exhausted, run cancelled', {
    runId: run.id,
    retryCount: run.retryCount,
    maxAutoRetries,
  });
  return true;
}

/**
 * Guarded claim + re-dispatch with the SAME runId (resume path). Only the
 * scan that flips a still-failed row to 'running' dispatches.
 * Returns true when this scan claimed and dispatched the run.
 */
async function redispatchRun(db: D1Database, run: FailedRun): Promise<boolean> {
  const updated = await db
    .prepare(
      `UPDATE agent_runs
       SET status = 'running', phase = 'retrying', retry_count = retry_count + 1
       WHERE id = ? AND status = 'failed'`
    )
    .bind(run.id)
    .run();

  if (updated.meta.changes === 0) return false; // already picked up by another scan

  await inngest.send({
    name: 'agent.mission.started',
    data: {
      runId: run.id,
      agentId: run.agentId,
      missionId: run.missionId as string,
      workspaceId: run.workspaceId,
      autonomyLevel: run.autonomyLevel,
      inputJson: parseInputJson(run.inputJson),
    },
  });

  logger.info('agentRollbackCron: retrying run', {
    runId: run.id,
    agentId: run.agentId,
    attempt: run.retryCount + 1,
  });
  return true;
}

/** Decide and act on one failed run row. Never throws — callers still guard. */
async function processFailedRun(
  db: D1Database,
  run: FailedRun,
  caps: PolicyCaps,
  nowMs: number
): Promise<RowOutcome> {
  const maxAutoRetries = resolveMaxAutoRetries(caps, run.workspaceId, run.missionType);

  // Terminal: every automatic retry consumed → stop the churn.
  if (isRetriesExhausted(run.retryCount, maxAutoRetries)) {
    const flipped = await cancelExhaustedRun(db, run, maxAutoRetries, nowMs);
    return flipped ? 'cancelled' : 'skipped';
  }

  // Backoff not yet elapsed → leave the row failed, revisit next scan.
  // A NULL ended_at (never recorded) is treated as immediately due so
  // such rows are not stranded forever.
  const endedAtMs = run.endedAt === null ? 0 : run.endedAt * 1000;
  if (!isRetryDue({ endedAt: endedAtMs, retryCount: run.retryCount, nowMs })) {
    return 'skipped';
  }

  // The mission executor requires a missionId (getMission is fatal for it),
  // so a failed run without one cannot be retried through this path. Leave
  // it failed and surface it instead of dispatching a payload the executor
  // would immediately reject.
  if (!run.missionId) {
    logger.warn('agentRollbackCron: run has no mission_id, cannot retry', {
      runId: run.id,
    });
    return 'skipped';
  }

  const dispatched = await redispatchRun(db, run);
  return dispatched ? 'retried' : 'skipped';
}

export const agentRollbackCron = inngest.createFunction(
  {
    id: 'agent-rollback-cron',
    retries: 0,
  },
  { cron: '*/5 * * * *' },
  async () => {
    logger.info('agentRollbackCron: starting scan');

    const db = await getD1();
    if (!db) {
      logger.error('agentRollbackCron: D1 not available');
      return { scanned: 0, retried: 0, cancelled: 0 };
    }

    const caps = await loadPolicyCaps(db);
    const nowMs = Date.now();

    // All failed runs, oldest first — no fixed time window. Per-row backoff
    // and retry-cap decisions happen in JS below (D1 has no pow()).
    const rows = await db
      .prepare(
        `SELECT r.id,
                r.agent_id       AS agentId,
                r.mission_id     AS missionId,
                r.workspace_id   AS workspaceId,
                r.autonomy_level AS autonomyLevel,
                r.retry_count    AS retryCount,
                r.ended_at       AS endedAt,
                r.error_message  AS errorMessage,
                r.input_json     AS inputJson,
                m.mission_type   AS missionType
         FROM agent_runs r
         LEFT JOIN creative_missions m ON m.id = r.mission_id
         WHERE r.status = 'failed'
         ORDER BY r.ended_at ASC
         LIMIT ?`
      )
      .bind(SCAN_LIMIT)
      .all<FailedRun>();

    const failedRuns = rows.results ?? [];

    logger.info('agentRollbackCron: scan complete', { found: failedRuns.length });

    let retried = 0;
    let cancelled = 0;
    for (const run of failedRuns) {
      try {
        const outcome = await processFailedRun(db, run, caps, nowMs);
        if (outcome === 'retried') retried += 1;
        else if (outcome === 'cancelled') cancelled += 1;
      } catch (err) {
        logger.error('agentRollbackCron: failed to process run', {
          runId: run.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return { scanned: failedRuns.length, retried, cancelled };
  }
);
