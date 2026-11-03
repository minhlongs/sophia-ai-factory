/**
 * Approval Payload, Step 2 Draft Persistence & Step 3 Side-Effect Gate
 * for the Niche Video Campaign Dispatcher.
 *
 * Layer: forest (reusable infrastructure orchestrator)
 * @module forest/inngest/functions/niche-video-dispatcher-approval-steps
 */

import {
  DEFAULT_MAX_RENDER_COST_CENTS,
  PROPOSED_GATE1_VERTICAL_CAP_CENTS,
} from '@/seed/config/affiliate-budget-defaults';
import { getD1 } from '@/seed/db/client';
import type { CampaignApprovalPayload } from '@/seed/security/approval-payload-hash';
import { logger } from '@/seed/utils/logger-utility';
import {
  createCampaignApproval,
  verifyAndEnforceCampaignApprovalD1,
  type ApprovalDispatchContext,
} from '@/tree/affiliate/approval/campaign-approval-repo';
import {
  evaluateRenderGate,
  type ExecutionEvidence,
} from '@/tree/affiliate/execution';
import { getAffiliateKillSwitchState } from '@/tree/affiliate/kill-switch/kill-switch-store';
import { sendCampaignApprovalNotification } from '@/tree/telegram/telegram-campaign-approval-handler';
import { getChatIdByUserId } from '@/tree/telegram/user-mappings-service';
import type { NicheVideoCampaignPlan } from '@/tree/video/blueprints/niche-video-service';

/** Extended event data. Only the server action or approval continuation may set identity/approval fields. */
export interface NicheVideoDispatchData {
  userId: string;
  tenantId?: string;
  offerId?: string;
  /** True only after the offer's terms/jurisdiction were verified server-side. */
  termsVerified?: boolean;
  approvalId?: string;
  /** Stored SHA-256 hash of the approved payload, read from D1 by the producer. */
  approvalHash?: string;
  /** Stable campaignId from the draft/approval when resuming or replaying. */
  campaignId?: string;
  maxRenderCostCents?: number;
  targetAccount?: string;
  idempotencyKey?: string;
  niche: 'saas_global' | 'crypto_global';
  blueprintId: string;
  productName: string;
  productUrl: string;
  targetAudience?: string;
  jurisdiction?: string;
  draftMode?: boolean;
  affiliateCode?: string;
  subId?: string | null;
  vanityCoupon?: string | null;
  locale?: 'en' | 'vi';
  requiresApproval?: boolean;
}

export function buildApprovalPayload(
  data: NicheVideoDispatchData,
  plan: NicheVideoCampaignPlan,
  scriptBody: string,
): CampaignApprovalPayload {
  return {
    scriptBody,
    affiliateTargetUrl: plan.trackedUrl || data.productUrl,
    jurisdiction: plan.compliance.jurisdiction || data.jurisdiction || 'UNKNOWN',
    disclosureText: plan.compliance.regulatoryRef || '#ad',
    maxRenderCostCents: data.maxRenderCostCents ?? DEFAULT_MAX_RENDER_COST_CENTS,
    ...(data.targetAccount ? { targetAccount: data.targetAccount } : {}),
  };
}

export async function persistCeoApprovalDraftStep(params: {
  data: NicheVideoDispatchData;
  tenantId: string;
  stableCampaignId: string;
  approvalPayload: CampaignApprovalPayload;
}): Promise<{ persisted: boolean; approvalId?: string; reason?: string }> {
  const { data, tenantId, stableCampaignId, approvalPayload } = params;
  if (!tenantId) return { persisted: false, reason: 'TENANT_REQUIRED' };
  const db = await getD1();
  if (!db) return { persisted: false, reason: 'DB_UNAVAILABLE' };

  const dispatch: ApprovalDispatchContext = {
    userId: data.userId,
    offerId: data.offerId,
    maxRenderCostCents: data.maxRenderCostCents,
    targetAccount: data.targetAccount,
    idempotencyKey: data.idempotencyKey,
    niche: data.niche,
    blueprintId: data.blueprintId,
    productName: data.productName,
    productUrl: data.productUrl,
    targetAudience: data.targetAudience,
    jurisdiction: data.jurisdiction,
    affiliateCode: data.affiliateCode,
    subId: data.subId,
    vanityCoupon: data.vanityCoupon,
    locale: data.locale,
  };
  const created = await createCampaignApproval(db, {
    tenantId,
    campaignId: stableCampaignId,
    niche: data.niche,
    jurisdiction: approvalPayload.jurisdiction,
    status: 'pending_ceo',
    payload: approvalPayload,
    dispatch,
  });
  if (!created.ok) {
    logger.warn('nicheVideoDispatcher: approval row could not be persisted', {
      error: created.error.message,
    });
    return { persisted: false, reason: created.error.code };
  }

  try {
    const chatId = await getChatIdByUserId(data.userId);
    if (chatId) {
      await sendCampaignApprovalNotification({
        chatId,
        approval: created.value,
        productName: data.productName,
        affiliateUrl: data.productUrl,
        budgetUsd: (data.maxRenderCostCents ?? DEFAULT_MAX_RENDER_COST_CENTS) / 100,
        locale: data.locale === 'vi' ? 'vi' : 'en',
      });
    }
  } catch (error) {
    logger.warn('nicheVideoDispatcher: approval telegram notify failed', {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return { persisted: true, approvalId: created.value.id };
}

export async function verifySideEffectGateStep(params: {
  data: NicheVideoDispatchData;
  tenantId: string;
  stableCampaignId: string;
  plan: NicheVideoCampaignPlan;
  approvalPayload: CampaignApprovalPayload;
  currentHash: string;
}): Promise<{ ok: true; nextState: string } | { ok: false; reason: string }> {
  const { data, tenantId, stableCampaignId, plan, approvalPayload, currentHash } = params;
  const killState = tenantId
    ? await getAffiliateKillSwitchState(tenantId)
    : { active: true, known: false, reason: 'TENANT_REQUIRED' };
  const killSwitchActive = killState.active || !killState.known;
  let storedHash = data.approvalHash ?? '';

  const db = await getD1();
  if (db && data.approvalId) {
    const verification = await verifyAndEnforceCampaignApprovalD1(
      db,
      tenantId,
      stableCampaignId,
      approvalPayload,
      killSwitchActive,
      { approvalId: data.approvalId },
    );
    if (!verification.ok) {
      return { ok: false, reason: verification.error.code };
    }
    storedHash = verification.value.verifiedHash;
  }

  const evidence: ExecutionEvidence = {
    tenantId,
    state: 'approval_pending',
    jurisdictionKnown: plan.compliance.isAllowed && Boolean(plan.compliance.jurisdiction),
    termsVerified: data.termsVerified === true,
    approval: {
      status: storedHash ? 'approved' : 'pending_ceo',
      currentHash,
      storedHash,
      nowMs: Date.now(),
    },
    killSwitchActive,
    reservedCostCents: data.maxRenderCostCents ?? DEFAULT_MAX_RENDER_COST_CENTS,
    maxCostCents: PROPOSED_GATE1_VERTICAL_CAP_CENTS,
    credentialsConnected: true,
    outcomeKnown: true,
  };
  const gate = evaluateRenderGate(evidence);
  if (!gate.ok) return { ok: false, reason: gate.error };
  return { ok: true, nextState: gate.value.nextState };
}
