/**
 * Video Job Pipeline — entry helpers
 *
 * Provides createVideoJob() used by POST /api/videos/generate.
 * Inserts a video_jobs row and fires the initial Inngest event.
 */

import { getD1Client } from '@/seed/db/client';
import { inngest } from '@/forest/inngest/client';
import { logger } from '@/seed/utils/logger-utility';
import { checkVideoBudget, type RenderPath } from './cost-guardrail';

export interface CreateVideoJobInput {
  tenantId: string;
  userId: string;
  prompt: string;
  tier: string;
  /**
   * Render path to budget against. Defaults to 'path-a' (cheaper) so callers
   * who don't yet declare the path get a reasonable lower-bound check.
   */
  path?: RenderPath;
}

export interface CreateVideoJobResult {
  jobId: string;
  status: 'queued';
}

/** Thrown when a user lacks credits for the requested render path. */
export class InsufficientCreditsError extends Error {
  constructor(
    public readonly estimatedCredits: number,
    public readonly creditsRemaining: number,
    message: string,
  ) {
    super(message);
    this.name = 'InsufficientCreditsError';
  }
}

/**
 * Insert video_jobs row + fire video.requested Inngest event.
 * Returns { jobId, status: 'queued' }.
 */
export async function createVideoJob(
  input: CreateVideoJobInput,
): Promise<CreateVideoJobResult> {
  const { tenantId, userId, prompt, tier, path = 'path-a' } = input;

  // Cost guardrail: deny BEFORE any upstream call (HeyGen, fly, etc.)
  // so we never bill an unfunded user. Soft-fail balance lookup → deny.
  const budget = await checkVideoBudget(userId, path);
  if (!budget.allowed) {
    logger.warn('[VideoJobPipeline] Job rejected — insufficient credits', {
      userId, path, creditsRemaining: budget.creditsRemaining,
    });
    throw new InsufficientCreditsError(
      budget.estimatedCredits,
      budget.creditsRemaining,
      budget.hint ?? 'Insufficient credits.',
    );
  }

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
