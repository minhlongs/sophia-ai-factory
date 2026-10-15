/**
 * Platform Credentials Store — D1 persistence with Optimistic Concurrency Control (OCC)
 * Manages encrypted platform credentials for multi-channel direct publishing.
 * Layer: land/social | File size: < 200 LOC | Zero :any.
 * @module land/social/platform-credentials-store
 */

import type { D1Database } from '@/seed/db/client';
import type { PlatformCredentialRecord, SocialPlatform } from '@/seed/types/social-publisher-types';
import { logger } from '@/seed/utils/logger-utility';
import { CREDENTIALS_TABLE, OCC_STALE_LOCK_MS, resolveCredentialsDb, getCredential } from './platform-credentials-queries';

export {
  CREDENTIALS_TABLE,
  OCC_STALE_LOCK_MS,
  mapCredentialRow,
  ensurePlatformCredentialsTable,
  getCredential,
  listUserCredentials,
  type CredentialRow,
} from './platform-credentials-queries';

export interface UpsertCredentialInput {
  userId: string;
  platform: SocialPlatform;
  channelId: string;
  channelName: string;
  encryptedTokens: string;
  tokenExpiresAt: number;
  dailyPostCount?: number;
  lastPublishedAt?: number;
  killSwitchActive?: boolean;
}

export async function upsertCredential(
  input: UpsertCredentialInput,
  overrideDb?: D1Database,
): Promise<PlatformCredentialRecord> {
  const db = await resolveCredentialsDb(overrideDb);
  const now = Date.now();
  const id = `cred_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;

  await db.prepare(`INSERT INTO ${CREDENTIALS_TABLE} (
    id, user_id, platform, channel_id, channel_name,
    encrypted_tokens, token_expires_at, daily_post_count,
    last_published_at, kill_switch_active, lock_version, updated_at
  ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, 1, ?11)
  ON CONFLICT(user_id, platform, channel_id) DO UPDATE SET
    channel_name = excluded.channel_name,
    encrypted_tokens = excluded.encrypted_tokens,
    token_expires_at = excluded.token_expires_at,
    daily_post_count = COALESCE(excluded.daily_post_count, ${CREDENTIALS_TABLE}.daily_post_count),
    last_published_at = COALESCE(excluded.last_published_at, ${CREDENTIALS_TABLE}.last_published_at),
    kill_switch_active = COALESCE(excluded.kill_switch_active, ${CREDENTIALS_TABLE}.kill_switch_active),
    lock_version = ${CREDENTIALS_TABLE}.lock_version + 1,
    updated_at = excluded.updated_at`)
    .bind(
      id, input.userId, input.platform, input.channelId, input.channelName,
      input.encryptedTokens, input.tokenExpiresAt, input.dailyPostCount ?? 0,
      input.lastPublishedAt ?? null,
      input.killSwitchActive ? 1 : 0,
      now,
    ).run();

  const record = await getCredential(input.userId, input.platform, input.channelId, overrideDb);
  if (!record) throw new Error('Failed to retrieve upserted credential');
  return record;
}

export async function acquireRefreshLock(
  userId: string,
  platform: SocialPlatform,
  channelId: string,
  currentLockVersion: number,
  nowMs: number = Date.now(),
  overrideDb?: D1Database,
): Promise<boolean> {
  const db = await resolveCredentialsDb(overrideDb);
  const staleThreshold = nowMs - OCC_STALE_LOCK_MS;

  const res = await db.prepare(`UPDATE ${CREDENTIALS_TABLE}
    SET lock_version = lock_version + 1, updated_at = ?1
    WHERE user_id = ?2 AND platform = ?3 AND channel_id = ?4
      AND (lock_version = ?5 OR updated_at < ?6)`)
    .bind(nowMs, userId, platform, channelId, currentLockVersion, staleThreshold)
    .run();

  const changed = (res.meta?.changes ?? 0) > 0;
  if (!changed) {
    logger.warn('[platform-credentials-store] OCC lock conflict or concurrency contention', {
      userId, platform, channelId, expectedVersion: currentLockVersion,
    });
  }
  return changed;
}

export async function completeTokenRefresh(
  userId: string,
  platform: SocialPlatform,
  channelId: string,
  newEncryptedTokens: string,
  newTokenExpiresAt: number,
  overrideDb?: D1Database,
): Promise<void> {
  const db = await resolveCredentialsDb(overrideDb);
  await db.prepare(`UPDATE ${CREDENTIALS_TABLE}
    SET encrypted_tokens = ?1, token_expires_at = ?2, lock_version = lock_version + 1, updated_at = ?3
    WHERE user_id = ?4 AND platform = ?5 AND channel_id = ?6`)
    .bind(newEncryptedTokens, newTokenExpiresAt, Date.now(), userId, platform, channelId)
    .run();
}

export async function setChannelKillSwitch(
  userId: string,
  channelId: string,
  active: boolean,
  overrideDb?: D1Database,
): Promise<boolean> {
  const db = await resolveCredentialsDb(overrideDb);
  const res = await db.prepare(`UPDATE ${CREDENTIALS_TABLE}
    SET kill_switch_active = ?1, lock_version = lock_version + 1, updated_at = ?2
    WHERE user_id = ?3 AND channel_id = ?4`)
    .bind(active ? 1 : 0, Date.now(), userId, channelId)
    .run();
  return (res.meta?.changes ?? 0) > 0;
}
