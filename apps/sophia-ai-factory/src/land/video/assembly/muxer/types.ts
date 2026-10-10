/**
 * Types and interfaces for Cloudconvert FFmpeg video muxing.
 * @module land/video/assembly/muxer/types
 */

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

export interface CloudconvertTask {
  operation: string;
  [key: string]: unknown;
}

export interface CloudconvertJobBody {
  tasks: Record<string, CloudconvertTask>;
}

export interface CloudconvertTaskResult {
  status: string;
  result?: {
    files?: Array<{ url: string; size?: number }>;
  };
  message?: string;
}

export interface CloudconvertJobResponse {
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

export const CLOUDCONVERT_API = 'https://api.cloudconvert.com/v2';
export const POLL_INTERVAL_MS = 3_000;
export const POLL_MAX_ATTEMPTS = 40; // 40 × 3s = 2 min max
