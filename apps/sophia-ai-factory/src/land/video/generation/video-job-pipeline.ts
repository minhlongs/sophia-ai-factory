/**
 * Video Job Pipeline — entry helpers
 *
 * Provides createVideoJob() used by POST /api/videos/generate.
 * Inserts a video_jobs row and fires the initial Inngest event.
 */

import { createServerClient, getD1 } from '@/seed/db/client';
import { inngest } from '@/seed/inngest/client';
import { logger } from '@/seed/utils/logger-utility';
import type { CampaignApprovalPayload } from '@/seed/security/approval-payload-hash';
import { getAffiliateKillSwitchState } from '@/tree/affiliate/kill-switch/kill-switch-store';
import { verifyAndEnforceCampaignApprovalD1 } from '@/tree/affiliate/approval/campaign-approval-repo';
import { checkVideoBudget, type RenderPath } from '../templates/cost-guardrail';

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
  /**
   * Optional affiliate campaign ID. When provided, or when requireCeoApproval
   * is true, this job enforces CEO approval integrity before queuing.
   */
  campaignId?: string;
  approvalPayload?: CampaignApprovalPayload;
  requireCeoApproval?: boolean;
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

/** Thrown when a campaign video job lacks CEO approval or has an invalid/mutated payload. */
export class CampaignApprovalRequiredError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'CampaignApprovalRequiredError';
  }
}

/**
 * Insert video_jobs row + fire video.requested Inngest event.
 * Returns { jobId, status: 'queued' }.
 */
export async function createVideoJob(
  input: CreateVideoJobInput,
): Promise<CreateVideoJobResult> {
  const { tenantId, userId, prompt, tier, path = 'path-a', campaignId, approvalPayload, requireCeoApproval } = input;

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

  // Zero-bypass render guard: any affiliate-tagged job must carry a valid,
  // unmutated CEO approval before it can be queued (fail-closed).
  if (campaignId || requireCeoApproval) {
    if (!campaignId) {
      throw new CampaignApprovalRequiredError(
        'APPROVAL_CAMPAIGN_ID_REQUIRED',
        'campaignId is required when requireCeoApproval is set.',
      );
    }
    if (!approvalPayload) {
      throw new CampaignApprovalRequiredError(
        'APPROVAL_PAYLOAD_REQUIRED',
        'An explicit approval payload (script, link, jurisdiction, disclosure, account, budget) is required for campaign renders.',
      );
    }

    const d1 = await getD1();
    if (!d1) {
      throw new CampaignApprovalRequiredError(
        'PERSIST_FAILED',
        'D1 database binding not available for approval verification.',
      );
    }

    const killState = await getAffiliateKillSwitchState(tenantId);
    const killSwitchActive = killState.active || !killState.known;

    const verification = await verifyAndEnforceCampaignApprovalD1(
      d1,
      tenantId,
      campaignId,
      approvalPayload,
      killSwitchActive,
    );
    if (!verification.ok) {
      throw new CampaignApprovalRequiredError(
        verification.error.code,
        verification.error.message,
      );
    }
  }

  const jobId = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);

  const db = createServerClient();

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
