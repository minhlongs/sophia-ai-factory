/**
 * YouTube channel configuration CRUD (D1).
 * Stores per-channel objective, audience, content pillars, cadence, guardrails.
 * BYOK: one config per (user, channel) — customer-controlled.
 * @module land/youtube/channel-config
 */

import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import {
  type ChannelConfig,
  type CreateChannelConfigInput,
  type UpdateChannelConfigInput,
  buildUpdateFields,
  genId,
  postsPerWeekForCadence,
  stringifyList,
  rowToConfig,
} from './channel-config-types';

/** Create a new channel config. Returns failure if (user, channel) already exists. */
export async function createChannelConfig(
  input: CreateChannelConfigInput,
): Promise<{ success: true; config: ChannelConfig } | { success: false; error: string }> {
  const _db = await getD1();
  if (!_db) return { success: false, error: 'D1 database binding not available' };
  const db = _db;
  try {
    const existing = await db
      .prepare(`SELECT id FROM youtube_channel_configs WHERE user_id = ?1 AND channel_id = ?2 LIMIT 1`)
      .bind(input.userId, input.channelId)
      .first<{ id: string }>();
    if (existing) {
      return { success: false, error: 'Channel config already exists for this user and channel' };
    }
    const id = genId();
    const postsPerWeek = postsPerWeekForCadence(input.cadence, input.postsPerWeek);
    await db
      .prepare(
        `INSERT INTO youtube_channel_configs
         (id, user_id, channel_id, channel_title, objective, audience, content_pillars,
          cadence, posts_per_week, guardrails, content_buffer_days, autonomy_level, metadata)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13)`,
      )
      .bind(
        id,
        input.userId,
        input.channelId,
        input.channelTitle ?? null,
        input.objective,
        input.audience,
        stringifyList(input.contentPillars),
        input.cadence,
        postsPerWeek,
        input.guardrails ?? null,
        input.contentBufferDays ?? 3,
        input.autonomyLevel ?? 2,
        input.metadata ? JSON.stringify(input.metadata) : null,
      )
      .run();
    const row = await db
      .prepare(`SELECT * FROM youtube_channel_configs WHERE id = ?1 LIMIT 1`)
      .bind(id)
      .first<Record<string, unknown>>();
    if (!row) return { success: false, error: 'Failed to read back created config' };
    return { success: true, config: rowToConfig(row) };
  } catch (err) {
    logger.error('createChannelConfig failed', toError(err), { userId: input.userId, channelId: input.channelId });
    return { success: false, error: toError(err).message };
  }
}

/** Fetch a channel config by (user, channel). Returns null when not found. */
export async function getChannelConfig(
  userId: string,
  channelId: string,
): Promise<ChannelConfig | null> {
  const _db = await getD1();
  if (!_db) throw new Error('D1 database binding not available');
  const db = _db;
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
  const _db = await getD1();
  if (!_db) throw new Error('D1 database binding not available');
  const db = _db;
  const row = await db
    .prepare(`SELECT * FROM youtube_channel_configs WHERE id = ?1 AND user_id = ?2 LIMIT 1`)
    .bind(configId, userId)
    .first<Record<string, unknown>>();
  return row ? rowToConfig(row) : null;
}

/** Update a channel config. Ownership-checked via userId. */
export async function updateChannelConfig(
  configId: string,
  userId: string,
  input: UpdateChannelConfigInput,
): Promise<{ success: true; config: ChannelConfig } | { success: false; error: string }> {
  const _db = await getD1();
  if (!_db) return { success: false, error: 'D1 database binding not available' };
  const db = _db;
  try {
    const existing = await db
      .prepare(`SELECT id FROM youtube_channel_configs WHERE id = ?1 AND user_id = ?2 LIMIT 1`)
      .bind(configId, userId)
      .first<{ id: string }>();
    if (!existing) return { success: false, error: 'Channel config not found or access denied' };

    const built = buildUpdateFields(input);
    if (!built) return { success: false, error: 'No fields to update' };
    built.fields.push('updated_at = datetime(\'now\')');
    built.values.push(configId, userId);
    await db
      .prepare(`UPDATE youtube_channel_configs SET ${built.fields.join(', ')} WHERE id = ?${built.values.length - 1} AND user_id = ?${built.values.length}`)
      .bind(...built.values)
      .run();
    const row = await db
      .prepare(`SELECT * FROM youtube_channel_configs WHERE id = ?1 AND user_id = ?2 LIMIT 1`)
      .bind(configId, userId)
      .first<Record<string, unknown>>();
    if (!row) return { success: false, error: 'Failed to read back updated config' };
    return { success: true, config: rowToConfig(row) };
  } catch (err) {
    logger.error('updateChannelConfig failed', toError(err), { configId, userId });
    return { success: false, error: toError(err).message };
  }
}

/** List channel configs for a user. */
export async function listChannelConfigs(userId: string): Promise<readonly ChannelConfig[]> {
  const _db = await getD1();
  if (!_db) throw new Error('D1 database binding not available');
  const db = _db;
  const rows = await db
    .prepare(`SELECT * FROM youtube_channel_configs WHERE user_id = ?1 ORDER BY created_at DESC`)
    .bind(userId)
    .all<Record<string, unknown>>();
  return rows.results.map(rowToConfig);
}

/** Soft-delete a channel config (set is_active = 0). */
export async function deactivateChannelConfig(
  configId: string,
  userId: string,
): Promise<{ success: true } | { success: false; error: string }> {
  const _db = await getD1();
  if (!_db) return { success: false, error: 'D1 database binding not available' };
  const db = _db;
  try {
    const res = await db
      .prepare(`UPDATE youtube_channel_configs SET is_active = 0, updated_at = datetime('now') WHERE id = ?1 AND user_id = ?2`)
      .bind(configId, userId)
      .run();
    if (!res || (res as { changes?: number }).changes === 0) {
      return { success: false, error: 'Channel config not found or access denied' };
    }
    return { success: true };
  } catch (err) {
    logger.error('deactivateChannelConfig failed', toError(err), { configId, userId });
    return { success: false, error: toError(err).message };
  }
}