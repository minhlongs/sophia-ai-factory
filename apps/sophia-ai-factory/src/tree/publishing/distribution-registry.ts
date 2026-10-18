import type { Platform, PublishParams, PublishResult, PublishStatus } from './platform-adapter';
import { logger } from '@/seed/utils/logger-utility';
import { success, failure, type Result } from '@/seed/types/result';
import { classifyError } from '@/seed/types/failure-kind';
import {
  getAdapter,
  getSupportedPlatforms,
  isPlatformSupported,
} from './distribution-adapter-map';

export { getAdapter, getSupportedPlatforms, isPlatformSupported };

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