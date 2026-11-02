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
import type {
  CreateNicheVideoCampaignInput,
  NicheVideoCampaignPlan,
} from '@/tree/video/blueprints/niche-video-service';
import {
  validateAndBuildNichePlan,
  type CreateNicheVideoCampaignActionInput,
  type NicheVideoActionResponse,
  type ValidatedNicheVideoActionInput,
} from './niche-video-action-helpers';

export type { CreateNicheVideoCampaignActionInput, NicheVideoActionResponse } from './niche-video-action-helpers';

async function resolveDispatchContext(
  userId: string,
  niche: 'saas_global' | 'crypto_global',
  maxRenderCostCents: number | undefined,
): Promise<
  | { ok: true; db: D1Database | null; tenantId: string }
  | { ok: false; response: NicheVideoActionResponse<never> }
> {
  if (maxRenderCostCents !== undefined && maxRenderCostCents > PROPOSED_GATE1_VERTICAL_CAP_CENTS) {
    return {
      ok: false,
      response: {
        success: false,
        code: 'BUDGET_CAP_EXCEEDED',
        error: `Render budget (${maxRenderCostCents} cents) exceeds the proposed Gate 1 vertical ceiling of ${PROPOSED_GATE1_VERTICAL_CAP_CENTS} cents ($25.00)`,
      },
    };
  }
  const db = await getD1().catch(() => null);
  let orgId: string | null;
  try {
    orgId = await resolveOrgId(userId, db ?? createServerClient());
  } catch (err: unknown) {
    logger.error('resolveOrgId failed in dispatchNicheVideoCampaignAction', { error: toError(err).message });
    return {
      ok: false,
      response: {
        success: false,
        error: 'Workspace resolution failed due to database error',
        code: 'WORKSPACE_RESOLUTION_FAILED',
      },
    };
  }
  const tenantId = orgId ?? userId;
  const isAdmin = tenantId === userId || (db ? await hasWorkspaceRole(tenantId, userId, 'ADMIN', db) : false);
  if (!isAdmin) {
    return {
      ok: false,
      response: { success: false, error: 'Forbidden: Workspace Admin authorization required', code: 'FORBIDDEN' },
    };
  }
  if (db) {
    const budgetCheck = await evaluateCumulativePilotBudget(db, {
      tenantId,
      niche,
      requestedCostCents: maxRenderCostCents ?? DEFAULT_MAX_RENDER_COST_CENTS,
    });
    if (!budgetCheck.ok && budgetCheck.error.code === 'BUDGET_CAP_EXCEEDED') {
      return {
        ok: false,
        response: { success: false, code: 'BUDGET_CAP_EXCEEDED', error: budgetCheck.error.message },
      };
    }
  }
  return { ok: true, db, tenantId };
}

async function resolveOfferForDispatch(
  db: D1Database | null,
  tenantId: string,
  input: ValidatedNicheVideoActionInput,
  planInput: CreateNicheVideoCampaignInput,
): Promise<{ resolvedOfferId: string | undefined; termsVerified: boolean }> {
  let resolvedOfferId = input.offerId;
  let termsVerified = false;
  if (!db) return { resolvedOfferId, termsVerified };
  try {
    if (input.commissionTerms?.trim()) {
      const upserted = await upsertWorkspaceVerifiedOffer(db, {
        tenantId,
        offerId: input.offerId,
        networkId: input.networkId,
        programName: planInput.productName,
        productUrl: planInput.productUrl,
        commissionTerms: input.commissionTerms,
        niche: input.niche,
        jurisdiction: planInput.jurisdiction,
      });
      if (upserted.ok) resolvedOfferId = upserted.value.offerId;
    }
    if (resolvedOfferId) {
      const eligibility = await verifyOfferEligibility(db, {
        tenantId,
        offerId: resolvedOfferId,
        productUrl: planInput.productUrl,
        niche: input.niche,
        jurisdiction: planInput.jurisdiction,
      });
      termsVerified = eligibility.ok;
    }
  } catch (err) {
    logger.warn('dispatchNicheVideoCampaignAction: offer verification unavailable', {
      error: err instanceof Error ? err.message : String(err),
    });
  }
  return { resolvedOfferId, termsVerified };
}

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

    const ctx = await resolveDispatchContext(user.id, planInput.niche, input.maxRenderCostCents);
    if (!ctx.ok) return ctx.response;
    const { db, tenantId } = ctx;

    const { resolvedOfferId, termsVerified } = await resolveOfferForDispatch(db, tenantId, input, planInput);

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
