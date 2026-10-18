/**
 * Server Actions for Niche Video Campaign Generation
 *
 * Validates requests with Zod, checks session authorization,
 * calculates storyboard plans, and dispatches background Inngest jobs.
 *
 * Layer: forest (Server Actions)
 * @module forest/actions/niche-video-actions
 */

'use server';

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { inngest } from '@/seed/inngest/client';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import type { NicheVideoCampaignPlan } from '@/tree/video/blueprints/niche-video-service';
import {
  validateAndBuildNichePlan,
  type CreateNicheVideoCampaignActionInput,
  type NicheVideoActionResponse,
} from './niche-video-action-helpers';

export type {
  CreateNicheVideoCampaignActionInput,
  NicheVideoActionResponse,
} from './niche-video-action-helpers';

export async function previewNicheVideoPlanAction(
  rawInput: CreateNicheVideoCampaignActionInput,
): Promise<NicheVideoActionResponse<NicheVideoCampaignPlan>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'Unauthorized: authentication required', code: 'UNAUTHORIZED' };
    }

    const built = validateAndBuildNichePlan(rawInput);
    if (!built.ok) {
      return built.response;
    }

    return {
      success: true,
      data: built.plan,
    };
  } catch (err: unknown) {
    const error = toError(err);
    logger.error('previewNicheVideoPlanAction failed', { error: error.message });
    return { success: false, error: error.message, code: 'INTERNAL_ERROR' };
  }
}

export async function dispatchNicheVideoCampaignAction(
  rawInput: CreateNicheVideoCampaignActionInput,
): Promise<NicheVideoActionResponse<{ planId: string; dispatched: boolean }>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'Unauthorized: authentication required', code: 'UNAUTHORIZED' };
    }

    const built = validateAndBuildNichePlan(rawInput);
    if (!built.ok) {
      return built.response;
    }

    const { planInput, plan } = built;

    await inngest.send({
      name: 'niche.video.campaign.requested',
      data: {
        userId: user.id,
        niche: planInput.niche,
        blueprintId: planInput.blueprintId,
        productName: planInput.productName,
        productUrl: planInput.productUrl,
        targetAudience: planInput.targetAudience,
        jurisdiction: planInput.jurisdiction,
        affiliateCode: planInput.affiliateCode,
        subId: planInput.subId,
        vanityCoupon: planInput.vanityCoupon,
        locale: planInput.locale,
      },
    });

    logger.info('dispatchNicheVideoCampaignAction: event sent to Inngest', {
      userId: user.id,
      planId: plan.planId,
      blueprintId: plan.blueprint.id,
    });

    return {
      success: true,
      data: {
        planId: plan.planId,
        dispatched: true,
      },
    };
  } catch (err: unknown) {
    const error = toError(err);
    logger.error('dispatchNicheVideoCampaignAction failed', { error: error.message });
    return { success: false, error: error.message, code: 'INTERNAL_ERROR' };
  }
}
