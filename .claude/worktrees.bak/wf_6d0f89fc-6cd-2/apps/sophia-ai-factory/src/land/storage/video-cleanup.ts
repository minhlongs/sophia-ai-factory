/**
 * R2 Video Artifact Cleanup
 *
 * Deletes video (and optional audio) objects from VIDEO_BUCKET when a video
 * job reaches permanent failure state. Non-blocking — failures are logged only.
 */

import { logger } from '@/seed/utils/logger-utility';
import { getVideoBucket } from '@/land/video/storage/r2-binding';

/**
 * Delete video (and optionally audio) artifacts from R2 for a permanently failed job.
 * Errors are caught and logged — this must never block the failure handling flow.
 *
 * @param r2Key    - R2 object key for the video file (e.g. 'videos/{userId}/{videoId}.mp4')
 * @param audioKey - Optional R2 object key for the audio file
 */
export async function deleteR2VideoArtifacts(
  r2Key: string,
  audioKey?: string,
): Promise<void> {
  const ref = await getVideoBucket();
  if (!ref) {
    // R2 unavailable in local dev — nothing to clean up
    return;
  }

  const keysToDelete = [r2Key, ...(audioKey ? [audioKey] : [])];

  for (const key of keysToDelete) {
    try {
      await ref.bucket.delete(key);
      logger.info('[video-cleanup] R2 artifact deleted', { key });
    } catch (err) {
      logger.warn('[video-cleanup] R2 delete failed (non-fatal)', {
        key,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}
