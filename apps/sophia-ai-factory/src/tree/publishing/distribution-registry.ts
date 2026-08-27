import { youtubeAdapter } from './youtube-adapter';
import { tiktokAdapter } from './tiktok-adapter';
import { instagramAdapter } from './instagram-adapter';
import { facebookAdapter } from './facebook-adapter';
import type { Platform, PlatformAdapter, PublishParams, PublishResult, PublishStatus } from './platform-adapter';
import { logger } from '@/seed/utils/logger-utility';

/**
 * Registry of all platform adapters for multi-channel distribution.
 * Single source of truth for the 7 platforms defined in creative-domain.ts:94
 * and the publishing_channels CHECK constraint.
 *
 * Unknown platforms fail loud — no silent fallbacks.
 */

const adapterMap: Map<Platform, PlatformAdapter> = new Map([
  ['youtube', youtubeAdapter],
  ['tiktok', tiktokAdapter],
  ['instagram', instagramAdapter],
  ['facebook', facebookAdapter],
  // x, whatsapp, blog will be added when their adapters land
]);

export function getAdapter(platform: Platform): PlatformAdapter {
  const adapter = adapterMap.get(platform);
  if (!adapter) {
    const supported = Array.from(adapterMap.keys()).join(', ');
    throw new Error(
      `[distribution-registry] No adapter registered for platform '${platform}'. Supported: ${supported}`,
    );
  }
  return adapter;
}

export function getSupportedPlatforms(): Platform[] {
  return Array.from(adapterMap.keys());
}

export function isPlatformSupported(platform: string): platform is Platform {
  return adapterMap.has(platform as Platform);
}

/**
 * Execute publish on a specific platform with full error handling.
 * Returns Result<T,E> for explicit success/failure — no throwing in business logic.
 */
import { success, failure, type Result } from '@/seed/types/result';
import { classifyError } from '@/seed/types/failure-kind';

export async function executePublish(
  platform: Platform,
  accessToken: string,
  params: PublishParams,
): Promise<Result<PublishResult, { code: string; message: string }>> {
  if (!isPlatformSupported(platform)) {
    return failure({
      code: 'UNSUPPORTED_PLATFORM',
      message: `Platform '${platform}' not supported. Supported: ${getSupportedPlatforms().join(', ')}`,
    });
  }

  const adapter = getAdapter(platform);

  try {
    const result = await adapter.uploadVideo(accessToken, params);
    logger.info('[distribution-registry] Publish executed', { platform, platformVideoId: result.platformVideoId });
    return success(result);
  } catch (err) {
    const kind = classifyError(err);
    logger.error('[distribution-registry] Publish failed', { platform, kind, error: String(err) });
    return failure({
      code: 'PUBLISH_FAILED',
      message: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Check status on a specific platform.
 */
export async function checkPublishStatus(
  platform: Platform,
  accessToken: string,
  platformVideoId: string,
): Promise<Result<{ status: PublishStatus; error?: string }, { code: string; message: string }>> {
  if (!isPlatformSupported(platform)) {
    return failure({
      code: 'UNSUPPORTED_PLATFORM',
      message: `Platform '${platform}' not supported`,
    });
  }

  const adapter = getAdapter(platform);

  try {
    const result = await adapter.checkStatus(accessToken, platformVideoId);
    return success(result);
  } catch (err) {
    logger.error('[distribution-registry] Status check failed', { platform, error: String(err) });
    return failure({
      code: 'STATUS_CHECK_FAILED',
      message: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Refresh token for a platform.
 */
export async function refreshPlatformToken(
  platform: Platform,
  clientId: string,
  clientSecret: string,
  refreshToken: string,
): Promise<Result<{ accessToken: string; expiresIn: number }, { code: string; message: string }>> {
  if (!isPlatformSupported(platform)) {
    return failure({
      code: 'UNSUPPORTED_PLATFORM',
      message: `Platform '${platform}' not supported`,
    });
  }

  const adapter = getAdapter(platform);

  try {
    const result = await adapter.refreshToken(clientId, clientSecret, refreshToken);
    return success(result);
  } catch (err) {
    logger.error('[distribution-registry] Token refresh failed', { platform, error: String(err) });
    return failure({
      code: 'TOKEN_REFRESH_FAILED',
      message: err instanceof Error ? err.message : String(err),
    });
  }
}