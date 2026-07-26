import { encrypt, decrypt } from '@/seed/security/encryption-aes-gcm';
import {
  getPlatformCredential,
  upsertPlatformCredential,
} from '@/seed/db/repositories/platform-credentials-repo';
import { logger } from '@/seed/utils/logger-utility';
import { getErrorMessage } from '@/seed/utils/to-error';
import { logAuditEvent } from '@/tree/audit/logger/audit-query';
import type { Platform } from '@/seed/types/channel-provider';

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

  const accessToken = await decrypt(cred.access_token_encrypted);
  const refreshToken = cred.refresh_token_encrypted
    ? await decrypt(cred.refresh_token_encrypted)
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
  const accessTokenEncrypted = await encrypt(input.accessToken);
  const refreshTokenEncrypted = input.refreshToken
    ? await encrypt(input.refreshToken)
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

  logAuditEvent({
    action: 'credential.store',
    userId: input.userId,
    metadata: { platform: input.platform },
  }).catch((err) => logger.warn('[credential] audit log failed', err));
}

export async function getClientCredentials(
  _userId: string,
  platform: Platform,
): Promise<{ clientId: string; clientSecret: string } | null> {
  const prefix = platform.toUpperCase();
  const clientId = process.env[`${prefix}_CLIENT_ID`];
  const clientSecret = process.env[`${prefix}_CLIENT_SECRET`];

  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}
