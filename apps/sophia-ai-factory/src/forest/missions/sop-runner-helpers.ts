/**
 * Mission dispatch, polling, and cron schedule helpers for SOP Runner.
 * @module forest/missions/sop-runner-helpers
 */

import { logger } from '@/seed/utils/logger-utility';
import { createRun } from '@/seed/sop/sop-repo-runs';

export function nowSec(): number {
  return Math.floor(Date.now() / 1000);
}

/** Poll a mission for completion (max 5 min, 3s intervals) */
export async function awaitMissionResult(
  db: D1Database,
  missionId: string,
): Promise<{ ok: boolean; output: Record<string, unknown>; error?: string }> {
  const maxAttempts = 100; // 100 × 3s = 5 min
  const pollMs = 3_000;

  for (let i = 0; i < maxAttempts; i++) {
    const row = await db
      .prepare(`SELECT status, result, error FROM engine_missions WHERE id = ?1`)
      .bind(missionId)
      .first<{ status: string; result: string | null; error: string | null }>();

    if (!row) return { ok: false, output: {}, error: 'mission not found' };

    if (row.status === 'succeeded') {
      let output: Record<string, unknown> = {};
      try {
        output = row.result ? (JSON.parse(row.result) as Record<string, unknown>) : {};
      } catch {
        /* ignore */
      }
      return { ok: true, output };
    }

    if (row.status === 'failed' || row.status === 'cancelled') {
      return { ok: false, output: {}, error: row.error ?? 'mission failed' };
    }

    await new Promise((r) => setTimeout(r, pollMs));
  }

  return { ok: false, output: {}, error: 'mission timeout after 5 minutes' };
}

/** Create and dispatch a single mission, returning missionId */
export async function dispatchStep(
  db: D1Database,
  userId: string,
  command: string,
  args: Record<string, unknown>,
): Promise<string> {
  const missionId = crypto.randomUUID();
  await db
    .prepare(
      `INSERT INTO engine_missions (id, user_id, command, params, status, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, 'pending', ?5, ?5)`,
    )
    .bind(missionId, userId, command, JSON.stringify(args), nowSec())
    .run();

  const { dispatchMission } = await import('@/forest/missions/dispatcher');
  void dispatchMission(missionId).catch((e) => {
    logger.error(
      '[sop-runner] dispatch error',
      e instanceof Error ? e : new Error(String(e)),
      { missionId, command },
    );
  });

  return missionId;
}

export async function getRunById(db: D1Database, runId: string) {
  return db
    .prepare(`SELECT * FROM sop_executions WHERE id = ?1 LIMIT 1`)
    .bind(runId)
    .first<Awaited<ReturnType<typeof createRun>>>();
}

/** Compute next cron trigger time (simplified: null if no cron pattern) */
export function nextCronAt(cron: string | null): number | null {
  if (!cron) return null;
  return nowSec() + 24 * 3600;
}
