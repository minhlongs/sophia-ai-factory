import { getD1Raw } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';

export interface PlatformCredential {
  id: string;
  user_id: string;
  platform: string;
  access_token_encrypted: string;
  refresh_token_encrypted: string | null;
  token_expires_at: string | null;
  platform_user_id: string | null;
  platform_channel_name: string | null;
  scopes: string | null;
  created_at: string;
  updated_at: string;
}

export async function getPlatformCredential(
  userId: string,
  platform: string,
): Promise<PlatformCredential | null> {
  const db = await getD1Raw();
  return db
    .prepare('SELECT * FROM platform_credentials WHERE user_id = ? AND platform = ?')
    .bind(userId, platform)
    .first<PlatformCredential>() ?? null;
}

export async function upsertPlatformCredential(input: {
  userId: string;
  platform: string;
  accessTokenEncrypted: string;
  refreshTokenEncrypted?: string;
  tokenExpiresAt?: string;
  platformUserId?: string;
  platformChannelName?: string;
  scopes?: string;
}): Promise<void> {
  const db = await getD1Raw();
  const id = crypto.randomUUID().replace(/-/g, '').slice(0, 16);

  await db
    .prepare(
      `INSERT INTO platform_credentials (id, user_id, platform, access_token_encrypted, refresh_token_encrypted, token_expires_at, platform_user_id, platform_channel_name, scopes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id, platform) DO UPDATE SET
         access_token_encrypted = excluded.access_token_encrypted,
         refresh_token_encrypted = COALESCE(excluded.refresh_token_encrypted, platform_credentials.refresh_token_encrypted),
         token_expires_at = excluded.token_expires_at,
         platform_user_id = COALESCE(excluded.platform_user_id, platform_credentials.platform_user_id),
         platform_channel_name = COALESCE(excluded.platform_channel_name, platform_credentials.platform_channel_name),
         scopes = COALESCE(excluded.scopes, platform_credentials.scopes),
         updated_at = datetime('now')`,
    )
    .bind(
      id,
      input.userId,
      input.platform,
      input.accessTokenEncrypted,
      input.refreshTokenEncrypted ?? null,
      input.tokenExpiresAt ?? null,
      input.platformUserId ?? null,
      input.platformChannelName ?? null,
      input.scopes ?? null,
    )
    .run();

  logger.info('[platform-credentials-repo] Upserted credential', {
    userId: input.userId,
    platform: input.platform,
  });
}

export async function deletePlatformCredential(
  userId: string,
  platform: string,
): Promise<void> {
  const db = await getD1Raw();
  await db
    .prepare('DELETE FROM platform_credentials WHERE user_id = ? AND platform = ?')
    .bind(userId, platform)
    .run();
}

export async function listPlatformCredentials(
  userId: string,
): Promise<PlatformCredential[]> {
  const db = await getD1Raw();
  const result = await db
    .prepare('SELECT * FROM platform_credentials WHERE user_id = ? ORDER BY platform ASC')
    .bind(userId)
    .all<PlatformCredential>();
  return result.results ?? [];
}
