/**
 * Reality Feedback Store — D1 read/write helpers for the reality_feedback table.
 * Layer: land (business domain workflow — human feedback on missions).
 *
 * Privacy: free_text is stored but NEVER echoed into any log entry.
 * Every function here is workspace-scoped.
 *
 * @module land/reality-loop/feedback-store
 */

import { getD1, D1NotAvailableError } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import type { D1Result } from '@cloudflare/workers-types';

// ── Domain types ─────────────────────────────────────────────────────────────

export type FeedbackCheckpoint =
  | 'mission_complete'
  | 'creative_rejected'
  | 'human_correction'
  | 'mission_abandoned';

export type FeedbackUseful = 'YES' | 'NO';

export type FeedbackReason =
  | 'WRONG'
  | 'LOW_QUALITY'
  | 'NOT_MY_STYLE'
  | 'TOO_EXPENSIVE'
  | 'TOO_SLOW'
  | 'TOO_COMPLEX'
  | 'NOT_USEFUL'
  | 'OTHER';

export interface FeedbackInput {
  workspaceId: string;
  missionId: string;
  checkpoint: FeedbackCheckpoint;
  useful: FeedbackUseful;
  reason?: FeedbackReason | null;
  freeText?: string | null;
}

export interface FeedbackRow {
  id: string;
  workspace_id: string;
  mission_id: string;
  checkpoint: string;
  useful: string;
  reason: string | null;
  free_text: string | null;
  idempotency_key: string;
  created_at: number;
}

export interface FeedbackStored {
  id: string;
  workspaceId: string;
  missionId: string;
  checkpoint: FeedbackCheckpoint;
  useful: FeedbackUseful;
  reason: FeedbackReason | null;
  createdAt: number;
}

// ── Enums (source of truth for validation) ───────────────────────────────────

export const FEEDBACK_CHECKPOINTS: readonly FeedbackCheckpoint[] = [
  'mission_complete',
  'creative_rejected',
  'human_correction',
  'mission_abandoned',
];

export const FEEDBACK_REASONS: readonly FeedbackReason[] = [
  'WRONG',
  'LOW_QUALITY',
  'NOT_MY_STYLE',
  'TOO_EXPENSIVE',
  'TOO_SLOW',
  'TOO_COMPLEX',
  'NOT_USEFUL',
  'OTHER',
];

export const MAX_FREE_TEXT_LENGTH = 2000;

// ── Helpers ──────────────────────────────────────────────────────────────────

function newId(): string {
  // ULID-lite: timestamp (base32) + randomness. Sufficient for feedback rows.
  const now = Date.now();
  const t = now.toString(36).padStart(9, '0');
  const r = Math.random().toString(36).slice(2, 12).padEnd(12, '0');
  return `${t}${r}`.slice(0, 26);
}

function dayKey(ts = Date.now()): string {
  // UTC day bucket — idempotency resets daily so a user can resubmit next day.
  const d = new Date(ts);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(
    d.getUTCDate(),
  ).padStart(2, '0')}`;
}

export function buildIdempotencyKey(missionId: string, checkpoint: string, ts = Date.now()): string {
  return `loop_${missionId}_${checkpoint}_${dayKey(ts)}`;
}

function rowToStored(row: FeedbackRow): FeedbackStored {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    missionId: row.mission_id,
    checkpoint: row.checkpoint as FeedbackCheckpoint,
    useful: row.useful as FeedbackUseful,
    reason: (row.reason as FeedbackReason | null) ?? null,
    createdAt: row.created_at,
  };
}

// ── Write ────────────────────────────────────────────────────────────────────

/**
 * Persist a feedback row. Idempotent on idempotency_key — re-submitting the
 * same (mission, checkpoint, day) returns the existing row without error.
 *
 * Returns the stored row (new or existing).
 */
export async function saveFeedback(input: FeedbackInput): Promise<FeedbackStored> {
  const db = await getD1();
  if (!db) throw new D1NotAvailableError();

  const now = Date.now();
  const id = newId();
  const idempotencyKey = buildIdempotencyKey(input.missionId, input.checkpoint, now);
  const freeText = input.freeText ? input.freeText.slice(0, MAX_FREE_TEXT_LENGTH) : null;

  // Idempotent upsert: ON CONFLICT on the unique idempotency_key returns the
  // existing row. D1 has no transactions; we rely on the UNIQUE constraint.
  const insertSql = `
    INSERT INTO reality_feedback
      (id, workspace_id, mission_id, checkpoint, useful, reason, free_text, idempotency_key, created_at)
    VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
    ON CONFLICT(idempotency_key) DO UPDATE SET id = id
    RETURNING *;
  `;

  try {
    const result = await db
      .prepare(insertSql)
      .bind(
        id,
        input.workspaceId,
        input.missionId,
        input.checkpoint,
        input.useful,
        input.reason ?? null,
        freeText,
        idempotencyKey,
        now,
      )
      .first<FeedbackRow>();

    if (!result) {
      // ON CONFLICT triggered — fetch the existing row by idempotency_key.
      const existing = await db
        .prepare(`SELECT * FROM reality_feedback WHERE idempotency_key = ?1 LIMIT 1`)
        .bind(idempotencyKey)
        .first<FeedbackRow>();
      if (existing) return rowToStored(existing);
      throw new Error('Feedback upsert returned no row');
    }

    return rowToStored(result);
  } catch (error) {
    // Log metadata only — NEVER echo free_text.
    logger.error(
      '[RealityFeedback] save failed',
      error instanceof Error ? error : new Error(String(error)),
      { workspaceId: input.workspaceId, missionId: input.missionId, checkpoint: input.checkpoint },
    );
    throw error;
  }
}

// ── Reads ────────────────────────────────────────────────────────────────────

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

/** Fetch all feedback rows for a mission. */
export async function listFeedbackByMission(missionId: string): Promise<FeedbackStored[]> {
  const db = await getD1();
  if (!db) return [];
  const result = await db
    .prepare(
      `SELECT * FROM reality_feedback
       WHERE mission_id = ?1
       ORDER BY created_at ASC`,
    )
    .bind(missionId)
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

export interface FeedbackAggregate {
  total: number;
  usefulYes: number;
  usefulNo: number;
  byCheckpoint: Record<FeedbackCheckpoint, { yes: number; no: number }>;
  topReasons: { reason: FeedbackReason; count: number }[];
}

/** Aggregate feedback counts per workspace — powers the dashboard (Phase J). */
export async function aggregateFeedbackByWorkspace(
  workspaceId: string,
): Promise<FeedbackAggregate> {
  const db = await getD1();
  if (!db) {
    return {
      total: 0,
      usefulYes: 0,
      usefulNo: 0,
      byCheckpoint: { mission_complete: { yes: 0, no: 0 }, creative_rejected: { yes: 0, no: 0 }, human_correction: { yes: 0, no: 0 }, mission_abandoned: { yes: 0, no: 0 } },
      topReasons: [],
    };
  }

  const queryResult = (await db
    .prepare(
      `SELECT checkpoint, useful, reason, COUNT(*) AS cnt
       FROM reality_feedback
       WHERE workspace_id = ?1
       GROUP BY checkpoint, useful, reason`,
    )
    .bind(workspaceId)
    .all<{ checkpoint: string; useful: string; reason: string | null; cnt: number }>()) as D1Result<{
    checkpoint: string;
    useful: string;
    reason: string | null;
    cnt: number;
  }>;

  const rows = queryResult.results ?? [];

  const emptyCheckpoint = (): { yes: number; no: number } => ({ yes: 0, no: 0 });
  const byCheckpoint: Record<FeedbackCheckpoint, { yes: number; no: number }> = {
    mission_complete: emptyCheckpoint(),
    creative_rejected: emptyCheckpoint(),
    human_correction: emptyCheckpoint(),
    mission_abandoned: emptyCheckpoint(),
  };
  const reasonCounts = new Map<FeedbackReason, number>();
  let total = 0;
  let usefulYes = 0;
  let usefulNo = 0;

  for (const r of rows) {
    total += r.cnt;
    const cp = r.checkpoint as FeedbackCheckpoint;
    if (r.useful === 'YES') {
      usefulYes += r.cnt;
      byCheckpoint[cp].yes += r.cnt;
    } else {
      usefulNo += r.cnt;
      byCheckpoint[cp].no += r.cnt;
    }
    if (r.reason) {
      reasonCounts.set(r.reason as FeedbackReason, (reasonCounts.get(r.reason as FeedbackReason) ?? 0) + r.cnt);
    }
  }

  const topReasons = [...reasonCounts.entries()]
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return { total, usefulYes, usefulNo, byCheckpoint, topReasons };
}
