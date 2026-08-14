/**
 * Row-lock acquisition and token persistence for OAuth token refresh.
 *
 * C7: Row-lock via refreshing_at prevents concurrent cron runs from double-rotating.
 * Stale lock threshold: 10 minutes (handles crashed workers).
 *
 * @module forest/publishing/oauth-refresh-storage
 */

import { getD1, createServerClient } from '@/seed/db/client';
import { encryptToken } from './token-crypto';

const LOCK_STALE_S = 600; // 10 minutes

/**
 * Acquire per-channel row-lock via D1 raw SQL (C7).
 * D1QueryChain has no .or() — must use raw prepare().
 */
export async function acquireRefreshLock(channelId: string, now: number): Promise<boolean> {
  const staleBefore = now - LOCK_STALE_S;
  const _db = getD1();
  if (!_db) throw new Error('D1 database binding not available');
  const rawDb = _db;
  const result = await rawDb
    .prepare(
      'UPDATE publishing_channels SET refreshing_at = ? WHERE id = ? AND (refreshing_at IS NULL OR refreshing_at < ?)',
    )
    .bind(now, channelId, staleBefore)
    .run();
  return (result.meta?.changes ?? 0) === 1;
}

/**
 * Persist refreshed token + optional rotated refresh_token to the database.
 */
export async function updateChannelToken(
  channelId: string,
  newAccessToken: string,
  newExpiresAt: number,
  rotatedRefreshToken: string | null,
): Promise<void> {
  const db = createServerClient();
  const updatePatch: Record<string, unknown> = {
    access_token: await encryptToken(newAccessToken),
    expires_at: newExpiresAt,
    updated_at: Math.floor(Date.now() / 1000),
    refreshing_at: null,
  };
  if (rotatedRefreshToken !== null) {
    updatePatch.refresh_token = await encryptToken(rotatedRefreshToken);
  }
  await db.from('publishing_channels').update(updatePatch).eq('id', channelId);
}
