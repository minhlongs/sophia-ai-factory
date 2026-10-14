/**
 * Read queries, row mapper, and table setup for Social Publish Job Store.
 * @module land/social/publish-job-queries
 */

import { getD1, type D1Database } from '@/seed/db/client';
import type {
  PublishJobStatus,
  SocialPlatform,
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

export async function resolvePublishJobsDb(overrideDb?: D1Database): Promise<D1Database> {
  const db = overrideDb ?? (await getD1());
  if (!db) throw new Error('D1 database binding not available');
  return db;
}

export async function ensurePublishJobsTable(overrideDb?: D1Database): Promise<void> {
  const db = await resolvePublishJobsDb(overrideDb);
  await db.prepare(`CREATE TABLE IF NOT EXISTS ${PUBLISH_JOBS_TABLE} (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL, channel_id TEXT NOT NULL, platform TEXT NOT NULL,
    video_url TEXT NOT NULL, title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '',
    tags_json TEXT, status TEXT NOT NULL DEFAULT 'PENDING', platform_post_id TEXT,
    published_url TEXT, error_message TEXT, scheduled_for INTEGER, completed_at INTEGER,
    created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
  )`).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_pub_jobs_user ON ${PUBLISH_JOBS_TABLE}(user_id, status)`).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_pub_jobs_channel ON ${PUBLISH_JOBS_TABLE}(channel_id, created_at DESC)`).run();
}

export async function getPublishJob(id: string, overrideDb?: D1Database): Promise<StoredPublishJob | null> {
  const db = await resolvePublishJobsDb(overrideDb);
  const row = await db.prepare(`SELECT * FROM ${PUBLISH_JOBS_TABLE} WHERE id = ?1 LIMIT 1`).bind(id).first<PublishJobRow>();
  return row ? mapPublishJobRow(row) : null;
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
