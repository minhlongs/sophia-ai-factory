/**
 * Platform Credentials Read Queries & Table Initialization
 * @module land/social/platform-credentials-queries
 */

import { getD1, type D1Database } from '@/seed/db/client';
import type { PlatformCredentialRecord, SocialPlatform } from '@/seed/types/social-publisher-types';

export const CREDENTIALS_TABLE = 'platform_credentials';
export const OCC_STALE_LOCK_MS = 5 * 60 * 1000;

export interface CredentialRow {
  id: string;
  user_id: string;
  platform: string;
  channel_id: string;
  channel_name: string;
  encrypted_tokens: string;
  token_expires_at: number;
  daily_post_count: number;
  last_published_at: number | null;
  kill_switch_active: number;
  lock_version: number;
  updated_at: number;
}

export function mapCredentialRow(row: CredentialRow): PlatformCredentialRecord {
  return {
    id: row.id,
    userId: row.user_id,
    platform: row.platform as SocialPlatform,
    channelId: row.channel_id,
    channelName: row.channel_name,
    encryptedTokens: row.encrypted_tokens,
    tokenExpiresAt: Number(row.token_expires_at),
    dailyPostCount: Number(row.daily_post_count ?? 0),
    lastPublishedAt: row.last_published_at !== null ? Number(row.last_published_at) : undefined,
    killSwitchActive: Boolean(row.kill_switch_active),
    lockVersion: Number(row.lock_version ?? 1),
    updatedAt: Number(row.updated_at),
  };
}

export async function resolveCredentialsDb(overrideDb?: D1Database): Promise<D1Database> {
  const db = overrideDb ?? (await getD1());
  if (!db) throw new Error('D1 database binding not available');
  return db;
}

export async function ensurePlatformCredentialsTable(overrideDb?: D1Database): Promise<void> {
  const db = await resolveCredentialsDb(overrideDb);
  await db.prepare(`CREATE TABLE IF NOT EXISTS ${CREDENTIALS_TABLE} (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    platform TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    channel_name TEXT NOT NULL,
    encrypted_tokens TEXT NOT NULL,
    token_expires_at INTEGER NOT NULL,
    daily_post_count INTEGER NOT NULL DEFAULT 0,
    last_published_at INTEGER,
    kill_switch_active INTEGER NOT NULL DEFAULT 0,
    lock_version INTEGER NOT NULL DEFAULT 1,
    updated_at INTEGER NOT NULL,
    UNIQUE(user_id, platform, channel_id)
  )`).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_platform_creds_lookup ON ${CREDENTIALS_TABLE}(user_id, platform, channel_id)`).run();
}

export async function getCredential(
  userId: string,
  platform: SocialPlatform,
  channelId: string,
  overrideDb?: D1Database,
): Promise<PlatformCredentialRecord | null> {
  const db = await resolveCredentialsDb(overrideDb);
  const row = await db.prepare(
    `SELECT * FROM ${CREDENTIALS_TABLE} WHERE user_id = ?1 AND platform = ?2 AND channel_id = ?3 LIMIT 1`
  ).bind(userId, platform, channelId).first<CredentialRow>();
  return row ? mapCredentialRow(row) : null;
}

export async function listUserCredentials(
  userId: string,
  overrideDb?: D1Database,
): Promise<PlatformCredentialRecord[]> {
  const db = await resolveCredentialsDb(overrideDb);
  const res = await db.prepare(
    `SELECT * FROM ${CREDENTIALS_TABLE} WHERE user_id = ?1 ORDER BY updated_at DESC`
  ).bind(userId).all<CredentialRow>();
  return (res.results ?? []).map(mapCredentialRow);
}
