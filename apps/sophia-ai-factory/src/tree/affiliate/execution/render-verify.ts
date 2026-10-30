/**
 * Pre-side-effect re-verification for the execution render worker.
 *
 * Runs immediately before provider submit (and again after every sleep): the
 * approval must still be consumable, the kill switch must be off, the
 * workspace's own render key must resolve, the script must come from the
 * persisted approval payload, and the reserved cost must fit the approved
 * budget. Anything else fails the run with a truthful reason instead of
 * spending.
 *
 * The payload-hash binding itself was enforced at queue-gate time; the payload
 * is immutable after draft, so here the worker checks state/expiry/budget plus
 * payload self-consistency (stored JSON still hashes to the stored digest).
 *
 * Layer: tree/affiliate/execution
 * @module tree/affiliate/execution/render-verify
 */

import {
  computeApprovalPayloadHash,
  type CampaignApprovalPayload,
} from '@/seed/security/approval-payload-hash';
import {
  getCampaignApprovalById,
  type StoredCampaignApproval,
} from '@/tree/affiliate/approval/campaign-approval-repo';
import { getAffiliateKillSwitchState } from '@/tree/affiliate/kill-switch/kill-switch-store';
import type { ExecutionRunRecord } from './execution-repo';

export type RenderReadyErrorCode =
  | 'RUN_NOT_RENDER_QUEUED'
  | 'APPROVAL_MISSING'
  | 'APPROVAL_UNBOUND'
  | 'APPROVAL_NOT_CONSUMABLE'
  | 'APPROVAL_EXPIRED'
  | 'APPROVAL_PAYLOAD_CORRUPT'
  | 'SCRIPT_MISSING'
  | 'DISPATCH_CONTEXT_MISSING'
  | 'KILL_SWITCH_ACTIVE'
  | 'CREDENTIALS_MISSING'
  | 'BUDGET_EXCEEDED';

export type RenderReadyResult =
  | { ok: true; scriptBody: string; apiKey: string; approvalId: string }
  | { ok: false; code: RenderReadyErrorCode; message: string };

export interface RenderVerifyDeps {
  db: D1Database;
  tenantId: string;
  run: ExecutionRunRecord;
  /** Resolves the workspace's own provider key. Null = no key connected. */
  resolveApiKey: (userId: string) => Promise<string | null>;
  nowMs?: number;
}

function parsePayload(raw: string | null | undefined): CampaignApprovalPayload | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<CampaignApprovalPayload>;
    if (
      typeof parsed.scriptBody !== 'string' ||
      typeof parsed.affiliateTargetUrl !== 'string' ||
      typeof parsed.jurisdiction !== 'string' ||
      typeof parsed.disclosureText !== 'string' ||
      typeof parsed.maxRenderCostCents !== 'number'
    ) {
      return null;
    }
    return parsed as CampaignApprovalPayload;
  } catch {
    return null;
  }
}

function parseDispatchUserId(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { userId?: unknown };
    return typeof parsed.userId === 'string' && parsed.userId ? parsed.userId : null;
  } catch {
    return null;
  }
}

/**
 * Only a granted approval backs a queued run: `approved` (fresh) or
 * `executed` (consumed by this run at queue time). Anything else — pending,
 * rejected, revoked, expired, invalidated — must not render.
 */
function checkApprovalConsumable(
  approval: StoredCampaignApproval,
  now: number,
): { code: RenderReadyErrorCode; message: string } | null {
  if (approval.status !== 'approved' && approval.status !== 'executed') {
    return {
      code: 'APPROVAL_NOT_CONSUMABLE',
      message: `Approval ${approval.id} is ${approval.status}`,
    };
  }
  if (approval.expiresAtMs != null && now >= approval.expiresAtMs) {
    return { code: 'APPROVAL_EXPIRED', message: `Approval ${approval.id} expired` };
  }
  return null;
}

export async function verifyRenderReady(deps: RenderVerifyDeps): Promise<RenderReadyResult> {
  const { db, tenantId, run } = deps;
  const now = deps.nowMs ?? Date.now();

  if (run.tenantId !== tenantId) {
    return { ok: false, code: 'APPROVAL_UNBOUND', message: 'Run does not belong to this workspace' };
  }
  if (run.state !== 'render_queued') {
    return {
      ok: false,
      code: 'RUN_NOT_RENDER_QUEUED',
      message: `Run is ${run.state}, not render_queued`,
    };
  }
  if (!run.approvalId) {
    return { ok: false, code: 'APPROVAL_MISSING', message: 'Run has no bound approval' };
  }

  const approval = await getCampaignApprovalById(db, tenantId, run.approvalId);
  if (!approval) {
    return {
      ok: false,
      code: 'APPROVAL_MISSING',
      message: `Approval ${run.approvalId} not found in workspace ${tenantId}`,
    };
  }
  const consumable = checkApprovalConsumable(approval, now);
  if (consumable) return { ok: false, ...consumable };

  const payload = parsePayload(approval.payloadJson);
  if (!payload) {
    return {
      ok: false,
      code: 'APPROVAL_PAYLOAD_CORRUPT',
      message: `Approval ${approval.id} has no usable persisted payload`,
    };
  }
  const recomputed = await computeApprovalPayloadHash(payload);
  if (recomputed !== approval.approvalPayloadHash) {
    return {
      ok: false,
      code: 'APPROVAL_PAYLOAD_CORRUPT',
      message: `Approval ${approval.id} payload no longer matches its digest`,
    };
  }
  if (!payload.scriptBody.trim()) {
    return { ok: false, code: 'SCRIPT_MISSING', message: 'Approval payload has no script' };
  }

  const dispatchUserId = parseDispatchUserId(approval.dispatchJson);
  if (!dispatchUserId) {
    return {
      ok: false,
      code: 'DISPATCH_CONTEXT_MISSING',
      message: `Approval ${approval.id} has no dispatch owner for credential lookup`,
    };
  }

  // A failed kill-switch read is NOT "off": fail closed.
  let killState: { active: boolean; known: boolean };
  try {
    killState = await getAffiliateKillSwitchState(tenantId);
  } catch {
    killState = { active: true, known: false };
  }
  if (killState.active || !killState.known) {
    return {
      ok: false,
      code: 'KILL_SWITCH_ACTIVE',
      message: 'Kill switch is active (or its state is unknown); render blocked',
    };
  }

  if (run.reservedCostCents > Math.max(0, Math.round(payload.maxRenderCostCents))) {
    return {
      ok: false,
      code: 'BUDGET_EXCEEDED',
      message: `Reserved ${run.reservedCostCents}c exceeds approved budget ${payload.maxRenderCostCents}c`,
    };
  }

  const apiKey = await deps.resolveApiKey(dispatchUserId);
  if (!apiKey) {
    return {
      ok: false,
      code: 'CREDENTIALS_MISSING',
      message: 'No render API key connected for this workspace; connect BYOK to proceed',
    };
  }

  return { ok: true, scriptBody: payload.scriptBody, apiKey, approvalId: approval.id };
}
