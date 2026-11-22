/**
 * Compliance Publish Gate — Durable D1 Repository (Decision, Mutation, Claim, Reconcile).
 *
 * Enforces single-use approval nonce, immutable payload digest binding, expiry check,
 * atomic execution claim, and sequential CAS before audit event append.
 *
 * Layer: tree (domain logic).
 * @module tree/publish-gate/publish-gate-execution-repo
 */

import type { D1Database } from '@cloudflare/workers-types';
import { computePublishGatePayloadDigest } from './crypto-binding';
import { appendPublishGateAuditEvent } from './publish-gate-repo-mapper';
import { getPublishGateById } from './publish-gate-repo';
import type {
  MockExecutionReceipt,
  PublishGatePayload,
  PublishGateRecord,
  PublishGateState,
} from './types';

export async function consumeHumanDecisionAtomic(
  d1: D1Database,
  input: {
    readonly orgId: string;
    readonly requestId: string;
    readonly approverUserId: string;
    readonly approvalNonce: string;
    readonly expectedPayloadDigest: string;
    readonly expectedApprovalVersion: number;
    readonly decision: 'approved' | 'rejected';
    readonly rejectionReason?: string;
    readonly nowIso: string;
  },
): Promise<PublishGateRecord | null> {
  const nextState: PublishGateState = input.decision === 'approved' ? 'APPROVED' : 'REJECTED';
  const res = await d1
    .prepare(
      `UPDATE b2_publish_gate_requests
       SET state = ?,
           approval_nonce_used_at_iso = ?,
           approved_by_user_id = ?,
           approved_at_iso = ?,
           rejection_reason = ?,
           version = version + 1,
           updated_at_iso = ?
       WHERE org_id = ?
         AND request_id = ?
         AND state = 'AWAITING_HUMAN_APPROVAL'
         AND approval_nonce = ?
         AND approval_nonce_used_at_iso IS NULL
         AND payload_digest_sha256 = ?
         AND approval_version = ?
         AND approval_expires_at_iso > ?`,
    )
    .bind(
      nextState,
      input.nowIso,
      input.approverUserId,
      input.nowIso,
      input.decision === 'rejected' ? (input.rejectionReason ?? 'REJECTED_BY_ADMIN') : null,
      input.nowIso,
      input.orgId,
      input.requestId,
      input.approvalNonce,
      input.expectedPayloadDigest,
      input.expectedApprovalVersion,
      input.nowIso,
    )
    .run();

  if ((res.meta?.changes ?? 0) !== 1) {
    return null;
  }

  await appendPublishGateAuditEvent(d1, {
    requestId: input.requestId,
    orgId: input.orgId,
    actorUserId: input.approverUserId,
    fromState: 'AWAITING_HUMAN_APPROVAL',
    toState: nextState,
    eventType: input.decision === 'approved' ? 'HUMAN_APPROVED' : 'HUMAN_REJECTED',
    reasonCode: input.decision === 'rejected' ? (input.rejectionReason ?? 'REJECTED_BY_ADMIN') : null,
    payloadDigestSha256: input.expectedPayloadDigest,
    nowIso: input.nowIso,
  });

  return getPublishGateById(d1, input.orgId, input.requestId);
}

export async function expireApprovalAtomic(
  d1: D1Database,
  input: {
    readonly orgId: string;
    readonly requestId: string;
    readonly actorUserId: string;
    readonly expectedState: 'AWAITING_HUMAN_APPROVAL' | 'APPROVED';
    readonly payloadDigestSha256: string;
    readonly expectedApprovalVersion?: number;
    readonly nowIso: string;
  },
): Promise<PublishGateRecord | null> {
  const versionClause =
    typeof input.expectedApprovalVersion === 'number'
      ? ' AND approval_version = ?'
      : '';
  const bindings: unknown[] = [
    input.nowIso,
    input.orgId,
    input.requestId,
    input.expectedState,
    input.payloadDigestSha256,
    input.nowIso,
  ];
  if (typeof input.expectedApprovalVersion === 'number') {
    bindings.push(input.expectedApprovalVersion);
  }
  const res = await d1
    .prepare(
      `UPDATE b2_publish_gate_requests
       SET state = 'APPROVAL_EXPIRED', version = version + 1, updated_at_iso = ?
       WHERE org_id = ?
         AND request_id = ?
         AND state = ?
         AND payload_digest_sha256 = ?
         AND approval_expires_at_iso <= ?${versionClause}`,
    )
    .bind(...bindings)
    .run();

  if ((res.meta?.changes ?? 0) !== 1) {
    return null;
  }

  await appendPublishGateAuditEvent(d1, {
    requestId: input.requestId,
    orgId: input.orgId,
    actorUserId: input.actorUserId,
    fromState: input.expectedState,
    toState: 'APPROVAL_EXPIRED',
    eventType: 'APPROVAL_EXPIRED',
    reasonCode: 'APPROVAL_WINDOW_EXCEEDED',
    payloadDigestSha256: input.payloadDigestSha256,
    nowIso: input.nowIso,
  });

  return getPublishGateById(d1, input.orgId, input.requestId);
}

export async function mutatePayloadInvalidateApprovalAtomic(
  d1: D1Database,
  input: {
    readonly orgId: string;
    readonly requestId: string;
    readonly actorUserId: string;
    readonly expectedVersion: number;
    readonly expectedState: PublishGateState;
    readonly nextPayload: PublishGatePayload;
    readonly nowIso: string;
  },
): Promise<PublishGateRecord | null> {
  const nextDigest = await computePublishGatePayloadDigest(input.nextPayload);
  const res = await d1
    .prepare(
      `UPDATE b2_publish_gate_requests
       SET state = 'PREFLIGHT_REQUIRED',
           media_artifact_id = ?,
           media_content_digest = ?,
           destination_account_id = ?,
           payload_json = ?,
           payload_digest_sha256 = ?,
           compliance_json = ?,
           capability_snapshot_json = NULL,
           approval_nonce = NULL,
           approval_nonce_used_at_iso = NULL,
           approval_expires_at_iso = NULL,
           approved_by_user_id = NULL,
           approved_at_iso = NULL,
           approval_version = approval_version + 1,
           version = version + 1,
           updated_at_iso = ?
       WHERE org_id = ? AND request_id = ? AND state = ? AND version = ?
         AND state IN ('DRAFT', 'PREFLIGHT_REQUIRED', 'PREFLIGHT_BLOCKED', 'READY_FOR_REVIEW', 'AWAITING_HUMAN_APPROVAL', 'APPROVED')`,
    )
    .bind(
      input.nextPayload.mediaArtifactId,
      input.nextPayload.mediaContentDigest,
      input.nextPayload.destinationAccountId,
      JSON.stringify(input.nextPayload),
      nextDigest,
      JSON.stringify(input.nextPayload.compliance),
      input.nowIso,
      input.orgId,
      input.requestId,
      input.expectedState,
      input.expectedVersion,
    )
    .run();

  if ((res.meta?.changes ?? 0) !== 1) {
    return null;
  }

  await appendPublishGateAuditEvent(d1, {
    requestId: input.requestId,
    orgId: input.orgId,
    actorUserId: input.actorUserId,
    fromState: input.expectedState,
    toState: 'PREFLIGHT_REQUIRED',
    eventType: 'PAYLOAD_MUTATED_APPROVAL_INVALIDATED',
    reasonCode: 'PAYLOAD_DIGEST_CHANGED',
    payloadDigestSha256: nextDigest,
    nowIso: input.nowIso,
  });

  return getPublishGateById(d1, input.orgId, input.requestId);
}

export async function claimMockExecutionAtomic(
  d1: D1Database,
  input: {
    readonly orgId: string;
    readonly requestId: string;
    readonly actorUserId: string;
    readonly expectedPayloadDigest: string;
    readonly expectedVersion: number;
    readonly expectedApprovalVersion: number;
    readonly nowIso: string;
  },
): Promise<{ readonly record: PublishGateRecord; readonly executionClaimId: string } | null> {
  const claimId = `b2claim_${crypto.randomUUID().replace(/-/g, '')}`;
  const res = await d1
    .prepare(
      `UPDATE b2_publish_gate_requests
       SET state = 'MOCK_EXECUTION_CLAIMED',
           execution_claim_id = ?,
           version = version + 1,
           updated_at_iso = ?
       WHERE org_id = ?
         AND request_id = ?
         AND state = 'APPROVED'
         AND version = ?
         AND approval_version = ?
         AND payload_digest_sha256 = ?
         AND execution_claim_id IS NULL
         AND approval_expires_at_iso > ?`,
    )
    .bind(
      claimId,
      input.nowIso,
      input.orgId,
      input.requestId,
      input.expectedVersion,
      input.expectedApprovalVersion,
      input.expectedPayloadDigest,
      input.nowIso,
    )
    .run();

  if ((res.meta?.changes ?? 0) !== 1) {
    return null;
  }

  await appendPublishGateAuditEvent(d1, {
    requestId: input.requestId,
    orgId: input.orgId,
    actorUserId: input.actorUserId,
    fromState: 'APPROVED',
    toState: 'MOCK_EXECUTION_CLAIMED',
    eventType: 'MOCK_EXECUTION_CLAIMED',
    reasonCode: null,
    payloadDigestSha256: input.expectedPayloadDigest,
    metadata: { executionClaimId: claimId },
    nowIso: input.nowIso,
  });

  const record = await getPublishGateById(d1, input.orgId, input.requestId);
  return record ? { record, executionClaimId: claimId } : null;
}

export async function finalizeMockExecutionAtomic(
  d1: D1Database,
  input: {
    readonly orgId: string;
    readonly requestId: string;
    readonly actorUserId: string;
    readonly executionClaimId: string;
    readonly receipt: MockExecutionReceipt;
    readonly nowIso: string;
  },
): Promise<PublishGateRecord | null> {
  const res = await d1
    .prepare(
      `UPDATE b2_publish_gate_requests
       SET state = ?,
           mock_receipt_json = ?,
           version = version + 1,
           updated_at_iso = ?
       WHERE org_id = ?
         AND request_id = ?
         AND state = 'MOCK_EXECUTION_CLAIMED'
         AND execution_claim_id = ?`,
    )
    .bind(
      input.receipt.simulatedStatus,
      JSON.stringify(input.receipt),
      input.nowIso,
      input.orgId,
      input.requestId,
      input.executionClaimId,
    )
    .run();

  if ((res.meta?.changes ?? 0) !== 1) {
    return null;
  }

  await appendPublishGateAuditEvent(d1, {
    requestId: input.requestId,
    orgId: input.orgId,
    actorUserId: input.actorUserId,
    fromState: 'MOCK_EXECUTION_CLAIMED',
    toState: input.receipt.simulatedStatus,
    eventType: 'MOCK_EXECUTION_FINALIZED',
    reasonCode: input.receipt.errorCode,
    payloadDigestSha256: input.receipt.payloadDigestSha256,
    metadata: { mockReceiptId: input.receipt.mockReceiptId },
    nowIso: input.nowIso,
  });

  return getPublishGateById(d1, input.orgId, input.requestId);
}

export async function reconcileUncertainExecutionAtomic(
  d1: D1Database,
  input: {
    readonly orgId: string;
    readonly requestId: string;
    readonly actorUserId: string;
    readonly resolution: 'SIMULATED_PUBLISHED' | 'SIMULATED_FAILED';
    readonly reasonCode: string;
    readonly payloadDigestSha256: string;
    readonly nowIso: string;
  },
): Promise<PublishGateRecord | null> {
  const existing = await getPublishGateById(d1, input.orgId, input.requestId);
  if (!existing || existing.state !== 'RECONCILIATION_REQUIRED') {
    return null;
  }

  const updatedReceiptJson = existing.mockReceipt
    ? JSON.stringify({
        ...existing.mockReceipt,
        simulatedStatus: input.resolution,
        errorCode: input.resolution === 'SIMULATED_PUBLISHED' ? null : input.reasonCode,
        message: `Reconciled as ${input.resolution} (${input.reasonCode}).`,
      })
    : null;

  const res = await d1
    .prepare(
      `UPDATE b2_publish_gate_requests
       SET state = ?,
           mock_receipt_json = COALESCE(?, mock_receipt_json),
           version = version + 1,
           updated_at_iso = ?
       WHERE org_id = ? AND request_id = ? AND state = 'RECONCILIATION_REQUIRED' AND version = ?`,
    )
    .bind(
      input.resolution,
      updatedReceiptJson,
      input.nowIso,
      input.orgId,
      input.requestId,
      existing.version,
    )
    .run();

  if ((res.meta?.changes ?? 0) !== 1) {
    return null;
  }

  await appendPublishGateAuditEvent(d1, {
    requestId: input.requestId,
    orgId: input.orgId,
    actorUserId: input.actorUserId,
    fromState: 'RECONCILIATION_REQUIRED',
    toState: input.resolution,
    eventType: 'RECONCILIATION_RESOLVED',
    reasonCode: input.reasonCode,
    payloadDigestSha256: input.payloadDigestSha256,
    nowIso: input.nowIso,
  });

  return getPublishGateById(d1, input.orgId, input.requestId);
}
