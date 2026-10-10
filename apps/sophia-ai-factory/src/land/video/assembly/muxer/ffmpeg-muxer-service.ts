/**
 * Core service for FFmpeg video/audio muxing with R2 caching.
 * @module land/video/assembly/muxer/ffmpeg-muxer-service
 */

import { getVideoBucket } from '@/land/video/storage/r2-binding';
import { logger } from '@/seed/utils/logger-utility';
import { shouldAllowRequest, recordSuccess, recordFailure } from '@/seed/security/circuit-breaker';
import { classifyError } from '@/seed/types/failure-kind';
import { submitCloudconvertJob, pollCloudconvertJob } from './cloudconvert-client';
import type { MuxVideoAudioParams, MuxVideoAudioResult } from './types';

function buildPublicUrl(ref: { publicBaseUrl: string | null }, key: string): string {
  return ref.publicBaseUrl ? `${ref.publicBaseUrl}/${key}` : key;
}

/** Check R2 idempotency: return existing URL when object exists with size > 0. */
async function checkExistingObject(outputKey: string): Promise<string | null> {
  const ref = await getVideoBucket();
  if (!ref) return null;
  try {
    const head = await ref.bucket.head(outputKey);
    if (head && head.size > 0) {
      logger.info('[FFmpegMuxer] Idempotent hit — returning existing R2 object', {
        outputKey,
        size: head.size,
      });
      return buildPublicUrl(ref, outputKey);
    }
  } catch {
    // head() throws when object does not exist — treat as absent
  }
  return null;
}

/** Download a URL and upload to R2. Returns the public URL. */
async function downloadAndUploadToR2(
  downloadUrl: string,
  outputKey: string,
): Promise<{ url: string; durationMs: number }> {
  if (!shouldAllowRequest('ffmpeg')) {
    throw new Error('[FFmpegMuxer] Circuit breaker open for ffmpeg — too many failures');
  }

  try {
    const fetchRes = await fetch(downloadUrl);
    if (!fetchRes.ok) {
      throw new Error(`[FFmpegMuxer] Failed to download muxed mp4: ${fetchRes.status}`);
    }
    recordSuccess('ffmpeg');
    const buffer = await fetchRes.arrayBuffer();

    const ref = await getVideoBucket();
    if (ref) {
      await ref.bucket.put(outputKey, buffer, {
        httpMetadata: {
          contentType: 'video/mp4',
          cacheControl: 'public, max-age=31536000, immutable',
        },
      });
      logger.info('[FFmpegMuxer] Muxed mp4 uploaded to R2', { outputKey, bytes: buffer.byteLength });
      return { url: buildPublicUrl(ref, outputKey), durationMs: 0 };
    }

    logger.warn('[FFmpegMuxer] VIDEO_BUCKET unavailable — returning Cloudconvert temp URL', { outputKey });
    return { url: downloadUrl, durationMs: 0 };
  } catch (err) {
    const kind = classifyError(err);
    recordFailure('ffmpeg', kind);
    throw err;
  }
}

/**
 * Mux a video track + audio track into a single MP4 via Cloudconvert.
 * Uploads the result to R2 and returns the public URL.
 *
 * When CLOUDCONVERT_API_KEY is absent, an error is thrown — the pipeline
 * must not silently produce a stub MP4 that downstream steps would treat as real.
 */
export async function muxVideoAudio(
  params: MuxVideoAudioParams,
): Promise<MuxVideoAudioResult> {
  const { videoUrl, audioUrl, outputKey } = params;

  // Idempotency check — skip re-muxing if already done
  const existingUrl = await checkExistingObject(outputKey);
  if (existingUrl) {
    return { url: existingUrl, durationMs: 0 };
  }

  const apiKey = process.env.CLOUDCONVERT_API_KEY;

  if (!apiKey) {
    logger.error(
      '[FFmpegMuxer] CLOUDCONVERT_API_KEY not set — cannot mux audio/video',
      { outputKey },
    );
    throw new Error('[FFmpegMuxer] CLOUDCONVERT_API_KEY is required for audio/video muxing. Pipeline cannot proceed without it.');
  }

  logger.info('[FFmpegMuxer] Submitting Cloudconvert mux job', { outputKey });

  const jobId = await submitCloudconvertJob(apiKey, videoUrl, audioUrl);
  logger.info('[FFmpegMuxer] Cloudconvert job created', { jobId, outputKey });

  const exportTask = await pollCloudconvertJob(apiKey, jobId);
  const muxedUrl = exportTask.result?.files?.[0]?.url;

  if (!muxedUrl) {
    throw new Error(`[FFmpegMuxer] No output URL in Cloudconvert export task for job ${jobId}`);
  }

  logger.info('[FFmpegMuxer] Cloudconvert mux complete — downloading to R2', { jobId, muxedUrl });
  return downloadAndUploadToR2(muxedUrl, outputKey);
}
