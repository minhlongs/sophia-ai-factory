/**
 * Error handling helper for campaign generation inngest function.
 * Layer: forest/inngest/functions/campaign
 * @module forest/inngest/functions/campaign/campaign-error-handler
 */

import { logger } from '@/seed/utils/logger-utility';
import { NonRetriableError } from 'inngest';

export interface CampaignErrorContext {
  campaignId: string;
  topic: string;
  updateCampaignStatus: (
    campaignId: string,
    status: 'failed',
    progress: number,
    data?: Record<string, unknown>,
  ) => Promise<unknown>;
  notifyUser: (message: string) => Promise<unknown>;
}

export async function handleCampaignFailure(
  err: unknown,
  ctx: CampaignErrorContext,
): Promise<never> {
  const errorMessage = err instanceof Error ? err.message : String(err);
  await ctx.updateCampaignStatus(ctx.campaignId, 'failed', 0, { error_message: errorMessage });
  await ctx.notifyUser(
    `❌ **Campaign Failed**\nYour campaign for "${ctx.topic}" encountered an error:\n${errorMessage}`,
  ).catch((catchErr) => {
    logger.warn('Failed to notify user of campaign failure in outer catch', {
      error: String(catchErr),
      context: 'generateCampaign',
      campaignId: ctx.campaignId,
    });
  });
  throw new NonRetriableError(`Campaign generation failed: ${errorMessage}`, { cause: err });
}
