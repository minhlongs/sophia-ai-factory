import { NonRetriableError } from 'inngest';
import { logger } from '@/seed/utils/logger-utility';
import { createServerClient } from '@/seed/db/client';
import { Tier, TIER_RANK } from '@/seed/types';
import { resolveUserTier } from '@/seed/db/resolve-user-tier';
import type { RunCampaignWorkflowArgs } from './types';

export { finalizeCampaignStep } from './campaign-orchestrator-finalize';

export async function isCampaignAlreadyProcessed(
  campaignId: string,
  resume?: boolean,
): Promise<boolean> {
  if (resume) return false;
  const idempotencyDb = createServerClient();
  const { data: existingCampaign } = (await idempotencyDb
    .from('campaigns')
    .select('id, status')
    .eq('id', campaignId)
    .single()) as { data: { id: string; status: string } | null };

  if (
    existingCampaign &&
    ['processing_script', 'processing_video', 'completed'].includes(existingCampaign.status)
  ) {
    logger.info('[generateCampaign] Campaign already processed — skipping', {
      campaignId,
      status: existingCampaign.status,
    });
    return true;
  }
  return false;
}

export async function assertMidFlightTierNotDowngraded(
  step: RunCampaignWorkflowArgs['step'],
  campaignId: string,
  userId: string,
  tier: Tier,
  updateStatus: RunCampaignWorkflowArgs['updateStatus'],
): Promise<void> {
  const currentTier = (await step.run('validate-tier-mid-flight', async () => {
    return resolveUserTier(userId);
  })) as Tier;

  const eventTierRank = TIER_RANK[tier] ?? 0;
  const currentTierRank = TIER_RANK[currentTier] ?? 0;
  if (currentTierRank < eventTierRank) {
    logger.warn('[generateCampaign] Tier downgrade mid-flight — aborting distribution', {
      campaignId,
      userId,
      eventTier: tier,
      currentTier,
    });
    await updateStatus('failed', 0, {
      error_message: `Tier downgraded mid-flight from ${tier} to ${currentTier}. Campaign aborted.`,
    }).catch((err) => {
      logger.warn('Failed to update status after tier downgrade', {
        error: String(err),
        context: 'runCampaignWorkflow',
      });
    });
    throw new NonRetriableError(
      `Tier downgrade mid-flight: ${tier} → ${currentTier}. Please re-run with an active tier.`,
    );
  }
}

export async function resolveAbCampaignTitle(
  step: RunCampaignWorkflowArgs['step'],
  campaignId: string,
  topic: string,
  abExperimentId?: string,
): Promise<string> {
  return (await step.run('resolve-ab-title', async () => {
    if (!abExperimentId) return topic || `Campaign ${campaignId}`;
    try {
      const db = createServerClient();
      const { data: expData } = await db
        .from('ab_experiments')
        .select('variant_a_caption')
        .eq('id', abExperimentId)
        .maybeSingle();
      if (expData?.variant_a_caption) return expData.variant_a_caption;
    } catch (err) {
      logger.warn('[runCampaignWorkflow] AB experiment lookup failed — using original title', {
        campaignId,
        abExperimentId,
        error: String(err),
      });
    }
    return topic || `Campaign ${campaignId}`;
  })) as string;
}
