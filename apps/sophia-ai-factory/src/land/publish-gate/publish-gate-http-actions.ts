/**
 * Compliance Publish Gate — Post Action Handlers (Decision, Execute, Mutate, Reconcile).
 *
 * Enforces ADMIN RBAC on approval/execution/reconciliation, constant-time digest & nonce
 * checks, 72h expiry enforcement, and zero-network MOCK_ONLY execution.
 *
 * Layer: land (API route orchestration).
 * @module land/publish-gate/publish-gate-http-actions
 */

import type { D1Database } from '@cloudflare/workers-types';
import { timingSafeEqualString } from '@/tree/publish-gate/crypto-binding';
import { getMockPublishGateAdapter } from '@/tree/publish-gate/platform-adapter';
import {
  claimMockExecutionAtomic,
  consumeHumanDecisionAtomic,
  expireApprovalAtomic,
  finalizeMockExecutionAtomic,
  mutatePayloadInvalidateApprovalAtomic,
  reconcileUncertainExecutionAtomic,
} from '@/tree/publish-gate/publish-gate-execution-repo';
import { getPublishGateById } from '@/tree/publish-gate/publish-gate-repo';
import {
  jsonPrivate,
  toCanonicalPayload,
  type PublishGatePostAction,
} from './publish-gate-http-schemas';

export interface ActionContext {
  readonly d1: D1Database;
  readonly orgId: string;
  readonly userId: string;
  readonly isAdmin: boolean;
  readonly nowIso: string;
  readonly emitHumanApproved?: (data: {
    readonly requestId: string;
    readonly orgId: string;
    readonly approverUserId: string;
    readonly approvalNonce: string;
    readonly payloadDigestSha256: string;
    readonly approvalVersion: number;
    readonly decision: 'approved' | 'rejected';
    readonly publicationMode: 'MOCK_ONLY';
  }) => Promise<void>;
}

export async function handleApprovalDecisionAction(
  ctx: ActionContext,
  action: Extract<PublishGatePostAction, { action: 'approve' | 'reject' }>,
): Promise<Response> {
  if (!ctx.isAdmin) {
    return jsonPrivate({ error: 'ADMIN_ROLE_REQUIRED' }, 403);
  }
  const existing = await getPublishGateById(ctx.d1, ctx.orgId, action.requestId);
  if (!existing) {
    return jsonPrivate({ error: 'NOT_FOUND' }, 404);
  }
  if (existing.state !== 'AWAITING_HUMAN_APPROVAL') {
    return jsonPrivate({ error: 'INVALID_STATE_FOR_DECISION', state: existing.state }, 409);
  }
  if (existing.approvalExpiresAtIso && existing.approvalExpiresAtIso <= ctx.nowIso) {
    const expired = await expireApprovalAtomic(ctx.d1, {
      orgId: ctx.orgId,
      requestId: existing.requestId,
      actorUserId: ctx.userId,
      expectedState: 'AWAITING_HUMAN_APPROVAL',
      payloadDigestSha256: existing.payloadDigestSha256,
      nowIso: ctx.nowIso,
    });
    return jsonPrivate({ error: 'APPROVAL_EXPIRED', record: expired ?? existing }, 409);
  }
  if (!timingSafeEqualString(existing.payloadDigestSha256, action.payloadDigestSha256)) {
    return jsonPrivate({ error: 'PAYLOAD_DIGEST_MISMATCH' }, 409);
  }
  if (!existing.approvalNonce || !timingSafeEqualString(existing.approvalNonce, action.approvalNonce)) {
    return jsonPrivate({ error: 'INVALID_OR_STALE_APPROVAL_NONCE' }, 409);
  }
  if (existing.approvalVersion !== action.approvalVersion) {
    return jsonPrivate({ error: 'APPROVAL_VERSION_MISMATCH' }, 409);
  }

  const decision = action.action === 'approve' ? 'approved' : 'rejected';
  const updated = await consumeHumanDecisionAtomic(ctx.d1, {
    orgId: ctx.orgId,
    requestId: existing.requestId,
    approverUserId: ctx.userId,
    approvalNonce: action.approvalNonce,
    expectedPayloadDigest: action.payloadDigestSha256,
    expectedApprovalVersion: action.approvalVersion,
    decision,
    rejectionReason: action.action === 'reject' ? action.rejectionReason : undefined,
    nowIso: ctx.nowIso,
  });

  if (!updated) {
    return jsonPrivate({ error: 'APPROVAL_REPLAY_OR_CONFLICT' }, 409);
  }

  if (ctx.emitHumanApproved) {
    try {
      await ctx.emitHumanApproved({
        requestId: updated.requestId,
        orgId: ctx.orgId,
        approverUserId: ctx.userId,
        approvalNonce: action.approvalNonce,
        payloadDigestSha256: updated.payloadDigestSha256,
        approvalVersion: updated.approvalVersion,
        decision,
        publicationMode: 'MOCK_ONLY',
      });
    } catch {
      // Best-effort Inngest wake-up; D1 ledger commit is authoritative.
    }
  }

  return jsonPrivate({ record: updated }, 200);
}

export async function handleExecuteMockAction(
  ctx: ActionContext,
  action: Extract<PublishGatePostAction, { action: 'execute_mock' }>,
): Promise<Response> {
  if (!ctx.isAdmin) {
    return jsonPrivate({ error: 'ADMIN_ROLE_REQUIRED' }, 403);
  }
  const existing = await getPublishGateById(ctx.d1, ctx.orgId, action.requestId);
  if (!existing) {
    return jsonPrivate({ error: 'NOT_FOUND' }, 404);
  }
  if (existing.state === 'SIMULATED_PUBLISHED' || existing.state === 'SIMULATED_FAILED') {
    return jsonPrivate({ record: existing, replayed: true }, 200);
  }
  if (existing.state !== 'APPROVED') {
    return jsonPrivate({ error: 'APPROVAL_REQUIRED_BEFORE_EXECUTION', state: existing.state }, 409);
  }
  if (existing.approvalExpiresAtIso && existing.approvalExpiresAtIso <= ctx.nowIso) {
    const expired = await expireApprovalAtomic(ctx.d1, {
      orgId: ctx.orgId,
      requestId: existing.requestId,
      actorUserId: ctx.userId,
      expectedState: 'APPROVED',
      payloadDigestSha256: existing.payloadDigestSha256,
      nowIso: ctx.nowIso,
    });
    return jsonPrivate({ error: 'APPROVAL_EXPIRED', record: expired ?? existing }, 409);
  }
  if (!timingSafeEqualString(existing.payloadDigestSha256, action.payloadDigestSha256)) {
    return jsonPrivate({ error: 'PAYLOAD_DIGEST_MISMATCH' }, 409);
  }
  if (!existing.capabilitySnapshot) {
    return jsonPrivate({ error: 'PREFLIGHT_SNAPSHOT_MISSING' }, 409);
  }

  const claimed = await claimMockExecutionAtomic(ctx.d1, {
    orgId: ctx.orgId,
    requestId: existing.requestId,
    actorUserId: ctx.userId,
    expectedPayloadDigest: existing.payloadDigestSha256,
    expectedVersion: existing.version,
    nowIso: ctx.nowIso,
  });

  if (!claimed) {
    return jsonPrivate({ error: 'EXECUTION_ALREADY_CLAIMED_OR_CONFLICT' }, 409);
  }

  const adapter = getMockPublishGateAdapter(claimed.record.platform);
  const receipt = adapter.executeMock({
    requestId: claimed.record.requestId,
    orgId: ctx.orgId,
    payload: claimed.record.payload,
    payloadDigestSha256: claimed.record.payloadDigestSha256,
    executionClaimId: claimed.executionClaimId,
    snapshot: existing.capabilitySnapshot,
    failureInjection: action.failureInjection,
    nowIso: ctx.nowIso,
  });

  const finalized = await finalizeMockExecutionAtomic(ctx.d1, {
    orgId: ctx.orgId,
    requestId: claimed.record.requestId,
    actorUserId: ctx.userId,
    executionClaimId: claimed.executionClaimId,
    receipt,
    nowIso: ctx.nowIso,
  });

  if (!finalized) {
    return jsonPrivate({ error: 'EXECUTION_FINALIZE_CONFLICT' }, 409);
  }
  return jsonPrivate({ record: finalized, replayed: false }, 200);
}

export async function handleMutateAndReconcileActions(
  ctx: ActionContext,
  action: Extract<PublishGatePostAction, { action: 'mutate_payload' | 'reconcile' }>,
): Promise<Response> {
  const existing = await getPublishGateById(ctx.d1, ctx.orgId, action.requestId);
  if (!existing) {
    return jsonPrivate({ error: 'NOT_FOUND' }, 404);
  }

  if (action.action === 'mutate_payload') {
    if (existing.state === 'APPROVED' && !ctx.isAdmin) {
      return jsonPrivate({ error: 'ADMIN_ROLE_REQUIRED' }, 403);
    }
    if (
      action.payload.platform !== existing.platform ||
      action.payload.campaignId !== existing.campaignId
    ) {
      return jsonPrivate({ error: 'IMMUTABLE_IDENTITY_FIELDS_MISMATCH' }, 409);
    }
    const mutated = await mutatePayloadInvalidateApprovalAtomic(ctx.d1, {
      orgId: ctx.orgId,
      requestId: existing.requestId,
      actorUserId: ctx.userId,
      expectedVersion: existing.version,
      expectedState: existing.state,
      nextPayload: toCanonicalPayload(action.payload),
      nowIso: ctx.nowIso,
    });
    if (!mutated) {
      return jsonPrivate({ error: 'PAYLOAD_IMMUTABLE_IN_CURRENT_STATE', state: existing.state }, 409);
    }
    return jsonPrivate({ record: mutated }, 200);
  }

  if (!ctx.isAdmin) {
    return jsonPrivate({ error: 'ADMIN_ROLE_REQUIRED' }, 403);
  }
  const reconciled = await reconcileUncertainExecutionAtomic(ctx.d1, {
    orgId: ctx.orgId,
    requestId: existing.requestId,
    actorUserId: ctx.userId,
    resolution: action.resolution,
    reasonCode: action.reasonCode,
    payloadDigestSha256: existing.payloadDigestSha256,
    nowIso: ctx.nowIso,
  });
  if (!reconciled) {
    return jsonPrivate({ error: 'NOT_IN_RECONCILIATION_STATE', state: existing.state }, 409);
  }
  return jsonPrivate({ record: reconciled }, 200);
}
