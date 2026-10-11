import type {
  FeedbackCheckpoint,
  FeedbackUseful,
  FeedbackReason,
  FeedbackRow,
  FeedbackStored,
} from './types';

export function newFeedbackId(): string {
  // ULID-lite: timestamp (base32) + randomness. Sufficient for feedback rows.
  const now = Date.now();
  const t = now.toString(36).padStart(9, '0');
  const r = Math.random().toString(36).slice(2, 12).padEnd(12, '0');
  return `${t}${r}`.slice(0, 26);
}

export function dayKey(ts = Date.now()): string {
  // UTC day bucket — idempotency resets daily so a user can resubmit next day.
  const d = new Date(ts);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(
    d.getUTCDate(),
  ).padStart(2, '0')}`;
}

export function buildIdempotencyKey(missionId: string, checkpoint: string, ts = Date.now()): string {
  return `loop_${missionId}_${checkpoint}_${dayKey(ts)}`;
}

export function rowToStored(row: FeedbackRow): FeedbackStored {
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
