/**
 * Server Actions for Distributed Video Render Jobs Queue
 * Types Definitions
 *
 * Layer: land/video/queue-actions
 */

import type {
  VideoRenderJob,
  QueueMetrics,
  LeaseJobResult,
  QueueLane,
  GpuProvider,
} from '@/seed/types/video-render-queue';

export interface EnqueueVideoRenderJobInput {
  payload: Record<string, unknown> | string;
  subaccountId?: string | null;
  preferredProvider?: GpuProvider;
  orgIdOverride?: string;
}

export interface EnqueueVideoRenderJobResult {
  success: boolean;
  job?: VideoRenderJob;
  error?: string;
}

export interface GetQueueStatusResult {
  success: boolean;
  metrics?: QueueMetrics;
  job?: VideoRenderJob;
  error?: string;
}

export interface CancelVideoJobResult {
  success: boolean;
  error?: string;
}

export interface LeaseNextJobResult {
  success: boolean;
  result?: LeaseJobResult;
  error?: string;
}

export interface VideoTierPriority {
  lane: QueueLane;
  priorityScore: number;
}
