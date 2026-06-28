/**
 * Video Status Service
 *
 * Handles video job status polling and progress tracking.
 * Queries engine_missions table for current job state.
 *
 * @module land/video/video-status-service
 */

import { logger } from '@/seed/utils/logger-utility';
import { createServerClient } from '@/seed/db/client';
import type { VideoJobStatus } from '../generation/video-job-fsm';

// ─── Public Types ───────────────────────────────────────────────────────────────

export type VideoStatusResult = {
  jobId: string;
  status: VideoJobStatus;
  progress: number;
  videoUrl?: string;
  error?: string;
  updatedAt: number;
};

// ─── Video Status Polling ───────────────────────────────────────────────────────

/**
 * Get current status of a video job from engine_missions
 */
export async function getVideoStatus(
  jobId: string,
  userId?: string,
): Promise<VideoStatusResult | null> {
  try {
    const db = createServerClient();

    const { data: mission, error } = await db
      .from('engine_missions')
      .select('id, status, result, error_message, updated_at')
      .eq('id', jobId)
      .single();

    if (error || !mission) {
      return null;
    }

    const missionData = mission as Record<string, unknown>;

    // If user provided, verify ownership
    if (userId && missionData.user_id !== userId) {
      return null;
    }

    const status = missionData.status as VideoJobStatus;
    const progress = getProgressForStatus(status);
    const result = missionData.result as string | undefined;
    const errorMessage = missionData.error_message as string | undefined;
    const updatedAt = (missionData.updated_at as number) || Math.floor(Date.now() / 1000);

    return {
      jobId: missionData.id as string,
      status,
      progress,
      videoUrl: result ? JSON.parse(result).video_url : undefined,
      error: errorMessage,
      updatedAt,
    };
  } catch (err) {
    logger.error('[VideoStatusService] getVideoStatus failed', { jobId, error: err });
    return null;
  }
}

/**
 * Maps video job status to progress percentage (0-100).
 * Used by polling endpoints and UI progress bars.
 */
export function getProgressForStatus(status: VideoJobStatus): number {
  const progressMap: Record<string, number> = {
    queued: 0,
    scripting: 15,
    tts_pending: 30,
    visual_pending: 50,
    composing: 70,
    uploaded: 85,
    published: 100,
    failed: 0,
  };
  return progressMap[status] ?? 0;
}
