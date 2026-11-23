/**
 * Compliance Publish Gate — Inngest Durable Approval Wait Workflow (MOCK_ONLY).
 *
 * Uses `step.waitForEvent('b2-wait-human-approval', ...)` with 72h timeout and
 * CEL correlation over `requestId`, `orgId`, and `payloadDigestSha256`.
 * Always re-reads the D1 ledger as source of truth after wake-up.
 *
 * Layer: forest (workflow orchestration).
 * @module forest/inngest/functions/b2-publish-gate-workflow
 */

import type { D1Database } from '@cloudflare/workers-types';
import { inngest } from '@/seed/inngest/client';
import { getD1 } from '@/seed/db/get-d1';
import { isB2CompliancePublishGateEnabled } from '@/seed/config/flags';
import { timingSafeEqualString } from '@/tree/publish-gate/crypto-binding';
import { getMockPublishGateAdapter } from '@/tree/publish-gate/platform-adapter';
import {
  claimMockExecutionAtomic,
  expireApprovalAtomic,
  finalizeMockExecutionAtomic,
} from '@/tree/publish-gate/publish-gate-execution-repo';
import { getPublishGateById } from '@/tree/publish-gate/publish-gate-repo';
import type { MockExecutionReceipt, PublishGateRecord } from '@/tree/publish-gate/types';

type ApprovalEventData = {
  readonly requestId: string;
  readonly orgId: string;
  readonly approverUserId: string;
  readonly approvalNonce: string;
  readonly payloadDigestSha256: string;
  readonly approvalVersion: number;
  readonly decision: 'approved' | 'rejected';
  readonly publicationMode: 'MOCK_ONLY';
};

function validateWakeupApprovalEvent(
  record: PublishGateRecord,
  eventData: { readonly payloadDigestSha256: string; readonly approvalVersion?: number },
  approvalData: ApprovalEventData,
): string | null {
  if (approvalData.publicationMode !== 'MOCK_ONLY') {
    return 'PUBLICATION_MODE_MUST_BE_MOCK_ONLY';
  }
  if (approvalData.orgId !== record.orgId || approvalData.requestId !== record.requestId) {
    return 'EVENT_IDENTITY_MISMATCH';
  }
  if (approvalData.decision !== 'approved') {
    return 'EVENT_DECISION_NOT_APPROVED';
  }
  if (
    !timingSafeEqualString(record.payloadDigestSha256, eventData.payloadDigestSha256) ||
    !timingSafeEqualString(record.payloadDigestSha256, approvalData.payloadDigestSha256)
  ) {
    return 'LEDGER_DIGEST_CHANGED_AFTER_REQUEST';
  }
  if (
    approvalData.approvalVersion !== record.approvalVersion ||
    (typeof eventData.approvalVersion === 'number' &&
      record.approvalVersion !== eventData.approvalVersion)
  ) {
    return 'APPROVAL_VERSION_MISMATCH';
  }
  if (
    !record.approvalNonce ||
    !timingSafeEqualString(record.approvalNonce, approvalData.approvalNonce)
  ) {
    return 'APPROVAL_NONCE_MISMATCH';
  }
  return null;
}

export interface B2WorkflowStepLike {
  waitForEvent: (
    id: string,
    opts: { readonly event: 'campaign/publish.human_approved'; readonly timeout: string; readonly if: string },
  ) => Promise<{
    readonly data: {
      readonly requestId: string;
      readonly orgId: string;
      readonly approverUserId: string;
      readonly approvalNonce: string;
      readonly payloadDigestSha256: string;
      readonly approvalVersion: number;
      readonly decision: 'approved' | 'rejected';
      readonly publicationMode: 'MOCK_ONLY';
    };
  } | null>;
  run: <T>(id: string, fn: () => Promise<T>) => Promise<T>;
}

export interface B2WorkflowOutcome {
  readonly outcome: 'SIMULATED_PUBLISHED' | 'SIMULATED_FAILED' | 'RECONCILIATION_REQUIRED' | 'APPROVAL_EXPIRED' | 'BLOCKED';
  readonly reason: string;
  readonly receipt?: MockExecutionReceipt;
}

export async function runB2PublishGateWorkflowCore(params: {
  readonly d1: D1Database;
  readonly eventData: {
    readonly requestId: string;
    readonly orgId: string;
    readonly payloadDigestSha256: string;
    readonly approvalVersion?: number;
    readonly publicationMode: 'MOCK_ONLY';
  };
  readonly step: B2WorkflowStepLike;
  readonly nowMs?: () => number;
}): Promise<B2WorkflowOutcome> {
  const { d1, eventData, step } = params;
  const nowIso = (): string => new Date((params.nowMs ?? Date.now)()).toISOString();

  if (eventData.publicationMode !== 'MOCK_ONLY') {
    return { outcome: 'BLOCKED', reason: 'PUBLICATION_MODE_MUST_BE_MOCK_ONLY' };
  }

  const approvalEvent = await step.waitForEvent('b2-wait-human-approval', {
    event: 'campaign/publish.human_approved',
    timeout: '72h',
    if: "async.data.requestId == event.data.requestId && async.data.orgId == event.data.orgId && async.data.payloadDigestSha256 == event.data.payloadDigestSha256 && async.data.approvalVersion == event.data.approvalVersion",
  });

  if (!approvalEvent) {
    return step.run('b2-expire-on-timeout', async () => {
      const ts = nowIso();
      const current = await getPublishGateById(d1, eventData.orgId, eventData.requestId);
      if (
        current &&
        current.state === 'AWAITING_HUMAN_APPROVAL' &&
        timingSafeEqualString(current.payloadDigestSha256, eventData.payloadDigestSha256) &&
        (typeof eventData.approvalVersion !== 'number' ||
          current.approvalVersion === eventData.approvalVersion)
      ) {
        await expireApprovalAtomic(d1, {
          orgId: eventData.orgId,
          requestId: eventData.requestId,
          actorUserId: 'system:inngest-timeout',
          expectedState: 'AWAITING_HUMAN_APPROVAL',
          payloadDigestSha256: eventData.payloadDigestSha256,
          expectedApprovalVersion: eventData.approvalVersion ?? current.approvalVersion,
          nowIso: ts,
        });
      }
      return { outcome: 'APPROVAL_EXPIRED' as const, reason: 'HUMAN_APPROVAL_TIMED_OUT_72H' };
    });
  }

  return step.run('b2-verify-ledger-and-execute-mock', async () => {
    const ts = nowIso();
    const record = await getPublishGateById(d1, eventData.orgId, eventData.requestId);
    if (!record) {
      return { outcome: 'BLOCKED' as const, reason: 'LEDGER_RECORD_NOT_FOUND' };
    }
    if (record.state === 'SIMULATED_PUBLISHED' && record.mockReceipt) {
      return { outcome: 'SIMULATED_PUBLISHED' as const, reason: 'ALREADY_EXECUTED', receipt: record.mockReceipt };
    }
    if (record.state !== 'APPROVED') {
      return { outcome: 'BLOCKED' as const, reason: `LEDGER_STATE_NOT_APPROVED:${record.state}` };
    }
    const validationError = validateWakeupApprovalEvent(record, eventData, approvalEvent.data);
    if (validationError) {
      return { outcome: 'BLOCKED' as const, reason: validationError };
    }
    if (record.approvalExpiresAtIso && record.approvalExpiresAtIso <= ts) {
      await expireApprovalAtomic(d1, {
        orgId: record.orgId,
        requestId: record.requestId,
        actorUserId: 'system:inngest-expiry',
        expectedState: 'APPROVED',
        payloadDigestSha256: record.payloadDigestSha256,
        expectedApprovalVersion: record.approvalVersion,
        nowIso: ts,
      });
      return { outcome: 'APPROVAL_EXPIRED' as const, reason: 'APPROVAL_EXPIRED_BEFORE_CLAIM' };
    }
    if (!record.capabilitySnapshot) {
      return { outcome: 'BLOCKED' as const, reason: 'PREFLIGHT_SNAPSHOT_MISSING' };
    }

    const actorUserId = record.approvedByUserId ?? approvalEvent.data.approverUserId;
    const claimed = await claimMockExecutionAtomic(d1, {
      orgId: record.orgId,
      requestId: record.requestId,
      actorUserId,
      expectedPayloadDigest: record.payloadDigestSha256,
      expectedVersion: record.version,
      expectedApprovalVersion: record.approvalVersion,
      nowIso: ts,
    });
    if (!claimed) {
      return { outcome: 'BLOCKED' as const, reason: 'EXECUTION_CLAIM_CONFLICT' };
    }

    const adapter = getMockPublishGateAdapter(claimed.record.platform);
    const receipt = adapter.executeMock({
      requestId: claimed.record.requestId,
      orgId: claimed.record.orgId,
      payload: claimed.record.payload,
      payloadDigestSha256: claimed.record.payloadDigestSha256,
      executionClaimId: claimed.executionClaimId,
      snapshot: record.capabilitySnapshot,
      nowIso: ts,
    });

    const finalized = await finalizeMockExecutionAtomic(d1, {
      orgId: claimed.record.orgId,
      requestId: claimed.record.requestId,
      actorUserId,
      executionClaimId: claimed.executionClaimId,
      receipt,
      nowIso: ts,
    });

    if (!finalized) {
      return { outcome: 'BLOCKED' as const, reason: 'EXECUTION_FINALIZE_CONFLICT' };
    }

    return { outcome: receipt.simulatedStatus, reason: receipt.message, receipt };
  });
}

export const b2PublishGateWorkflowFunction = inngest.createFunction(
  {
    id: 'b2-compliance-publish-gate',
    name: 'B2 Compliance Publish Gate (MOCK_ONLY)',
    retries: 0,
  },
  { event: 'campaign/publish.gate_requested' },
  async ({ event, step }) => {
    if (!isB2CompliancePublishGateEnabled()) {
      return { outcome: 'BLOCKED', reason: 'FEATURE_DISABLED' };
    }
    const d1 = await getD1();
    if (!d1) {
      return { outcome: 'BLOCKED', reason: 'D1_UNAVAILABLE' };
    }
    return runB2PublishGateWorkflowCore({
      d1,
      eventData: event.data,
      step: step as unknown as B2WorkflowStepLike,
    });
  },
);
