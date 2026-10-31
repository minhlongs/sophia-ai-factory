/**
 * Approve → continuation sender for CEO campaign approvals.
 *
 * Rebuilds the gate continuation event from the server-persisted dispatch
 * context (never from client input), re-verifies offer terms server-side, and
 * sends `niche.video.campaign.requested` with the approval binding. Only the
 * winner of the approve-CAS may call this; the consumer is idempotent on the
 * deterministic idempotency key, so a retried send replays instead of double-spending.
 *
 * Layer: tree/affiliate/approval
 * @module tree/affiliate/approval/approval-continuation
 */

import { inngest } from '@/seed/inngest/client';
import { logger } from '@/seed/utils/logger-utility';
import {
  type ApprovalDispatchContext,
  type StoredCampaignApproval,
} from '@/tree/affiliate/approval/campaign-approval-repo';
import { verifyOfferEligibility } from '@/tree/affiliate/offers/offer-eligibility';

export type ContinuationErrorCode =
  | 'DISPATCH_CONTEXT_MISSING'
  | 'DISPATCH_CONTEXT_INVALID'
  | 'TERMS_UNVERIFIED'
  | 'CONTINUATION_SEND_FAILED';

export type ContinuationResult =
  | { ok: true }
  | { ok: false; code: ContinuationErrorCode; message: string };

function parseDispatch(approval: StoredCampaignApproval): ApprovalDispatchContext | null {
  if (!approval.dispatchJson) return null;
  try {
    const parsed = JSON.parse(approval.dispatchJson) as Partial<ApprovalDispatchContext>;
    if (
      typeof parsed.userId !== 'string' ||
      typeof parsed.blueprintId !== 'string' ||
      typeof parsed.productName !== 'string' ||
      typeof parsed.productUrl !== 'string' ||
      (parsed.niche !== 'saas_global' &&
        parsed.niche !== 'crypto_global' &&
        parsed.niche !== 'ecommerce_vn')
    ) {
      return null;
    }
    return parsed as ApprovalDispatchContext;
  } catch {
    return null;
  }
}

export async function sendApprovalContinuation(
  db: D1Database,
  tenantId: string,
  approval: StoredCampaignApproval,
): Promise<ContinuationResult> {
  const dispatch = parseDispatch(approval);
  if (!dispatch) {
    return {
      ok: false,
      code: approval.dispatchJson ? 'DISPATCH_CONTEXT_INVALID' : 'DISPATCH_CONTEXT_MISSING',
      message: approval.dispatchJson
        ? `Approval ${approval.id} has a corrupt dispatch context and cannot continue`
        : `Approval ${approval.id} predates persisted dispatch context and cannot continue automatically`,
    };
  }

  // Pre-send re-verification: the gate requires termsVerified=true, and that
  // flag must be earned fresh — never copied from the original dispatch.
  if (
    !dispatch.offerId ||
    (dispatch.niche !== 'saas_global' && dispatch.niche !== 'crypto_global')
  ) {
    return {
      ok: false,
      code: 'TERMS_UNVERIFIED',
      message: dispatch.offerId
        ? `Niche ${dispatch.niche} is not served by the video dispatcher`
        : `Approval ${approval.id} has no bound offer; terms cannot be verified`,
    };
  }
  const eligibility = await verifyOfferEligibility(db, {
    tenantId,
    offerId: dispatch.offerId,
    productUrl: dispatch.productUrl,
    niche: dispatch.niche,
    jurisdiction: dispatch.jurisdiction,
  });
  if (!eligibility.ok) {
    logger.info('[campaign-approvals] Continuation blocked: offer terms unverified', {
      approvalId: approval.id,
      reason: eligibility.error,
    });
    return {
      ok: false,
      code: 'TERMS_UNVERIFIED',
      message: `Offer terms could not be re-verified (${eligibility.error})`,
    };
  }

  try {
    await inngest.send({
      name: 'niche.video.campaign.requested',
      data: {
        userId: dispatch.userId,
        tenantId,
        offerId: dispatch.offerId,
        termsVerified: true,
        approvalId: approval.id,
        approvalHash: approval.approvalPayloadHash,
        ...(dispatch.targetAccount ? { targetAccount: dispatch.targetAccount } : {}),
        ...(dispatch.maxRenderCostCents !== undefined
          ? { maxRenderCostCents: dispatch.maxRenderCostCents }
          : {}),
        idempotencyKey: dispatch.idempotencyKey ?? `${tenantId}:${approval.campaignId}`,
        niche: dispatch.niche,
        blueprintId: dispatch.blueprintId,
        productName: dispatch.productName,
        productUrl: dispatch.productUrl,
        targetAudience: dispatch.targetAudience,
        jurisdiction: dispatch.jurisdiction,
        affiliateCode: dispatch.affiliateCode,
        subId: dispatch.subId ?? null,
        vanityCoupon: dispatch.vanityCoupon ?? null,
        locale: dispatch.locale,
      },
    });
  } catch (err) {
    logger.error('[campaign-approvals] Continuation send failed', {
      approvalId: approval.id,
      error: err instanceof Error ? err.message : String(err),
    });
    return {
      ok: false,
      code: 'CONTINUATION_SEND_FAILED',
      message: 'Approval recorded but the continuation event could not be sent; use Resume to retry',
    };
  }

  logger.info('[campaign-approvals] Continuation sent', {
    approvalId: approval.id,
    tenantId,
  });
  return { ok: true };
}
