/**
 * Enqueue Video Render Job Server Action
 *
 * Layer: land/video/queue-actions
 */

'use server';

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getD1 } from '@/seed/db/client';
import { getUserTier } from '@/seed/db/get-user-tier';
import { resolveOrgId } from '@/seed/auth/resolve-org-id';
import { enqueueJob } from '@/tree/queue/fair-share-gpu-scheduler';
import { logger } from '@/seed/utils/logger-utility';
import { resolveTierPriority } from './tier-priority';
import type {
  EnqueueVideoRenderJobInput,
  EnqueueVideoRenderJobResult,
} from './types';

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
    const { lane, priorityScore } = resolveTierPriority(tier);

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
