import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';

export interface VideoPublish {
  id: string;
  user_id: string;
  video_id: string;
  platform: string;
  platform_video_id: string | null;
  status: string;
  scheduled_at: string | null;
  published_at: string | null;
  error_message: string | null;
  metadata: string | null;
  created_at: string;
}

export async function createVideoPublish(input: {
  userId: string;
  videoId: string;
  platform: string;
  metadata?: string;
  scheduledAt?: string;
}): Promise<VideoPublish> {
  const db = await getD1();
  if (!db) throw new Error('D1 database binding not available');
  const id = crypto.randomUUID().replace(/-/g, '').slice(0, 16);

  await db
    .prepare(
      `INSERT INTO video_publishes (id, user_id, video_id, platform, metadata, scheduled_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(id, input.userId, input.videoId, input.platform, input.metadata ?? null, input.scheduledAt ?? null)
    .run();

  logger.info('[video-publishes-repo] Created publish', { id, platform: input.platform });
  return (await getVideoPublish(id))!;
}

export async function getVideoPublish(id: string): Promise<VideoPublish | null> {
  const db = await getD1();
  if (!db) throw new Error('D1 database binding not available');
  return db.prepare('SELECT * FROM video_publishes WHERE id = ?').bind(id).first<VideoPublish>() ?? null;
}

export async function updateVideoPublishStatus(
  id: string,
  status: string,
  extra?: { platformVideoId?: string; errorMessage?: string; publishedAt?: string },
): Promise<void> {
  const db = await getD1();
  if (!db) throw new Error('D1 database binding not available');
  await db
    .prepare(
      `UPDATE video_publishes SET
        status = ?,
        platform_video_id = COALESCE(?, platform_video_id),
        error_message = COALESCE(?, error_message),
        published_at = COALESCE(?, published_at)
      WHERE id = ?`,
    )
    .bind(
      status,
      extra?.platformVideoId ?? null,
      extra?.errorMessage ?? null,
      extra?.publishedAt ?? null,
      id,
    )
    .run();
}

export async function listVideoPublishes(
  userId: string,
  videoId?: string,
): Promise<VideoPublish[]> {
  const db = await getD1();
  if (!db) throw new Error('D1 database binding not available');
  if (videoId) {
    const result = await db
      .prepare('SELECT * FROM video_publishes WHERE user_id = ? AND video_id = ? ORDER BY created_at DESC')
      .bind(userId, videoId)
      .all<VideoPublish>();
    return result.results ?? [];
  }
  const result = await db
    .prepare('SELECT * FROM video_publishes WHERE user_id = ? ORDER BY created_at DESC LIMIT 100')
    .bind(userId)
    .all<VideoPublish>();
  return result.results ?? [];
}

export async function getPendingPublishes(): Promise<VideoPublish[]> {
  const db = await getD1();
  if (!db) throw new Error('D1 database binding not available');
  const result = await db
    .prepare(
      `SELECT * FROM video_publishes
       WHERE status IN ('pending', 'uploading', 'processing')
       AND (scheduled_at IS NULL OR scheduled_at <= datetime('now'))
       ORDER BY created_at ASC LIMIT 50`,
    )
    .all<VideoPublish>();
  return result.results ?? [];
}
