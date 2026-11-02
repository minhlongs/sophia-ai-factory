/**
 * Server Actions for Niche Video Campaign Generation
 *
 * Layer: forest (Server Actions)
 * @module forest/actions/niche-video-actions
 */

'use server';

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { resolveOrgId } from '@/seed/auth/resolve-org-id';
import { hasWorkspaceRole } from '@/seed/auth/workspace-access';
import {
  DEFAULT_MAX_RENDER_COST_CENTS,
  PROPOSED_GATE1_VERTICAL_CAP_CENTS,
} from '@/seed/config/affiliate-budget-defaults';
import { createServerClient, getD1 } from '@/seed/db/client';
import { inngest } from '@/seed/inngest/client';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import { evaluateCumulativePilotBudget } from '@/tree/affiliate/execution/execution-budget-ledger';
import { verifyOfferEligibility } from '@/tree/affiliate/offers/offer-eligibility';
import { upsertWorkspaceVerifiedOffer } from '@/tree/affiliate/offers/workspace-offer-upsert';
import type { NicheVideoCampaignPlan } from '@/tree/video/blueprints/niche-video-service';
import {
  validateAndBuildNichePlan,
  type CreateNicheVideoCampaignActionInput,
  type NicheVideoActionResponse,
} from './niche-video-action-helpers';

export type { CreateNicheVideoCampaignActionInput, NicheVideoActionResponse } from './niche-video-action-helpers';

export async function previewNicheVideoPlanAction(
  rawInput: CreateNicheVideoCampaignActionInput,
): Promise<NicheVideoActionResponse<NicheVideoCampaignPlan>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'Unauthorized: authentication required', code: 'UNAUTHORIZED' };
    }
    const built = validateAndBuildNichePlan(rawInput);
    if (!built.ok) return built.response;
    return { success: true, data: built.plan };
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
    if (!built.ok) return built.response;
    const { planInput, input, plan } = built;

    if (input.maxRenderCostCents !== undefined && input.maxRenderCostCents > PROPOSED_GATE1_VERTICAL_CAP_CENTS) {
      return {
        success: false, code: 'BUDGET_CAP_EXCEEDED',
        error: `Render budget (${input.maxRenderCostCents} cents) exceeds the proposed Gate 1 vertical ceiling of ${PROPOSED_GATE1_VERTICAL_CAP_CENTS} cents ($25.00)`,
      };
    }

    let db: D1Database | null = null;
    try {
      db = await getD1();
    } catch {
      db = null;
    }
    let tenantId = user.id;
    try {
      const orgId = await resolveOrgId(user.id, db ?? createServerClient());
      if (orgId) tenantId = orgId;
    } catch {
      // Fall back to user-scoped personal workspace
    }

    const isAdmin = tenantId === user.id || (db ? await hasWorkspaceRole(tenantId, user.id, 'ADMIN', db) : false);
    if (!isAdmin) {
      return { success: false, error: 'Forbidden: Workspace Admin authorization required', code: 'FORBIDDEN' };
    }

    if (db) {
      const requestedCostCents = input.maxRenderCostCents ?? DEFAULT_MAX_RENDER_COST_CENTS;
      const budgetCheck = await evaluateCumulativePilotBudget(db, {
        tenantId,
        niche: planInput.niche,
        requestedCostCents,
      });
      if (!budgetCheck.ok && budgetCheck.error.code === 'BUDGET_CAP_EXCEEDED') {
        return {
          success: false,
          code: 'BUDGET_CAP_EXCEEDED',
          error: budgetCheck.error.message,
        };
      }
    }

    let resolvedOfferId = input.offerId;
    let termsVerified = false;
    try {
      if (db && input.commissionTerms?.trim()) {
        const upserted = await upsertWorkspaceVerifiedOffer(db, {
          tenantId, offerId: input.offerId, networkId: input.networkId,
          programName: planInput.productName, productUrl: planInput.productUrl,
          commissionTerms: input.commissionTerms, niche: input.niche, jurisdiction: planInput.jurisdiction,
        });
        if (upserted.ok) resolvedOfferId = upserted.value.offerId;
      }
      if (db && resolvedOfferId) {
        const eligibility = await verifyOfferEligibility(db, {
          tenantId, offerId: resolvedOfferId, productUrl: planInput.productUrl,
          niche: input.niche, jurisdiction: planInput.jurisdiction,
        });
        termsVerified = eligibility.ok;
      }
    } catch (err) {
      logger.warn('dispatchNicheVideoCampaignAction: offer verification unavailable', {
        error: err instanceof Error ? err.message : String(err),
      });
    }

    await inngest.send({
      name: 'niche.video.campaign.requested',
      data: {
        userId: user.id, tenantId, offerId: resolvedOfferId, termsVerified,
        ...(input.targetAccount ? { targetAccount: input.targetAccount } : {}),
        ...(input.maxRenderCostCents !== undefined ? { maxRenderCostCents: input.maxRenderCostCents } : {}),
        idempotencyKey: `${tenantId}:${plan.planId}`,
        niche: planInput.niche, blueprintId: planInput.blueprintId,
        productName: planInput.productName, productUrl: planInput.productUrl,
        targetAudience: planInput.targetAudience, jurisdiction: planInput.jurisdiction,
        affiliateCode: planInput.affiliateCode, subId: planInput.subId,
        vanityCoupon: planInput.vanityCoupon, locale: planInput.locale,
      },
    });

    return { success: true, data: { planId: plan.planId, dispatched: true } };
  } catch (err: unknown) {
    const error = toError(err);
    logger.error('dispatchNicheVideoCampaignAction failed', { error: error.message });
    return { success: false, error: error.message, code: 'INTERNAL_ERROR' };
  }
}
