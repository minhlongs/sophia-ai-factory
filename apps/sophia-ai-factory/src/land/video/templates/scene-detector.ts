/**
 * Scene Detector — generates FFmpeg scdet filter config for scene boundary detection.
 * Actual execution happens via the MoviePy Fly service; this module produces the config.
 */

import { logger } from '@/seed/utils/logger-utility';
import { shouldAllowRequest, recordSuccess, recordFailure } from '@/seed/security/circuit-breaker';
import { classifyError } from '@/seed/types/failure-kind';

export interface SceneBoundary {
  /** Timestamp of scene transition in milliseconds */
  timestamp_ms: number;
}

export interface SceneDetectConfig {
  videoUrl: string;
  /** FFmpeg scdet threshold (0-100, lower = more sensitive) */
  threshold: number;
  /** FFmpeg filter graph string */
  filterGraph: string;
}

/**
 * Build the FFmpeg scene detection filter configuration.
 * The Fly MoviePy service will execute this config against the video URL.
 */
export function buildSceneDetectConfig(
  videoUrl: string,
  threshold = 40,
): SceneDetectConfig {
  return {
    videoUrl,
    threshold,
    filterGraph: `select='gt(scene,${threshold / 100})',showinfo`,
  };
}

/**
 * Parse scene detection output from the MoviePy Fly service response.
 * The service returns newline-delimited timestamps in milliseconds.
 */
export function parseSceneDetectOutput(rawOutput: string): SceneBoundary[] {
  const boundaries: SceneBoundary[] = [{ timestamp_ms: 0 }]; // always include start

  for (const line of rawOutput.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const ms = parseInt(trimmed, 10);
    if (!isNaN(ms) && ms > 0) {
      boundaries.push({ timestamp_ms: ms });
    }
  }

  return boundaries.sort((a, b) => a.timestamp_ms - b.timestamp_ms);
}

/**
 * Detect scenes from a video URL via the MoviePy Fly service.
 * Falls back to empty array (no scene cuts) on error.
 */
export async function detectScenes(videoUrl: string): Promise<SceneBoundary[]> {
  const flyServiceUrl = process.env.MOVIEPY_SERVICE_URL;

  if (!flyServiceUrl) {
    logger.warn('[scene-detector] MOVIEPY_SERVICE_URL not set — returning empty scene list');
    return [];
  }

  const config = buildSceneDetectConfig(videoUrl);

  if (!shouldAllowRequest('openai')) {
    logger.warn('[scene-detector] Circuit breaker open for openai — too many failures');
    return [];
  }

  try {
    const response = await fetch(`${flyServiceUrl}/scene-detect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoUrl: config.videoUrl, threshold: config.threshold }),
    });

    if (!response.ok) {
      logger.warn('[scene-detector] Fly service error', { status: response.status });
      return [];
    }

    recordSuccess('openai');
    const data = (await response.json()) as { timestamps: string };
    return parseSceneDetectOutput(data.timestamps ?? '');
  } catch (err) {
    const kind = classifyError(err);
    recordFailure('openai', kind);
    logger.error('[scene-detector] Failed to detect scenes', { videoUrl, err });
    return [];
  }
}
