/**
 * Server Actions for Distributed Video Render Jobs Queue & Fair-Share GPU Scheduler
 *
 * Layer: land/video (Presentation & action gateway)
 *
 * Enforces:
 * - Authentication via getCurrentUser()
 * - Multi-tenant isolation via resolveOrgId()
 * - Subscription tier detection via getUserTier() (Enterprise/Master tiers get Priority Lane)
 *
 * @module land/video/video-render-queue-actions
 */

'use server';

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getD1 } from '@/seed/db/client';
import { getUserTier } from '@/seed/db/get-user-tier';
import { resolveOrgId } from '@/seed/auth/resolve-org-id';
import type {
  VideoRenderJob,
  QueueMetrics,
  LeaseJobResult,
  QueueLane,
  GpuProvider,
} from '@/seed/types/video-render-queue';
import {
  enqueueJob,
  leaseNextJob,
  getJobById,
  cancelJob,
  getQueueMetrics,
} from '@/tree/queue/fair-share-gpu-scheduler';
import { logger } from '@/seed/utils/logger-utility';

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

/**
 * Enqueue a new video render job into the batch queue with automatic tier detection and lane assignment
 */
export async function enqueueVideoRenderJobAction(
  input: EnqueueVideoRenderJobInput,
): Promise<EnqueueVideoRenderJobResult> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'unauthorized' };
    }

    const d1 = await getD1();
    if (!d1) {
      return { success: false, error: 'database_unavailable' };
    }

    // Resolve tenant organization with fallback to user.id
    const resolvedOrg = (await resolveOrgId(user.id, d1)) ?? user.id;
    const orgId = input.orgIdOverride || resolvedOrg;

    // Detect user's current subscription tier
    const tier = await getUserTier(user.id);
    const upperTier = tier.toUpperCase();

    // Assign priority lane & score based on subscription tier
    let lane: QueueLane = 'standard';
    let priorityScore = 10;

    if (upperTier === 'MASTER') {
      lane = 'priority';
      priorityScore = 200;
    } else if (upperTier === 'ENTERPRISE') {
      lane = 'priority';
      priorityScore = 100;
    } else if (upperTier === 'AGENCY') {
      lane = 'standard';
      priorityScore = 50;
    } else if (upperTier === 'PREMIUM' || upperTier === 'PRO') {
      lane = 'standard';
      priorityScore = 25;
    } else {
      lane = 'standard';
      priorityScore = 10;
    }

    const job = await enqueueJob(d1, {
      orgId,
      subaccountId: input.subaccountId,
      tier,
      lane,
      priorityScore,
      payload: input.payload,
      preferredProvider: input.preferredProvider,
    });

    logger.info('[video-queue-actions] enqueueVideoRenderJobAction success', {
      jobId: job.id,
      orgId,
      tier,
      lane,
      priorityScore,
    });

    return { success: true, job };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error('[video-queue-actions] enqueueVideoRenderJobAction failed', { error: msg });
    return { success: false, error: msg };
  }
}

/**
 * Get queue metrics or a specific job status with tenant isolation enforcement
 */
export async function getQueueStatusAction(
  jobId?: string,
): Promise<GetQueueStatusResult> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'unauthorized' };
    }

    const d1 = await getD1();
    if (!d1) {
      return { success: false, error: 'database_unavailable' };
    }

    const orgId = (await resolveOrgId(user.id, d1)) ?? user.id;

    if (jobId) {
      const job = await getJobById(d1, jobId, orgId);
      if (!job) {
        return { success: false, error: 'job_not_found' };
      }
      return { success: true, job };
    }

    const metrics = await getQueueMetrics(d1);
    return { success: true, metrics };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error('[video-queue-actions] getQueueStatusAction failed', { error: msg });
    return { success: false, error: msg };
  }
}

/**
 * Cancel a pending or leased video job belonging to the authenticated tenant organization
 */
export async function cancelVideoJobAction(
  jobId: string,
): Promise<CancelVideoJobResult> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'unauthorized' };
    }

    const d1 = await getD1();
    if (!d1) {
      return { success: false, error: 'database_unavailable' };
    }

    const orgId = (await resolveOrgId(user.id, d1)) ?? user.id;
    const cancelled = await cancelJob(d1, jobId, orgId);

    if (!cancelled) {
      return { success: false, error: 'job_not_cancellable_or_not_found' };
    }

    logger.info('[video-queue-actions] cancelVideoJobAction success', { jobId, orgId });
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error('[video-queue-actions] cancelVideoJobAction failed', { error: msg });
    return { success: false, error: msg };
  }
}

/**
 * Worker action: lease the next available job using fair-share arbitration
 */
export async function leaseNextJobAction(
  workerId: string,
  leaseDurationSeconds = 60,
  lanePreference?: QueueLane,
): Promise<LeaseNextJobResult> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'unauthorized' };
    }

    const d1 = await getD1();
    if (!d1) {
      return { success: false, error: 'database_unavailable' };
    }

    const result = await leaseNextJob(d1, workerId, leaseDurationSeconds, lanePreference);
    return { success: true, result };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error('[video-queue-actions] leaseNextJobAction failed', { error: msg });
    return { success: false, error: msg };
  }
}
