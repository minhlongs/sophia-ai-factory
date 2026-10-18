/**
 * Video Publishing Scheduler DB and Entity Validation Helpers
 * Layer: land/video/publishing
 */

import { createServerClient, getD1, type D1Database } from '@/seed/db/client';
import { PublishConfigurationError } from './types';

export interface VideoRow {
  id: string;
  user_id: string;
}

export interface ChannelRow {
  id: string;
  user_id: string | null;
  tenant_id: string | null;
  provider: string;
}

export async function resolvePublishDb(customDb?: D1Database): Promise<D1Database> {
  let db: D1Database | null | undefined = customDb;
  if (!db && typeof getD1 === 'function') {
    try {
      db = await getD1();
    } catch {
      // ignore
    }
  }
  if (!db && typeof createServerClient === 'function') {
    try {
      db = createServerClient() as unknown as D1Database;
    } catch {
      // ignore
    }
  }
  if (!db) throw new Error('D1 database binding not available');
  return db;
}

export async function validateVideoAndChannel(
  db: D1Database,
  videoId: string,
  channelId: string,
  userId: string,
): Promise<{ channel: ChannelRow }> {
  const video = await db
    .prepare('SELECT id, user_id FROM videos WHERE id = ?1 LIMIT 1')
    .bind(videoId)
    .first<VideoRow>();
  if (!video) {
    throw new PublishConfigurationError('VIDEO_NOT_FOUND', `video ${videoId} not found`);
  }
  if (video.user_id !== userId) {
    throw new PublishConfigurationError('FORBIDDEN', 'video belongs to a different user');
  }

  const channel = await db
    .prepare('SELECT id, user_id, tenant_id, provider FROM publishing_channels WHERE id = ?1 LIMIT 1')
    .bind(channelId)
    .first<ChannelRow>();
  if (!channel) {
    throw new PublishConfigurationError('CHANNEL_NOT_FOUND', `channel ${channelId} not found`);
  }
  const owns = channel.user_id === userId || channel.tenant_id === userId;
  if (!owns) {
    throw new PublishConfigurationError('FORBIDDEN', 'channel belongs to a different user');
  }

  return { channel };
}
