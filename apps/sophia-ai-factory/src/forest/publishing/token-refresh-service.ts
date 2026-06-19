import { listPlatformCredentials } from '@/seed/db/repositories/platform-credentials-repo';
import { getDecryptedCredentials, storeCredentials, getClientCredentials } from './credential-manager';
import { youtubeAdapter } from './youtube-adapter';
import { tiktokAdapter } from './tiktok-adapter';
import { instagramAdapter } from '@/land/video/publishing/providers/instagram-adapter';
import { logger } from '@/seed/utils/logger-utility';
import type { Platform, PlatformAdapter } from './platform-adapter';

const adapters: Record<Platform, PlatformAdapter> = {
  youtube: youtubeAdapter,
  tiktok: tiktokAdapter,
  instagram: instagramAdapter,
};

export function getAdapter(platform: Platform): PlatformAdapter {
  return adapters[platform];
}

export async function refreshExpiredTokensForUser(userId: string): Promise<number> {
  const credentials = await listPlatformCredentials(userId);
  let refreshed = 0;

  for (const cred of credentials) {
    const platform = cred.platform as Platform;
    const decrypted = await getDecryptedCredentials(userId, platform);
    if (!decrypted?.isExpired || !decrypted.refreshToken) continue;

    const clientCreds = await getClientCredentials(userId, platform);
    if (!clientCreds) continue;

    try {
      const adapter = adapters[platform];
      const result = await adapter.refreshToken(
        clientCreds.clientId,
        clientCreds.clientSecret,
        decrypted.refreshToken,
      );

      await storeCredentials({
        userId,
        platform,
        accessToken: result.accessToken,
        expiresIn: result.expiresIn,
      });

      refreshed++;
      logger.info('[token-refresh] Refreshed token', { userId, platform });
    } catch (err) {
      logger.error('[token-refresh] Failed to refresh', { userId, platform, error: String(err) });
    }
  }

  return refreshed;
}
