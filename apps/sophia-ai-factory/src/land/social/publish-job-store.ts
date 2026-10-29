/**
 * Publish Job Store — D1 persistence for social media video direct publishing
 * Tracks job lifecycle: PENDING / DRAFT -> PACED -> UPLOADING -> PUBLISHED / FAILED.
 * Layer: land/social | File size: < 200 LOC | Zero :any.
 * @module land/social/publish-job-store
 */

import type { D1Database } from '@/seed/db/client';
import type {
  PublishJobStatus,
  SocialPublishJobInput,
} from '@/seed/types/social-publisher-types';
import { PUBLISH_JOBS_TABLE, mapPublishJobRow, resolvePublishJobsDb, getPublishJob, type PublishJobRow, type StoredPublishJob } from './publish-job-queries';

export {
  PUBLISH_JOBS_TABLE,
  mapPublishJobRow,
  ensurePublishJobsTable,
  getPublishJob,
  toSocialPublishResult,
  type PublishJobRow,
  type StoredPublishJob,
} from './publish-job-queries';

export async function createPublishJob(input: SocialPublishJobInput, overrideDb?: D1Database): Promise<StoredPublishJob> {
  const db = await resolvePublishJobsDb(overrideDb);
  const now = Date.now();
  const id = `pub_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
  const tagsJson = input.tags ? JSON.stringify(input.tags) : null;
  const initialStatus = input.status ?? 'PENDING';

  await db.prepare(`INSERT INTO ${PUBLISH_JOBS_TABLE} (
    id, user_id, channel_id, platform, video_url, title, description,
    tags_json, status, scheduled_for, created_at, updated_at
  ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?11)`).bind(
    id, input.userId, input.channelId, input.platform, input.videoUrl,
    input.title, input.description, tagsJson, initialStatus, input.scheduledFor ?? null, now
  ).run();

  const job = await getPublishJob(id, overrideDb);
  if (!job) throw new Error('Failed to retrieve created publish job');
  return job;
}

export async function listUserDraftJobs(userId: string, limit = 20, overrideDb?: D1Database): Promise<StoredPublishJob[]> {
  const db = await resolvePublishJobsDb(overrideDb);
  const res = await db.prepare(
    `SELECT * FROM ${PUBLISH_JOBS_TABLE} WHERE user_id = ?1 AND status = 'DRAFT' ORDER BY created_at DESC, id DESC LIMIT ?2`
  ).bind(userId, limit).all<PublishJobRow>();
  return (res.results ?? []).map(mapPublishJobRow);
}

export async function transitionDraftToPending(id: string, userId: string, overrideDb?: D1Database): Promise<StoredPublishJob> {
  const db = await resolvePublishJobsDb(overrideDb);
  const now = Date.now();
  const res = await db.prepare(
    `UPDATE ${PUBLISH_JOBS_TABLE} SET status = 'PENDING', updated_at = ?1 WHERE id = ?2 AND user_id = ?3 AND status = 'DRAFT'`
  ).bind(now, id, userId).run();
  if ((res.meta?.changes ?? 0) === 0) {
    throw new Error(`Draft job not found, unauthorized, or not in DRAFT status: ${id}`);
  }
  const updated = await getPublishJob(id, overrideDb);
  if (!updated) throw new Error(`Draft job not found: ${id}`);
  return updated;
}

export async function updatePublishJobStatus(
  id: string,
  status: PublishJobStatus,
  patch?: { platformPostId?: string; publishedUrl?: string; error?: string; completedAt?: number },
  overrideDb?: D1Database,
): Promise<StoredPublishJob> {
  const db = await resolvePublishJobsDb(overrideDb);
  const now = Date.now();
  const completedAt = status === 'PUBLISHED' || status === 'FAILED' ? (patch?.completedAt ?? now) : null;

  await db.prepare(`UPDATE ${PUBLISH_JOBS_TABLE}
    SET status = ?1, platform_post_id = COALESCE(?2, platform_post_id),
        published_url = COALESCE(?3, published_url), error_message = COALESCE(?4, error_message),
        completed_at = COALESCE(?5, completed_at), updated_at = ?6
    WHERE id = ?7`)
    .bind(status, patch?.platformPostId ?? null, patch?.publishedUrl ?? null, patch?.error ?? null, completedAt, now, id)
    .run();

  const updated = await getPublishJob(id, overrideDb);
  if (!updated) throw new Error(`Job not found: ${id}`);
  return updated;
}

/** Statuses a delivery may still claim for upload. */
const CLAIMABLE_STATUSES: readonly PublishJobStatus[] = ['PENDING', 'PACED'];

/**
 * Atomically claims a job for upload by moving it to `UPLOADING`.
 *
 * The claim is the only thing that stands between two concurrent deliveries of
 * the same event and two posts on one channel, so it must be a
 * compare-and-set, not a read-then-write. Two retries can both pass a status
 * check because they read the row before either writes it; with a guarded
 * UPDATE only the one that actually won the write proceeds, and `meta.changes`
 * is the proof of ownership. D1 has no transactions, which is exactly why the
 * ownership check is on the write itself.
 *
 * Returns null when the job was already claimed or is no longer claimable.
 */
export async function claimPublishJobForUpload(id: string, overrideDb?: D1Database): Promise<StoredPublishJob | null> {
  const db = await resolvePublishJobsDb(overrideDb);
  const placeholders = CLAIMABLE_STATUSES.map((_, i) => `?${i + 2}`).join(', ');
  const res = await db.prepare(
    `UPDATE ${PUBLISH_JOBS_TABLE} SET status = 'UPLOADING', updated_at = ?1
     WHERE id = ?${CLAIMABLE_STATUSES.length + 2} AND status IN (${placeholders})`
  )
    .bind(Date.now(), ...CLAIMABLE_STATUSES, id)
    .run();

  if ((res.meta?.changes ?? 0) === 0) return null;
  return getPublishJob(id, overrideDb);
}

export async function listChannelPublishJobs(channelId: string, limit = 20, overrideDb?: D1Database): Promise<StoredPublishJob[]> {
  const db = await resolvePublishJobsDb(overrideDb);
  const res = await db.prepare(
    `SELECT * FROM ${PUBLISH_JOBS_TABLE} WHERE channel_id = ?1 ORDER BY created_at DESC LIMIT ?2`
  ).bind(channelId, limit).all<PublishJobRow>();
  return (res.results ?? []).map(mapPublishJobRow);
}
