/**
 * Fair-Share GPU Scheduler: Lane Candidate Query & Atomic CAS Helpers
 *
 * Layer: tree/queue (Domain services & algorithms)
 *
 * @module tree/queue/scheduler/lease-candidate-sql
 */

import type { D1Database } from '@/seed/db/client';
import type {
  QueueLane,
  VideoRenderJob,
  VideoRenderRow,
} from '@/seed/types/video-render-queue';
import { mapRowToJob } from '@/seed/types/video-render-queue';

export async function fetchLaneCandidates(
  db: D1Database,
  lane: QueueLane,
  now: number,
): Promise<VideoRenderRow[]> {
  const candidates = await db
    .prepare(
      `SELECT * FROM video_render_jobs
       WHERE lane = ? AND (
         status = 'queued' OR
         (status = 'leased' AND leased_until < ?)
       )
       ORDER BY priority_score DESC, created_at ASC
       LIMIT 25`,
    )
    .bind(lane, now)
    .all<VideoRenderRow>();

  return candidates.results ?? [];
}

export async function tryAtomicLeaseCandidate(
  db: D1Database,
  candidate: VideoRenderRow,
  workerId: string,
  leasedUntil: number,
  now: number,
): Promise<VideoRenderJob | null> {
  const updateResult = await db
    .prepare(
      `UPDATE video_render_jobs
       SET status = 'leased',
           leased_by = ?,
           leased_until = ?,
           updated_at = ?
       WHERE id = ? AND (
         status = 'queued' OR
         (status = 'leased' AND leased_until < ?)
       )`,
    )
    .bind(workerId, leasedUntil, now, candidate.id, now)
    .run();

  const changes = updateResult.meta?.changes ?? 0;
  if (changes <= 0) {
    return null;
  }

  return mapRowToJob({
    ...candidate,
    status: 'leased',
    leased_by: workerId,
    leased_until: leasedUntil,
    updated_at: now,
  });
}
