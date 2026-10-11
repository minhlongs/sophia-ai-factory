import { logger } from '@/seed/utils/logger-utility';
import { getErrorMessage } from '@/seed/utils/to-error';
import { downloadAndStore } from '@/land/video/storage/video-storage-service';

export interface StoredAssetResult {
  r2Key: string | null;
  r2SizeBytes: number | null;
}

/**
 * Downloads video from upstream provider URL and stores in R2 bucket (best-effort).
 */
export async function transferVideoAssetToR2(
  videoUrl: string,
  videoId: string,
  userId: string,
): Promise<StoredAssetResult> {
  try {
    const stored = await downloadAndStore(videoUrl, videoId, `videos/${userId}/${videoId}.mp4`);
    return {
      r2Key: stored.path,
      r2SizeBytes: stored.sizeBytes,
    };
  } catch (r2Err) {
    logger.warn('[WebhookComplete] R2 copy failed — keeping HeyGen URL', {
      videoId,
      error: getErrorMessage(r2Err),
    });
    return {
      r2Key: null,
      r2SizeBytes: null,
    };
  }
}
