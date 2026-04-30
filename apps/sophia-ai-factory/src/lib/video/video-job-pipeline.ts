/**
 * Video Job Pipeline — entry helpers
 *
 * Provides createVideoJob() used by POST /api/videos/generate.
 * Inserts a video_jobs row and fires the initial Inngest event.
 */

import { getD1Client } from '@/lib/db/client';
import { inngest } from '@/lib/inngest/client';
import { logger } from '@/lib/utils/logger-utility';

export interface CreateVideoJobInput {
  tenantId: string;
  userId: string;
  prompt: string;
  tier: string;
}

export interface CreateVideoJobResult {
  jobId: string;
  status: 'queued';
}

/**
 * Insert video_jobs row + fire video.requested Inngest event.
 * Returns { jobId, status: 'queued' }.
 */
export async function createVideoJob(
  input: CreateVideoJobInput,
): Promise<CreateVideoJobResult> {
  const { tenantId, userId, prompt, tier } = input;
  const jobId = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);

  const db = await getD1Client();

  await db.from('video_jobs').insert({
    id: jobId,
    tenant_id: tenantId,
    user_id: userId,
    status: 'queued',
    prompt,
    tier,
    cost_usd: 0,
    created_at: now,
    updated_at: now,
  });

  // Fire Inngest event — non-fatal if Inngest not configured (local dev)
  try {
    await inngest.send({
      name: 'video.requested',
      data: { jobId, tenantId, userId },
    });
  } catch (err) {
    logger.warn('[VideoJobPipeline] Inngest send failed (non-fatal)', { jobId, error: String(err) });
  }

  logger.info('[VideoJobPipeline] Video job created', { jobId, tenantId, userId, tier });

  return { jobId, status: 'queued' };
}
