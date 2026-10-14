/**
 * Video Render Queue Entities & Mappers
 * Layer: seed/types/video-render-queue
 */

import type { GpuProvider, JobStatus, QueueLane } from './enums';

/**
 * Raw SQLite/D1 database row representation
 */
export interface VideoRenderRow {
  id: string;
  org_id: string;
  subaccount_id: string | null;
  lane: QueueLane;
  priority_score: number;
  status: JobStatus;
  tier: string;
  payload: string;
  result_url: string | null;
  error_message: string | null;
  retry_count: number;
  max_retries: number;
  leased_by: string | null;
  leased_until: number | null;
  provider: GpuProvider | null;
  dlq_reason: string | null;
  created_at: number;
  updated_at: number;
}

/**
 * Parsed domain entity representation
 */
export interface VideoRenderJob {
  id: string;
  orgId: string;
  subaccountId?: string | null;
  lane: QueueLane;
  priorityScore: number;
  status: JobStatus;
  tier: string;
  payload: Record<string, unknown> | string;
  resultUrl?: string | null;
  errorMessage?: string | null;
  retryCount: number;
  maxRetries: number;
  leasedBy?: string | null;
  leasedUntil?: number | null;
  provider?: GpuProvider | null;
  dlqReason?: string | null;
  createdAt: number;
  updatedAt: number;
}

/**
 * Input parameters for enqueuing a new render job
 */
export interface EnqueueJobInput {
  id?: string;
  orgId: string;
  subaccountId?: string | null;
  tier: string;
  payload: Record<string, unknown> | string;
  lane?: QueueLane;
  priorityScore?: number;
  maxRetries?: number;
  preferredProvider?: GpuProvider;
}

/**
 * Safely parses raw string payload into Record or returns raw string
 */
export function parseJobPayload(raw: string): Record<string, unknown> | string {
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      return parsed as Record<string, unknown>;
    }
    return raw;
  } catch {
    return raw;
  }
}

/**
 * Maps a database row to a typed VideoRenderJob entity
 */
export function mapRowToJob(row: VideoRenderRow): VideoRenderJob {
  return {
    id: row.id,
    orgId: row.org_id,
    subaccountId: row.subaccount_id,
    lane: row.lane,
    priorityScore: row.priority_score,
    status: row.status,
    tier: row.tier,
    payload: parseJobPayload(row.payload),
    resultUrl: row.result_url,
    errorMessage: row.error_message,
    retryCount: row.retry_count,
    maxRetries: row.max_retries,
    leasedBy: row.leased_by,
    leasedUntil: row.leased_until,
    provider: row.provider,
    dlqReason: row.dlq_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
