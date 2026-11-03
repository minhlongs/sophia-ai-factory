/**
 * Validation schema, types, shared plan builder, and synchronous $0.00 CEO
 * approval draft staging for Niche Video Server Actions.
 *
 * Layer: forest (Server Actions helpers)
 * @module forest/actions/niche-video-action-helpers
 */

import { z } from 'zod';
import { DEFAULT_MAX_RENDER_COST_CENTS } from '@/seed/config/affiliate-budget-defaults';
import { logger } from '@/seed/utils/logger-utility';
import {
  createCampaignApproval,
  type ApprovalDispatchContext,
} from '@/tree/affiliate/approval/campaign-approval-repo';
import {
  createNicheVideoCampaignPlan,
  type CreateNicheVideoCampaignInput,
  type NicheVideoCampaignPlan,
} from '@/tree/video/blueprints/niche-video-service';
import { synthesizeNicheScript } from '@/tree/video/render/niche-script-synthesizer';

export const createNicheVideoCampaignSchema = z.object({
  niche: z.enum(['saas_global', 'crypto_global']),
  blueprintId: z.string().min(1, 'Blueprint ID is required'),
  productName: z.string().min(1, 'Product name is required'),
  productUrl: z.string().url('Must be a valid product URL'),
  targetAudience: z.string().optional(),
  jurisdiction: z.string().optional().default('GLOBAL'),
  affiliateCode: z.string().optional().default('sophia_partner'),
  subId: z.string().nullable().optional(),
  vanityCoupon: z.string().nullable().optional(),
  locale: z.enum(['en', 'vi']).optional().default('en'),
  /** Id of the persisted offer this campaign promotes. Verification is server-side. */
  offerId: z.string().min(1).optional(),
  /** Sourced commission terms for self-serve workspace offer registration. */
  commissionTerms: z.string().min(1).max(300).optional(),
  /** Affiliate network slug (e.g. 'direct', 'partnerstack', 'impact'). */
  networkId: z.string().min(1).max(64).optional(),
  /** Approved channel/account id; bound into the approval payload hash. */
  targetAccount: z.string().min(1).optional(),
  /** Approved render budget cap in cents; the server clamps this to the tier cap. */
  maxRenderCostCents: z.number().int().min(0).max(5000).optional(),
});

export type CreateNicheVideoCampaignActionInput = z.input<typeof createNicheVideoCampaignSchema>;
export type ValidatedNicheVideoActionInput = z.output<typeof createNicheVideoCampaignSchema>;

export interface NicheVideoActionResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

export function validateAndBuildNichePlan(
  rawInput: CreateNicheVideoCampaignActionInput,
):
  | {
      ok: true;
      planInput: CreateNicheVideoCampaignInput;
      input: ValidatedNicheVideoActionInput;
      plan: NicheVideoCampaignPlan;
    }
  | { ok: false; response: NicheVideoActionResponse<never> } {
  const parsed = createNicheVideoCampaignSchema.safeParse(rawInput);
  if (!parsed.success) {
    const issue = parsed.error.issues[0]?.message ?? 'Invalid input data';
    return {
      ok: false,
      response: { success: false, error: issue, code: 'VALIDATION_ERROR' },
    };
  }

  const planInput = parsed.data as CreateNicheVideoCampaignInput;
  const planResult = createNicheVideoCampaignPlan(planInput);
  if (!planResult.ok) {
    return {
      ok: false,
      response: {
        success: false,
        error: planResult.error.message,
        code: planResult.error.code,
      },
    };
  }

  return { ok: true, planInput, input: parsed.data, plan: planResult.value };
}

/**
 * Synchronously stages a `pending_ceo` row in `agent_campaign_approvals` ($0.00)
 * when D1 is available, so the CEO Campaign Approval Queue displays the draft
 * immediately after `dispatchNicheVideoCampaignAction` returns.
 */
export async function stagePendingApprovalOnDispatch(params: {
  db: D1Database | null;
  userId: string;
  tenantId: string;
  resolvedOfferId: string | undefined;
  input: ValidatedNicheVideoActionInput;
  planInput: CreateNicheVideoCampaignInput;
  plan: NicheVideoCampaignPlan;
}): Promise<string | undefined> {
  const { db, userId, tenantId, resolvedOfferId, input, planInput, plan } = params;
  if (!db) return undefined;

  const script = synthesizeNicheScript(plan, planInput.locale);
  const approvalPayload = {
    scriptBody: script.fullNarration,
    affiliateTargetUrl: plan.trackedUrl || planInput.productUrl,
    jurisdiction: plan.compliance.jurisdiction || planInput.jurisdiction || 'UNKNOWN',
    disclosureText: plan.compliance.regulatoryRef || '#ad',
    maxRenderCostCents: input.maxRenderCostCents ?? DEFAULT_MAX_RENDER_COST_CENTS,
    ...(input.targetAccount ? { targetAccount: input.targetAccount } : {}),
  };
  const dispatch: ApprovalDispatchContext = {
    userId,
    offerId: resolvedOfferId,
    maxRenderCostCents: input.maxRenderCostCents,
    targetAccount: input.targetAccount,
    idempotencyKey: `${tenantId}:${plan.planId}`,
    niche: planInput.niche,
    blueprintId: planInput.blueprintId,
    productName: planInput.productName,
    productUrl: planInput.productUrl,
    targetAudience: planInput.targetAudience,
    jurisdiction: planInput.jurisdiction,
    affiliateCode: planInput.affiliateCode,
    subId: planInput.subId ?? null,
    vanityCoupon: planInput.vanityCoupon ?? null,
    locale: planInput.locale,
  };

  try {
    const created = await createCampaignApproval(db, {
      tenantId,
      campaignId: plan.planId,
      niche: planInput.niche,
      jurisdiction: approvalPayload.jurisdiction,
      status: 'pending_ceo',
      payload: approvalPayload,
      dispatch,
    });
    if (created.ok) return created.value.id;
    logger.warn('stagePendingApprovalOnDispatch: approval row not persisted', {
      error: created.error.message,
    });
  } catch (err) {
    logger.warn('stagePendingApprovalOnDispatch: D1 approval insert unavailable', {
      error: err instanceof Error ? err.message : String(err),
    });
  }
  return undefined;
}
