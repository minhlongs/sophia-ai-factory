/**
 * Video Render Queue Status, Cancel & Lease Server Actions
 *
 * Layer: land/video/queue-actions
 */

'use server';

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getD1 } from '@/seed/db/client';
import { resolveOrgId } from '@/seed/auth/resolve-org-id';
import type { QueueLane } from '@/seed/types/video-render-queue';
import {
  leaseNextJob,
  getJobById,
  cancelJob,
  getQueueMetrics,
} from '@/tree/queue/fair-share-gpu-scheduler';
import { logger } from '@/seed/utils/logger-utility';
import type {
  GetQueueStatusResult,
  CancelVideoJobResult,
  LeaseNextJobResult,
} from './types';

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
