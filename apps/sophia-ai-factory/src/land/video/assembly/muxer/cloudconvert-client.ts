/**
 * Cloudconvert REST API client for submitting and polling conversion jobs.
 * @module land/video/assembly/muxer/cloudconvert-client
 */

import { logger } from '@/seed/utils/logger-utility';
import { shouldAllowRequest, recordSuccess, recordFailure } from '@/seed/security/circuit-breaker';
import { classifyError } from '@/seed/types/failure-kind';
import {
  CLOUDCONVERT_API,
  POLL_INTERVAL_MS,
  POLL_MAX_ATTEMPTS,
  type CloudconvertJobBody,
  type CloudconvertJobResponse,
  type CloudconvertTaskResult,
} from './types';

/** Submit a Cloudconvert job with import-video → import-audio → mux-ffmpeg → export tasks. */
export async function submitCloudconvertJob(
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
export async function pollCloudconvertJob(
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
