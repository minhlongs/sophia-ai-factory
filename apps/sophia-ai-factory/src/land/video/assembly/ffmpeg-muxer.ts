/**
 * FFmpeg Muxer via Cloudconvert REST API
 *
 * Merges a separate video track (no audio) + audio track (mp3/wav) into a
 * single MP4 using Cloudconvert's /v2/jobs endpoint. No WASM bundle needed —
 * avoids the 10 MB Cloudflare Workers size limit.
 *
 * Decision rationale (Option A chosen per Wave 15 spec):
 *   Option A — External FFmpeg-as-a-Service (Cloudconvert): zero bundle impact.
 *   Option B — @ffmpeg/ffmpeg WASM: ~8 MB alone, risks breaching CF 10 MB limit.
 *
 * Env vars:
 *   CLOUDCONVERT_API_KEY — required for real muxing
 *   R2_PUBLIC_BASE_URL   — used to build public URL for final mp4 in R2
 *
 * Idempotency:
 *   If the outputKey already exists in R2 with size > 0, the existing public
 *   URL is returned immediately without calling Cloudconvert.
 *
 * @module lib/video/ffmpeg-muxer
 */

import { getVideoBucket } from '@/land/video/storage/r2-binding';
import { logger } from '@/seed/utils/logger-utility';
import { shouldAllowRequest, recordSuccess, recordFailure } from '@/seed/security/circuit-breaker';
import { classifyError } from '@/seed/types/failure-kind';

export interface MuxVideoAudioParams {
  /** Public URL of the silent video file (mp4). */
  videoUrl: string;
  /** Public URL of the audio file (mp3 or wav). */
  audioUrl: string;
  /** R2 object key for the muxed output, e.g. "videos/{missionId}.mp4". */
  outputKey: string;
}

export interface MuxVideoAudioResult {
  /** Public URL of the muxed mp4 in R2 (or Cloudconvert temp URL on fallback). */
  url: string;
  /** Approximate duration in milliseconds (0 when unavailable). */
  durationMs: number;
}

// ── Cloudconvert API types ─────────────────────────────────────────────────────

interface CloudconvertTask {
  operation: string;
  [key: string]: unknown;
}

interface CloudconvertJobBody {
  tasks: Record<string, CloudconvertTask>;
}

interface CloudconvertTaskResult {
  status: string;
  result?: {
    files?: Array<{ url: string; size?: number }>;
  };
  message?: string;
}

interface CloudconvertJobResponse {
  data: {
    status: string;
    tasks: Array<{
      name: string;
      status: string;
      result?: {
        files?: Array<{ url: string; size?: number }>;
      };
      message?: string;
    }>;
  };
}

const CLOUDCONVERT_API = 'https://api.cloudconvert.com/v2';
const POLL_INTERVAL_MS = 3_000;
const POLL_MAX_ATTEMPTS = 40; // 40 × 3s = 2 min max

// ── Internal helpers ───────────────────────────────────────────────────────────

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

/** Submit a Cloudconvert job with import-video → import-audio → mux-ffmpeg → export tasks. */
async function submitCloudconvertJob(
  apiKey: string,
  videoUrl: string,
  audioUrl: string,
): Promise<string> {
  const body: CloudconvertJobBody = {
    tasks: {
      'import-video': {
        operation: 'import/url',
        url: videoUrl,
        filename: 'input_video.mp4',
      },
      'import-audio': {
        operation: 'import/url',
        url: audioUrl,
        filename: 'input_audio.mp3',
      },
      'mux-ffmpeg': {
        operation: 'convert',
        input: ['import-video', 'import-audio'],
        output_format: 'mp4',
        engine: 'ffmpeg',
        ffmpeg_parameters: '-map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -shortest',
      },
      'export-muxed': {
        operation: 'export/url',
        input: 'mux-ffmpeg',
        inline: false,
        archive_multiple_files: false,
      },
    },
  };

  if (!shouldAllowRequest('ffmpeg')) {
    throw new Error('[FFmpegMuxer] Circuit breaker open for ffmpeg — too many failures');
  }

  try {
    const res = await fetch(`${CLOUDCONVERT_API}/jobs`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text().catch((err) => {
        logger.warn('Failed to read Cloudconvert response text', { error: String(err), context: 'submitCloudconvertJob' });
        return '';
      });
      throw new Error(`[FFmpegMuxer] Cloudconvert job creation failed: ${res.status} — ${text}`);
    }

    recordSuccess('ffmpeg');
    const json = (await res.json()) as { data: { id: string } };
    return json.data.id;
  } catch (err) {
    const kind = classifyError(err);
    recordFailure('ffmpeg', kind);
    throw err;
  }
}

/** Poll a Cloudconvert job until finished or timeout. Returns export task result. */
async function pollCloudconvertJob(
  apiKey: string,
  jobId: string,
): Promise<CloudconvertTaskResult> {
  for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));

    if (!shouldAllowRequest('ffmpeg')) {
      throw new Error('[FFmpegMuxer] Circuit breaker open for ffmpeg — too many failures');
    }

    try {
      const res = await fetch(`${CLOUDCONVERT_API}/jobs/${jobId}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });

      if (!res.ok) {
        throw new Error(`[FFmpegMuxer] Cloudconvert poll failed: ${res.status}`);
      }

      recordSuccess('ffmpeg');
      const json = (await res.json()) as CloudconvertJobResponse;
      const job = json.data;

      if (job.status === 'finished') {
        const exportTask = job.tasks.find((t) => t.name === 'export-muxed');
        if (!exportTask) throw new Error('[FFmpegMuxer] export-muxed task missing from finished job');
        return exportTask;
      }

      if (job.status === 'error') {
        const errTask = job.tasks.find((t) => t.status === 'error');
        const msg = errTask?.message ?? 'unknown error';
        throw new Error(`[FFmpegMuxer] Cloudconvert job errored: ${msg}`);
      }

      logger.info('[FFmpegMuxer] Cloudconvert job still running', { jobId, attempt });
    } catch (err) {
      const kind = classifyError(err);
      recordFailure('ffmpeg', kind);
      throw err;
    }
  }

  throw new Error(`[FFmpegMuxer] Cloudconvert job ${jobId} timed out after ${POLL_MAX_ATTEMPTS} polls`);
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

// ── Public API ─────────────────────────────────────────────────────────────────

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
