/**
 * Publish Job Store — D1 persistence for social media video direct publishing
 * Tracks job lifecycle: PENDING -> PACED -> UPLOADING -> PUBLISHED / FAILED.
 * Layer: land/social | File size: < 200 LOC | Zero :any.
 * @module land/social/publish-job-store
 */

import { getD1 } from '@/seed/db/client';
import type { D1Database } from '@/seed/db/client';
import type {
  PublishJobStatus,
  SocialPlatform,
  SocialPublishJobInput,
  SocialPublishResult,
} from '@/seed/types/social-publisher-types';

export const PUBLISH_JOBS_TABLE = 'social_publish_jobs';

export interface PublishJobRow {
  id: string;
  user_id: string;
  channel_id: string;
  platform: string;
  video_url: string;
  title: string;
  description: string;
  tags_json: string | null;
  status: string;
  platform_post_id: string | null;
  published_url: string | null;
  error_message: string | null;
  scheduled_for: number | null;
  completed_at: number | null;
  created_at: number;
  updated_at: number;
}

export interface StoredPublishJob {
  id: string;
  userId: string;
  channelId: string;
  platform: SocialPlatform;
  videoUrl: string;
  title: string;
  description: string;
  tags?: string[];
  status: PublishJobStatus;
  platformPostId?: string;
  publishedUrl?: string;
  error?: string;
  scheduledFor?: number;
  completedAt?: number;
  createdAt: number;
  updatedAt: number;
}

export function mapPublishJobRow(row: PublishJobRow): StoredPublishJob {
  let tags: string[] | undefined;
  if (row.tags_json) {
    try {
      const parsed = JSON.parse(row.tags_json);
      if (Array.isArray(parsed)) tags = parsed.map(String);
    } catch {
      // ignore malformed tags
    }
  }
  return {
    id: row.id,
    userId: row.user_id,
    channelId: row.channel_id,
    platform: row.platform as SocialPlatform,
    videoUrl: row.video_url,
    title: row.title,
    description: row.description,
    tags,
    status: row.status as PublishJobStatus,
    platformPostId: row.platform_post_id ?? undefined,
    publishedUrl: row.published_url ?? undefined,
    error: row.error_message ?? undefined,
    scheduledFor: row.scheduled_for ?? undefined,
    completedAt: row.completed_at ?? undefined,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  };
}

async function resolveDb(overrideDb?: D1Database): Promise<D1Database> {
  const db = overrideDb ?? (await getD1());
  if (!db) throw new Error('D1 database binding not available');
  return db;
}

export async function ensurePublishJobsTable(overrideDb?: D1Database): Promise<void> {
  const db = await resolveDb(overrideDb);
  await db.prepare(`CREATE TABLE IF NOT EXISTS ${PUBLISH_JOBS_TABLE} (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    platform TEXT NOT NULL,
    video_url TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    tags_json TEXT,
    status TEXT NOT NULL DEFAULT 'PENDING',
    platform_post_id TEXT,
    published_url TEXT,
    error_message TEXT,
    scheduled_for INTEGER,
    completed_at INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_pub_jobs_user ON ${PUBLISH_JOBS_TABLE}(user_id, status)`).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_pub_jobs_channel ON ${PUBLISH_JOBS_TABLE}(channel_id, created_at DESC)`).run();
}

export async function createPublishJob(
  input: SocialPublishJobInput,
  overrideDb?: D1Database,
): Promise<StoredPublishJob> {
  const db = await resolveDb(overrideDb);
  const now = Date.now();
  const id = `pub_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
  const tagsJson = input.tags ? JSON.stringify(input.tags) : null;

  await db.prepare(`INSERT INTO ${PUBLISH_JOBS_TABLE} (
    id, user_id, channel_id, platform, video_url, title, description,
    tags_json, status, scheduled_for, created_at, updated_at
  ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 'PENDING', ?9, ?10, ?10)`)
    .bind(
      id, input.userId, input.channelId, input.platform, input.videoUrl,
      input.title, input.description, tagsJson, input.scheduledFor ?? null, now
    ).run();

  const job = await getPublishJob(id, overrideDb);
  if (!job) throw new Error('Failed to retrieve created publish job');
  return job;
}

export async function getPublishJob(id: string, overrideDb?: D1Database): Promise<StoredPublishJob | null> {
  const db = await resolveDb(overrideDb);
  const row = await db.prepare(
    `SELECT * FROM ${PUBLISH_JOBS_TABLE} WHERE id = ?1 LIMIT 1`
  ).bind(id).first<PublishJobRow>();
  return row ? mapPublishJobRow(row) : null;
}

export async function updatePublishJobStatus(
  id: string,
  status: PublishJobStatus,
  patch?: { platformPostId?: string; publishedUrl?: string; error?: string; completedAt?: number },
  overrideDb?: D1Database,
): Promise<StoredPublishJob> {
  const db = await resolveDb(overrideDb);
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

export async function listChannelPublishJobs(
  channelId: string,
  limit = 20,
  overrideDb?: D1Database,
): Promise<StoredPublishJob[]> {
  const db = await resolveDb(overrideDb);
  const res = await db.prepare(
    `SELECT * FROM ${PUBLISH_JOBS_TABLE} WHERE channel_id = ?1 ORDER BY created_at DESC LIMIT ?2`
  ).bind(channelId, limit).all<PublishJobRow>();
  return (res.results ?? []).map(mapPublishJobRow);
}

export function toSocialPublishResult(job: StoredPublishJob): SocialPublishResult {
  return {
    jobId: job.id,
    platform: job.platform,
    status: job.status,
    platformPostId: job.platformPostId,
    publishedUrl: job.publishedUrl,
    error: job.error,
    completedAt: job.completedAt,
  };
}
