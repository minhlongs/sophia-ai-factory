/**
 * Shared types for the videos repository.
 *
 * @module seed/db/repositories/videos-repo-types
 */

export type VideoStatus =
  | 'queued'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'failed_permanent'

export interface VideoRow {
  id: string
  user_id: string
  purchase_id: string | null
  heygen_job_id: string | null
  title: string
  status: VideoStatus
  script: string | null
  locale: string | null
  provider: string
  attempt_count: number
  last_attempt_at: number | null
  last_error: string | null
  created_at: number
}

export interface EnqueueVideoInput {
  userId: string
  purchaseId: string
  title: string
  script: string
  locale: string
  provider?: string
  heygenJobId?: string
  videoId?: string
}

export interface InsertAiPromptVideoInput {
  /** Better-auth user.id */
  userId: string;
  /** engine_missions.id — used directly as videos.id for deterministic idempotency */
  missionId: string;
  /** R2 object key, e.g. "video-jobs/{missionId}/final.mp4" */
  r2Key: string;
  /** Public R2 URL (https://{R2_PUBLIC_HOSTNAME}/{r2Key}) */
  videoUrl: string;
  /** Optional display title; defaults to "AI Video" */
  title?: string;
}

export interface InsertAiPromptVideoResult {
  /** The videos.id (equals missionId). */
  videoId: string;
  /** True when the row already existed (Inngest retry path). */
  alreadyExisted: boolean;
}
