import { encrypt, decrypt } from '@/seed/security/encryption-aes-gcm';
import {
  getPlatformCredential,
  upsertPlatformCredential,
} from '@/seed/db/repositories/platform-credentials-repo';
import { resolveUserApiKey } from '@/tree/byok/resolve-user-api-key';
import { logger } from '@/seed/utils/logger-utility';
import type { Platform } from '@/lib/publishing/platform-adapter';

export interface DecryptedCredentials {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date | null;
  isExpired: boolean;
}

export async function getDecryptedCredentials(
  userId: string,
  platform: Platform,
): Promise<DecryptedCredentials | null> {
  const cred = await getPlatformCredential(userId, platform);
  if (!cred) return null;

  const key = getEncryptionKey();
  const accessToken = await decrypt(cred.access_token_encrypted, key);
  const refreshToken = cred.refresh_token_encrypted
    ? await decrypt(cred.refresh_token_encrypted, key)
    : null;

  const expiresAt = cred.token_expires_at ? new Date(cred.token_expires_at) : null;
  const isExpired = expiresAt ? expiresAt.getTime() < Date.now() : false;

  return { accessToken, refreshToken, expiresAt, isExpired };
}

export async function storeCredentials(input: {
  userId: string;
  platform: Platform;
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
  platformUserId?: string;
  platformChannelName?: string;
  scopes?: string;
}): Promise<void> {
  const key = getEncryptionKey();
  const accessTokenEncrypted = await encrypt(input.accessToken, key);
  const refreshTokenEncrypted = input.refreshToken
    ? await encrypt(input.refreshToken, key)
    : undefined;

  const tokenExpiresAt = input.expiresIn
    ? new Date(Date.now() + input.expiresIn * 1000).toISOString()
    : undefined;

  await upsertPlatformCredential({
    userId: input.userId,
    platform: input.platform,
    accessTokenEncrypted,
    refreshTokenEncrypted,
    tokenExpiresAt,
    platformUserId: input.platformUserId,
    platformChannelName: input.platformChannelName,
    scopes: input.scopes,
  });

  logger.info('[credential-manager] Stored credentials', {
    userId: input.userId,
    platform: input.platform,
  });
}

export async function getClientCredentials(
  userId: string,
  platform: Platform,
): Promise<{ clientId: string; clientSecret: string } | null> {
  const clientId = await resolveUserApiKey(userId, `${platform}_client_id`, undefined);
  const clientSecret = await resolveUserApiKey(userId, `${platform}_client_secret`, undefined);

  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

function getEncryptionKey(): string {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) throw new Error('[credential-manager] ENCRYPTION_KEY not configured');
  return key;
}
