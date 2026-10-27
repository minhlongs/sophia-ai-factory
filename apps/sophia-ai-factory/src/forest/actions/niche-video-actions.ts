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
import { resolveOrgId } from '@/seed/auth/resolve-org-id';
import { createServerClient, getD1 } from '@/seed/db/client';
import { inngest } from '@/seed/inngest/client';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import { verifyOfferEligibility } from '@/tree/affiliate/offers/offer-eligibility';
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

    const { planInput, input, plan } = built;

    // Tenant is resolved on the server, never accepted from the client.
    let tenantId = user.id;
    try {
      const orgId = await resolveOrgId(user.id, createServerClient());
      if (orgId) tenantId = orgId;
    } catch {
      // Fall back to the user-scoped workspace; the job still fails closed if
      // no tenant can be established.
    }

    // Offer identity / terms / jurisdiction are verified server-side. A missing
    // or unknown offer is dispatched as an unverified draft (no spend).
    let termsVerified = false;
    if (input.offerId) {
      try {
        const eligibility = await verifyOfferEligibility(await getD1(), {
          tenantId,
          offerId: input.offerId,
          productUrl: planInput.productUrl,
          niche: input.niche,
          jurisdiction: planInput.jurisdiction,
        });
        termsVerified = eligibility.ok;
        if (!eligibility.ok) {
          logger.info('dispatchNicheVideoCampaignAction: offer not verified; staging draft', {
            offerId: input.offerId,
            reason: eligibility.error,
          });
        }
      } catch (err) {
        logger.warn('dispatchNicheVideoCampaignAction: offer verification unavailable', {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    await inngest.send({
      name: 'niche.video.campaign.requested',
      data: {
        userId: user.id,
        tenantId,
        offerId: input.offerId,
        termsVerified,
        ...(input.targetAccount ? { targetAccount: input.targetAccount } : {}),
        ...(input.maxRenderCostCents !== undefined
          ? { maxRenderCostCents: input.maxRenderCostCents }
          : {}),
        idempotencyKey: `${tenantId}:${plan.planId}`,
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
