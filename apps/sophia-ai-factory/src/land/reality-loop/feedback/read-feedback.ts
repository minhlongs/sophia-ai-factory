import { getD1 } from '@/seed/db/client';
import type { FeedbackStored, FeedbackRow } from './types';
import { rowToStored } from './helpers';

/** Fetch all feedback rows for a workspace, newest first. */
export async function listFeedbackByWorkspace(
  workspaceId: string,
  limit = 100,
): Promise<FeedbackStored[]> {
  const db = await getD1();
  if (!db) return [];
  const result = await db
    .prepare(
      `SELECT * FROM reality_feedback
       WHERE workspace_id = ?1
       ORDER BY created_at DESC
       LIMIT ?2`,
    )
    .bind(workspaceId, limit)
    .all<FeedbackRow>();
  return (result.results ?? []).map(rowToStored);
}

/** Fetch all feedback rows for a mission, optionally scoped to a workspace. */
export async function listFeedbackByMission(
  missionId: string,
  workspaceId?: string,
): Promise<FeedbackStored[]> {
  const db = await getD1();
  if (!db) return [];
  const result = await db
    .prepare(
      `SELECT * FROM reality_feedback
       WHERE mission_id = ?1
         AND (?2 IS NULL OR workspace_id = ?2)
       ORDER BY created_at ASC`,
    )
    .bind(missionId, workspaceId ?? null)
    .all<FeedbackRow>();
  return (result.results ?? []).map(rowToStored);
}

/** Fetch a single feedback row by idempotency key (idempotency probe). */
export async function findFeedbackByIdempotencyKey(
  idempotencyKey: string,
): Promise<FeedbackStored | null> {
  const db = await getD1();
  if (!db) return null;
  const row = await db
    .prepare(`SELECT * FROM reality_feedback WHERE idempotency_key = ?1 LIMIT 1`)
    .bind(idempotencyKey)
    .first<FeedbackRow>();
  return row ? rowToStored(row) : null;
}
