/**
 * YouTube channel configuration read queries (D1).
 * @module land/youtube/channel-config-queries
 */

import { getD1 } from '@/seed/db/client';
import { type ChannelConfig, rowToConfig } from './channel-config-types';

/** Fetch a channel config by (user, channel). Returns null when not found. */
export async function getChannelConfig(
  userId: string,
  channelId: string,
): Promise<ChannelConfig | null> {
  const db = await getD1();
  if (!db) throw new Error('D1 database binding not available');
  const row = await db
    .prepare(`SELECT * FROM youtube_channel_configs WHERE user_id = ?1 AND channel_id = ?2 LIMIT 1`)
    .bind(userId, channelId)
    .first<Record<string, unknown>>();
  return row ? rowToConfig(row) : null;
}

/** Fetch a channel config by id (ownership-checked). */
export async function getChannelConfigById(
  configId: string,
  userId: string,
): Promise<ChannelConfig | null> {
  const db = await getD1();
  if (!db) throw new Error('D1 database binding not available');
  const row = await db
    .prepare(`SELECT * FROM youtube_channel_configs WHERE id = ?1 AND user_id = ?2 LIMIT 1`)
    .bind(configId, userId)
    .first<Record<string, unknown>>();
  return row ? rowToConfig(row) : null;
}

/** List channel configs for a user. */
export async function listChannelConfigs(userId: string): Promise<readonly ChannelConfig[]> {
  const db = await getD1();
  if (!db) throw new Error('D1 database binding not available');
  const rows = await db
    .prepare(`SELECT * FROM youtube_channel_configs WHERE user_id = ?1 ORDER BY created_at DESC`)
    .bind(userId)
    .all<Record<string, unknown>>();
  return rows.results.map(rowToConfig);
}
