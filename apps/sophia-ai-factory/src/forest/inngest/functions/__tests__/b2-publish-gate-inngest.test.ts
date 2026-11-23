// @vitest-environment node
/**
 * Track B2 Compliance Publish Gate — Inngest 72h Wait Workflow Tests (8 cases).
 * Verifies ledger authority, timeout expiry, digest mismatch, and 0 external network calls.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NodeSqliteD1Database } from '@/seed/db/node-sqlite-d1';
import {
  runB2PublishGateWorkflowCore,
  type B2WorkflowStepLike,
} from '@/forest/inngest/functions/b2-publish-gate-workflow';

const B2_MIGRATION_SQL = fs.readFileSync(
  path.resolve(__dirname, '../../../../../migrations/0516_b2_compliance_publish_gate.sql'),
  'utf8',
);
import { getMockPublishGateAdapter } from '@/tree/publish-gate/platform-adapter';
import {
  createOrReplayPublishGateRequest,
  getPublishGateById,
  recordPreflightOutcomeAtomic,
  submitForHumanApprovalAtomic,
} from '@/tree/publish-gate/publish-gate-repo';
import {
  claimMockExecutionAtomic,
  consumeHumanDecisionAtomic,
  mutatePayloadInvalidateApprovalAtomic,
} from '@/tree/publish-gate/publish-gate-execution-repo';
import type { D1Database } from '@cloudflare/workers-types';
import type { PublishGatePayload, PublishGateRecord } from '@/tree/publish-gate/types';

function makePayload(overrides: Partial<PublishGatePayload> = {}): PublishGatePayload {
  return {
    campaignId: 'camp_inngest_01',
    mediaArtifactId: 'art_inngest_01',
    mediaContentDigest: 'sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
    mediaDurationSec: 25,
    platform: 'tiktok',
    destinationAccountId: 'tt_unaudited_01',
    destinationAccountHandle: '@inngest_demo',
    caption: 'Inngest waitForEvent test clip',
    payloadVersion: 1,
    publicationMode: 'MOCK_ONLY',
    compliance: {
      aiSyntheticDisclosure: true,
      commercialDisclosure: false,
      tiktok: {
        privacyLevel: 'SELF_ONLY',
        commercialContentToggle: false,
        brandOrganicToggle: false,
        brandContentToggle: false,
        isAigc: true,
        musicUsageConfirmed: true,
        brandedContentPolicyConfirmed: false,
        allowComment: true,
        allowDuet: false,
        allowStitch: false,
      },
    },
    ...overrides,
  };
}

function makeStep(
  waitResult: Awaited<ReturnType<B2WorkflowStepLike['waitForEvent']>>,
): B2WorkflowStepLike {
  return {
    waitForEvent: vi.fn(async () => waitResult),
    run: <T>(_id: string, fn: () => Promise<T>) => fn(),
  };
}

describe('B2 Publish Gate — Inngest Durable Wait Workflow (8 cases)', () => {
  let d1: NodeSqliteD1Database;
  let nowMs: number;
  const fetchSpy = vi.fn(() => {
    throw new Error('EXTERNAL_NETWORK_CALL_FORBIDDEN');
  });

  async function seedAwaiting(): Promise<PublishGateRecord> {
    const nowIso = new Date(nowMs).toISOString();
    const created = await createOrReplayPublishGateRequest(d1, {
      orgId: 'org_inngest',
      userId: 'user_1',
      payload: makePayload(),
      nowIso,
    });
    if (created.status === 'idempotency_conflict') {
      throw new Error('unexpected conflict');
    }
    const evalRes = getMockPublishGateAdapter('tiktok').preflight({
      payload: created.record.payload,
    });
    const preflighted = await recordPreflightOutcomeAtomic(d1, {
      orgId: 'org_inngest',
      requestId: created.record.requestId,
      actorUserId: 'user_1',
      expectedVersion: created.record.version,
      expectedState: created.record.state,
      passed: evalRes.passed,
      snapshot: evalRes.snapshot,
      payloadDigestSha256: created.record.payloadDigestSha256,
      nowIso,
    });
    const awaiting = await submitForHumanApprovalAtomic(d1, {
      orgId: 'org_inngest',
      requestId: preflighted!.requestId,
      actorUserId: 'user_1',
      expectedVersion: preflighted!.version,
      payloadDigestSha256: preflighted!.payloadDigestSha256,
      expiresAtIso: new Date(nowMs + 72 * 60 * 60 * 1000).toISOString(),
      nowIso,
    });
    return awaiting!;
  }

  beforeEach(async () => {
    vi.stubGlobal('fetch', fetchSpy);
    d1 = new NodeSqliteD1Database(':memory:');
    await d1.exec(B2_MIGRATION_SQL);
    nowMs = Date.parse('2026-11-22T12:00:00.000Z');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('37. completes SIMULATED_PUBLISHED when D1 ledger is APPROVED on wake-up', async () => {
    const awaiting = await seedAwaiting();
    await consumeHumanDecisionAtomic(d1, {
      orgId: awaiting.orgId,
      requestId: awaiting.requestId,
      approverUserId: 'admin_1',
      approvalNonce: awaiting.approvalNonce!,
      expectedPayloadDigest: awaiting.payloadDigestSha256,
      expectedApprovalVersion: awaiting.approvalVersion,
      decision: 'approved',
      nowIso: new Date(nowMs).toISOString(),
    });

    const step = makeStep({
      data: {
        requestId: awaiting.requestId,
        orgId: awaiting.orgId,
        approverUserId: 'admin_1',
        approvalNonce: awaiting.approvalNonce!,
        payloadDigestSha256: awaiting.payloadDigestSha256,
        approvalVersion: awaiting.approvalVersion,
        decision: 'approved',
        publicationMode: 'MOCK_ONLY',
      },
    });

    const result = await runB2PublishGateWorkflowCore({
      d1,
      eventData: {
        requestId: awaiting.requestId,
        orgId: awaiting.orgId,
        payloadDigestSha256: awaiting.payloadDigestSha256,
        publicationMode: 'MOCK_ONLY',
      },
      step,
      nowMs: () => nowMs,
    });

    expect(result.outcome).toBe('SIMULATED_PUBLISHED');
    expect(result.receipt?.publicUrl).toBeNull();
    expect(step.waitForEvent).toHaveBeenCalledWith(
      'b2-wait-human-approval',
      expect.objectContaining({ event: 'campaign/publish.human_approved', timeout: '72h' }),
    );
  });

  it('38. expires AWAITING_HUMAN_APPROVAL to APPROVAL_EXPIRED when 72h waitForEvent times out (null)', async () => {
    const awaiting = await seedAwaiting();
    const step = makeStep(null);

    const result = await runB2PublishGateWorkflowCore({
      d1,
      eventData: {
        requestId: awaiting.requestId,
        orgId: awaiting.orgId,
        payloadDigestSha256: awaiting.payloadDigestSha256,
        publicationMode: 'MOCK_ONLY',
      },
      step,
      nowMs: () => nowMs + 72 * 60 * 60 * 1000 + 5000,
    });

    expect(result.outcome).toBe('APPROVAL_EXPIRED');
    const stored = await getPublishGateById(d1, awaiting.orgId, awaiting.requestId);
    expect(stored?.state).toBe('APPROVAL_EXPIRED');
  });

  it('39. blocks forged wake-up event when D1 ledger was never approved', async () => {
    const awaiting = await seedAwaiting();
    const step = makeStep({
      data: {
        requestId: awaiting.requestId,
        orgId: awaiting.orgId,
        approverUserId: 'attacker',
        approvalNonce: 'forged_nonce',
        payloadDigestSha256: awaiting.payloadDigestSha256,
        approvalVersion: 1,
        decision: 'approved',
        publicationMode: 'MOCK_ONLY',
      },
    });

    const result = await runB2PublishGateWorkflowCore({
      d1,
      eventData: {
        requestId: awaiting.requestId,
        orgId: awaiting.orgId,
        payloadDigestSha256: awaiting.payloadDigestSha256,
        publicationMode: 'MOCK_ONLY',
      },
      step,
      nowMs: () => nowMs,
    });

    expect(result.outcome).toBe('BLOCKED');
    expect(result.reason).toContain('LEDGER_STATE_NOT_APPROVED');
  });

  it('40. blocks execution when payload was mutated after gate request', async () => {
    const awaiting = await seedAwaiting();
    await mutatePayloadInvalidateApprovalAtomic(d1, {
      orgId: awaiting.orgId,
      requestId: awaiting.requestId,
      actorUserId: 'user_1',
      expectedVersion: awaiting.version,
      expectedState: awaiting.state,
      nextPayload: makePayload({ caption: 'Tampered after request' }),
      nowIso: new Date(nowMs).toISOString(),
    });

    const step = makeStep({
      data: {
        requestId: awaiting.requestId,
        orgId: awaiting.orgId,
        approverUserId: 'admin_1',
        approvalNonce: awaiting.approvalNonce!,
        payloadDigestSha256: awaiting.payloadDigestSha256,
        approvalVersion: 1,
        decision: 'approved',
        publicationMode: 'MOCK_ONLY',
      },
    });

    const result = await runB2PublishGateWorkflowCore({
      d1,
      eventData: {
        requestId: awaiting.requestId,
        orgId: awaiting.orgId,
        payloadDigestSha256: awaiting.payloadDigestSha256,
        publicationMode: 'MOCK_ONLY',
      },
      step,
      nowMs: () => nowMs,
    });
    expect(result.outcome).toBe('BLOCKED');
  });

  it('41. expires APPROVED record if 72h window elapsed before workflow claim', async () => {
    const awaiting = await seedAwaiting();
    await consumeHumanDecisionAtomic(d1, {
      orgId: awaiting.orgId,
      requestId: awaiting.requestId,
      approverUserId: 'admin_1',
      approvalNonce: awaiting.approvalNonce!,
      expectedPayloadDigest: awaiting.payloadDigestSha256,
      expectedApprovalVersion: awaiting.approvalVersion,
      decision: 'approved',
      nowIso: new Date(nowMs).toISOString(),
    });

    const step = makeStep({
      data: {
        requestId: awaiting.requestId,
        orgId: awaiting.orgId,
        approverUserId: 'admin_1',
        approvalNonce: awaiting.approvalNonce!,
        payloadDigestSha256: awaiting.payloadDigestSha256,
        approvalVersion: 1,
        decision: 'approved',
        publicationMode: 'MOCK_ONLY',
      },
    });

    const result = await runB2PublishGateWorkflowCore({
      d1,
      eventData: {
        requestId: awaiting.requestId,
        orgId: awaiting.orgId,
        payloadDigestSha256: awaiting.payloadDigestSha256,
        publicationMode: 'MOCK_ONLY',
      },
      step,
      nowMs: () => nowMs + 72 * 60 * 60 * 1000 + 1000,
    });

    expect(result.outcome).toBe('APPROVAL_EXPIRED');
    const stored = await getPublishGateById(d1, awaiting.orgId, awaiting.requestId);
    expect(stored?.state).toBe('APPROVAL_EXPIRED');
  });

  it('42. returns existing receipt idempotently if already SIMULATED_PUBLISHED', async () => {
    const awaiting = await seedAwaiting();
    await consumeHumanDecisionAtomic(d1, {
      orgId: awaiting.orgId,
      requestId: awaiting.requestId,
      approverUserId: 'admin_1',
      approvalNonce: awaiting.approvalNonce!,
      expectedPayloadDigest: awaiting.payloadDigestSha256,
      expectedApprovalVersion: awaiting.approvalVersion,
      decision: 'approved',
      nowIso: new Date(nowMs).toISOString(),
    });

    const step = makeStep({
      data: {
        requestId: awaiting.requestId,
        orgId: awaiting.orgId,
        approverUserId: 'admin_1',
        approvalNonce: awaiting.approvalNonce!,
        payloadDigestSha256: awaiting.payloadDigestSha256,
        approvalVersion: 1,
        decision: 'approved',
        publicationMode: 'MOCK_ONLY',
      },
    });

    const first = await runB2PublishGateWorkflowCore({
      d1,
      eventData: {
        requestId: awaiting.requestId,
        orgId: awaiting.orgId,
        payloadDigestSha256: awaiting.payloadDigestSha256,
        publicationMode: 'MOCK_ONLY',
      },
      step,
      nowMs: () => nowMs,
    });
    const second = await runB2PublishGateWorkflowCore({
      d1,
      eventData: {
        requestId: awaiting.requestId,
        orgId: awaiting.orgId,
        payloadDigestSha256: awaiting.payloadDigestSha256,
        publicationMode: 'MOCK_ONLY',
      },
      step,
      nowMs: () => nowMs,
    });

    expect(first.outcome).toBe('SIMULATED_PUBLISHED');
    expect(second.outcome).toBe('SIMULATED_PUBLISHED');
    expect(second.reason).toBe('ALREADY_EXECUTED');
    expect(second.receipt?.mockReceiptId).toBe(first.receipt?.mockReceiptId);
  });

  it('43. blocks workflow if eventData attempts non-MOCK_ONLY publicationMode', async () => {
    const step = makeStep(null);
    const result = await runB2PublishGateWorkflowCore({
      d1,
      eventData: {
        requestId: 'req_bad',
        orgId: 'org_inngest',
        payloadDigestSha256: 'v1:sha256:bad',
        publicationMode: 'PRODUCTION' as unknown as 'MOCK_ONLY',
      },
      step,
      nowMs: () => nowMs,
    });
    expect(result.outcome).toBe('BLOCKED');
    expect(result.reason).toBe('PUBLICATION_MODE_MUST_BE_MOCK_ONLY');
  });

  it('44. blocks workflow cleanly when ledger record does not exist for orgId', async () => {
    const step = makeStep({
      data: {
        requestId: 'req_missing',
        orgId: 'org_other',
        approverUserId: 'admin_1',
        approvalNonce: 'nonce_1',
        payloadDigestSha256: 'v1:sha256:missing',
        approvalVersion: 1,
        decision: 'approved',
        publicationMode: 'MOCK_ONLY',
      },
    });
    const result = await runB2PublishGateWorkflowCore({
      d1,
      eventData: {
        requestId: 'req_missing',
        orgId: 'org_other',
        payloadDigestSha256: 'v1:sha256:missing',
        publicationMode: 'MOCK_ONLY',
      },
      step,
      nowMs: () => nowMs,
    });
    expect(result.outcome).toBe('BLOCKED');
    expect(result.reason).toBe('LEDGER_RECORD_NOT_FOUND');
  });

  it('45. stale v1 72h timeout does not expire a newer re-submitted v2 approval', async () => {
    const v1 = await seedAwaiting();

    const mutated = await mutatePayloadInvalidateApprovalAtomic(d1, {
      orgId: v1.orgId,
      requestId: v1.requestId,
      actorUserId: 'user_1',
      expectedVersion: v1.version,
      expectedState: v1.state,
      nextPayload: makePayload({ caption: 'Updated v2 caption' }),
      nowIso: new Date(nowMs + 1000).toISOString(),
    });
    expect(mutated).not.toBeNull();

    const pre = await recordPreflightOutcomeAtomic(d1, {
      orgId: v1.orgId,
      requestId: v1.requestId,
      actorUserId: 'user_1',
      expectedVersion: mutated!.version,
      expectedState: mutated!.state,
      passed: true,
      snapshot: {
        platform: 'tiktok',
        capabilityStatus: 'RESTRICTED',
        verifiedDate: '2026-11-22',
        isAuditedApp: false,
        allowedPrivacyOptions: ['SELF_ONLY'],
        maxVideoDurationSec: 600,
        commentDisabled: false,
        duetDisabled: false,
        stitchDisabled: false,
        dailyPublishLimit: 5,
        dailyPublishUsed: 0,
        requiredScopes: ['video.publish'],
        warnings: [],
        blockReasons: [],
      },
      payloadDigestSha256: mutated!.payloadDigestSha256,
      nowIso: new Date(nowMs + 2000).toISOString(),
    });

    const v2ExpiresAt = new Date(nowMs + 100 * 60 * 60 * 1000).toISOString();
    const v2 = await submitForHumanApprovalAtomic(d1, {
      orgId: v1.orgId,
      requestId: v1.requestId,
      actorUserId: 'user_1',
      expectedVersion: pre!.version,
      payloadDigestSha256: pre!.payloadDigestSha256,
      expiresAtIso: v2ExpiresAt,
      nowIso: new Date(nowMs + 3000).toISOString(),
    });
    expect(v2!.approvalVersion).toBe(2);

    const staleStep = makeStep(null);
    await runB2PublishGateWorkflowCore({
      d1,
      eventData: {
        requestId: v1.requestId,
        orgId: v1.orgId,
        payloadDigestSha256: v1.payloadDigestSha256,
        approvalVersion: v1.approvalVersion,
        publicationMode: 'MOCK_ONLY',
      },
      step: staleStep,
      nowMs: () => nowMs + 72 * 60 * 60 * 1000 + 5000,
    });

    const after = await getPublishGateById(d1, v1.orgId, v1.requestId);
    expect(after?.state).toBe('AWAITING_HUMAN_APPROVAL');
    expect(after?.approvalVersion).toBe(2);
  });

  it('46. blocks stale v1 human_approved wake-up after mutate-and-revert to identical digest at v3', async () => {
    const v1 = await seedAwaiting();

    // Mutate v1 -> v2 (different caption), then revert v2 -> v3 (identical digest to v1)
    const v2 = await mutatePayloadInvalidateApprovalAtomic(d1, {
      orgId: v1.orgId,
      requestId: v1.requestId,
      actorUserId: 'user_1',
      expectedVersion: v1.version,
      expectedState: v1.state,
      nextPayload: makePayload({ caption: 'Temporary edit v2' }),
      nowIso: new Date(nowMs + 1000).toISOString(),
    });
    const v3 = await mutatePayloadInvalidateApprovalAtomic(d1, {
      orgId: v1.orgId,
      requestId: v1.requestId,
      actorUserId: 'user_1',
      expectedVersion: v2!.version,
      expectedState: v2!.state,
      nextPayload: makePayload(),
      nowIso: new Date(nowMs + 2000).toISOString(),
    });
    expect(v3!.approvalVersion).toBe(3);
    expect(v3!.payloadDigestSha256).toBe(v1.payloadDigestSha256);

    const evalRes = getMockPublishGateAdapter('tiktok').preflight({ payload: v3!.payload });
    const pre3 = await recordPreflightOutcomeAtomic(d1, {
      orgId: v1.orgId,
      requestId: v1.requestId,
      actorUserId: 'user_1',
      expectedVersion: v3!.version,
      expectedState: v3!.state,
      passed: evalRes.passed,
      snapshot: evalRes.snapshot,
      payloadDigestSha256: v3!.payloadDigestSha256,
      nowIso: new Date(nowMs + 3000).toISOString(),
    });
    const awaiting3 = await submitForHumanApprovalAtomic(d1, {
      orgId: v1.orgId,
      requestId: v1.requestId,
      actorUserId: 'user_1',
      expectedVersion: pre3!.version,
      payloadDigestSha256: pre3!.payloadDigestSha256,
      expiresAtIso: new Date(nowMs + 72 * 60 * 60 * 1000).toISOString(),
      nowIso: new Date(nowMs + 4000).toISOString(),
    });
    await consumeHumanDecisionAtomic(d1, {
      orgId: awaiting3!.orgId,
      requestId: awaiting3!.requestId,
      approverUserId: 'admin_v3',
      approvalNonce: awaiting3!.approvalNonce!,
      expectedPayloadDigest: awaiting3!.payloadDigestSha256,
      expectedApprovalVersion: awaiting3!.approvalVersion,
      decision: 'approved',
      nowIso: new Date(nowMs + 5000).toISOString(),
    });

    const staleStep = makeStep({
      data: {
        requestId: v1.requestId,
        orgId: v1.orgId,
        approverUserId: 'admin_v1_stale',
        approvalNonce: v1.approvalNonce!,
        payloadDigestSha256: v1.payloadDigestSha256,
        approvalVersion: v1.approvalVersion,
        decision: 'approved',
        publicationMode: 'MOCK_ONLY',
      },
    });

    const result = await runB2PublishGateWorkflowCore({
      d1,
      eventData: {
        requestId: v1.requestId,
        orgId: v1.orgId,
        payloadDigestSha256: v1.payloadDigestSha256,
        approvalVersion: v1.approvalVersion,
        publicationMode: 'MOCK_ONLY',
      },
      step: staleStep,
      nowMs: () => nowMs + 6000,
    });

    expect(result.outcome).toBe('BLOCKED');
    expect(result.reason).toBe('APPROVAL_VERSION_MISMATCH');
    expect(staleStep.waitForEvent).toHaveBeenCalledWith(
      'b2-wait-human-approval',
      expect.objectContaining({
        if: expect.stringContaining('async.data.approvalVersion == event.data.approvalVersion'),
      }),
    );
    const stored = await getPublishGateById(d1, v1.orgId, v1.requestId);
    expect(stored?.state).toBe('APPROVED');
    expect(stored?.executionClaimId).toBeNull();
  });

  it('47. blocks wake-up event with rejected decision or mismatched approvalNonce', async () => {
    const awaiting = await seedAwaiting();
    await consumeHumanDecisionAtomic(d1, {
      orgId: awaiting.orgId,
      requestId: awaiting.requestId,
      approverUserId: 'admin_1',
      approvalNonce: awaiting.approvalNonce!,
      expectedPayloadDigest: awaiting.payloadDigestSha256,
      expectedApprovalVersion: awaiting.approvalVersion,
      decision: 'approved',
      nowIso: new Date(nowMs).toISOString(),
    });

    const rejectedEventRes = await runB2PublishGateWorkflowCore({
      d1,
      eventData: {
        requestId: awaiting.requestId,
        orgId: awaiting.orgId,
        payloadDigestSha256: awaiting.payloadDigestSha256,
        approvalVersion: awaiting.approvalVersion,
        publicationMode: 'MOCK_ONLY',
      },
      step: makeStep({
        data: {
          requestId: awaiting.requestId,
          orgId: awaiting.orgId,
          approverUserId: 'admin_1',
          approvalNonce: awaiting.approvalNonce!,
          payloadDigestSha256: awaiting.payloadDigestSha256,
          approvalVersion: awaiting.approvalVersion,
          decision: 'rejected',
          publicationMode: 'MOCK_ONLY',
        },
      }),
      nowMs: () => nowMs,
    });
    expect(rejectedEventRes.outcome).toBe('BLOCKED');
    expect(rejectedEventRes.reason).toBe('EVENT_DECISION_NOT_APPROVED');

    const badNonceRes = await runB2PublishGateWorkflowCore({
      d1,
      eventData: {
        requestId: awaiting.requestId,
        orgId: awaiting.orgId,
        payloadDigestSha256: awaiting.payloadDigestSha256,
        approvalVersion: awaiting.approvalVersion,
        publicationMode: 'MOCK_ONLY',
      },
      step: makeStep({
        data: {
          requestId: awaiting.requestId,
          orgId: awaiting.orgId,
          approverUserId: 'admin_1',
          approvalNonce: 'forged_or_stale_nonce',
          payloadDigestSha256: awaiting.payloadDigestSha256,
          approvalVersion: awaiting.approvalVersion,
          decision: 'approved',
          publicationMode: 'MOCK_ONLY',
        },
      }),
      nowMs: () => nowMs,
    });
    expect(badNonceRes.outcome).toBe('BLOCKED');
    expect(badNonceRes.reason).toBe('APPROVAL_NONCE_MISMATCH');
  });

  it('48. rejects delayed v1 approval after v1->v2->v3 mutate-and-revert until v3 is explicitly approved', async () => {
    const v1 = await seedAwaiting();
    await consumeHumanDecisionAtomic(d1, {
      orgId: v1.orgId,
      requestId: v1.requestId,
      approverUserId: 'admin_v1',
      approvalNonce: v1.approvalNonce!,
      expectedPayloadDigest: v1.payloadDigestSha256,
      expectedApprovalVersion: v1.approvalVersion,
      decision: 'approved',
      nowIso: new Date(nowMs + 500).toISOString(),
    });
    const approvedV1 = await getPublishGateById(d1, v1.orgId, v1.requestId);

    const v2 = await mutatePayloadInvalidateApprovalAtomic(d1, {
      orgId: v1.orgId,
      requestId: v1.requestId,
      actorUserId: 'admin_v1',
      expectedVersion: approvedV1!.version,
      expectedState: approvedV1!.state,
      nextPayload: makePayload({ caption: 'Mutated v2 caption' }),
      nowIso: new Date(nowMs + 1000).toISOString(),
    });
    const v3 = await mutatePayloadInvalidateApprovalAtomic(d1, {
      orgId: v1.orgId,
      requestId: v1.requestId,
      actorUserId: 'admin_v1',
      expectedVersion: v2!.version,
      expectedState: v2!.state,
      nextPayload: makePayload(),
      nowIso: new Date(nowMs + 2000).toISOString(),
    });
    expect(v3!.approvalVersion).toBe(3);
    expect(v3!.payloadDigestSha256).toBe(v1.payloadDigestSha256);

    // Delayed v1 event arrives while v3 has not yet been re-approved
    const blockedUnapproved = await runB2PublishGateWorkflowCore({
      d1,
      eventData: {
        requestId: v1.requestId,
        orgId: v1.orgId,
        payloadDigestSha256: v1.payloadDigestSha256,
        approvalVersion: v1.approvalVersion,
        publicationMode: 'MOCK_ONLY',
      },
      step: makeStep({
        data: {
          requestId: v1.requestId,
          orgId: v1.orgId,
          approverUserId: 'admin_v1',
          approvalNonce: v1.approvalNonce!,
          payloadDigestSha256: v1.payloadDigestSha256,
          approvalVersion: v1.approvalVersion,
          decision: 'approved',
          publicationMode: 'MOCK_ONLY',
        },
      }),
      nowMs: () => nowMs + 2500,
    });
    expect(blockedUnapproved.outcome).toBe('BLOCKED');
    expect(blockedUnapproved.receipt).toBeUndefined();

    // Direct CAS claim with stale v1 approvalVersion also fails closed
    const staleClaim = await claimMockExecutionAtomic(d1, {
      orgId: v1.orgId,
      requestId: v1.requestId,
      actorUserId: 'admin_v1',
      expectedPayloadDigest: v1.payloadDigestSha256,
      expectedVersion: v3!.version,
      expectedApprovalVersion: v1.approvalVersion,
      nowIso: new Date(nowMs + 2600).toISOString(),
    });
    expect(staleClaim).toBeNull();

    // Fresh explicit approval on v3 succeeds
    const evalRes = getMockPublishGateAdapter('tiktok').preflight({ payload: v3!.payload });
    const pre3 = await recordPreflightOutcomeAtomic(d1, {
      orgId: v1.orgId,
      requestId: v1.requestId,
      actorUserId: 'user_1',
      expectedVersion: v3!.version,
      expectedState: v3!.state,
      passed: evalRes.passed,
      snapshot: evalRes.snapshot,
      payloadDigestSha256: v3!.payloadDigestSha256,
      nowIso: new Date(nowMs + 3000).toISOString(),
    });
    const awaiting3 = await submitForHumanApprovalAtomic(d1, {
      orgId: v1.orgId,
      requestId: v1.requestId,
      actorUserId: 'user_1',
      expectedVersion: pre3!.version,
      payloadDigestSha256: pre3!.payloadDigestSha256,
      expiresAtIso: new Date(nowMs + 72 * 60 * 60 * 1000).toISOString(),
      nowIso: new Date(nowMs + 4000).toISOString(),
    });
    await consumeHumanDecisionAtomic(d1, {
      orgId: awaiting3!.orgId,
      requestId: awaiting3!.requestId,
      approverUserId: 'admin_v3',
      approvalNonce: awaiting3!.approvalNonce!,
      expectedPayloadDigest: awaiting3!.payloadDigestSha256,
      expectedApprovalVersion: awaiting3!.approvalVersion,
      decision: 'approved',
      nowIso: new Date(nowMs + 5000).toISOString(),
    });
    const freshV3Res = await runB2PublishGateWorkflowCore({
      d1,
      eventData: {
        requestId: awaiting3!.requestId,
        orgId: awaiting3!.orgId,
        payloadDigestSha256: awaiting3!.payloadDigestSha256,
        approvalVersion: awaiting3!.approvalVersion,
        publicationMode: 'MOCK_ONLY',
      },
      step: makeStep({
        data: {
          requestId: awaiting3!.requestId,
          orgId: awaiting3!.orgId,
          approverUserId: 'admin_v3',
          approvalNonce: awaiting3!.approvalNonce!,
          payloadDigestSha256: awaiting3!.payloadDigestSha256,
          approvalVersion: awaiting3!.approvalVersion,
          decision: 'approved',
          publicationMode: 'MOCK_ONLY',
        },
      }),
      nowMs: () => nowMs + 6000,
    });
    expect(freshV3Res.outcome).toBe('SIMULATED_PUBLISHED');
  });

  it('49. rejects unauthorized cross-tenant event and mismatched event digest fail-closed', async () => {
    const awaiting = await seedAwaiting();
    await consumeHumanDecisionAtomic(d1, {
      orgId: awaiting.orgId,
      requestId: awaiting.requestId,
      approverUserId: 'admin_1',
      approvalNonce: awaiting.approvalNonce!,
      expectedPayloadDigest: awaiting.payloadDigestSha256,
      expectedApprovalVersion: awaiting.approvalVersion,
      decision: 'approved',
      nowIso: new Date(nowMs).toISOString(),
    });

    // Different org referencing the same requestId fails closed
    const crossTenantEventRes = await runB2PublishGateWorkflowCore({
      d1,
      eventData: {
        requestId: awaiting.requestId,
        orgId: awaiting.orgId,
        payloadDigestSha256: awaiting.payloadDigestSha256,
        approvalVersion: awaiting.approvalVersion,
        publicationMode: 'MOCK_ONLY',
      },
      step: makeStep({
        data: {
          requestId: awaiting.requestId,
          orgId: 'org_unauthorized_other',
          approverUserId: 'attacker_admin',
          approvalNonce: awaiting.approvalNonce!,
          payloadDigestSha256: awaiting.payloadDigestSha256,
          approvalVersion: awaiting.approvalVersion,
          decision: 'approved',
          publicationMode: 'MOCK_ONLY',
        },
      }),
      nowMs: () => nowMs,
    });
    expect(crossTenantEventRes.outcome).toBe('BLOCKED');
    expect(crossTenantEventRes.reason).toBe('EVENT_IDENTITY_MISMATCH');

    // Mismatched digest on approvalEvent fails closed
    const badEventDigestRes = await runB2PublishGateWorkflowCore({
      d1,
      eventData: {
        requestId: awaiting.requestId,
        orgId: awaiting.orgId,
        payloadDigestSha256: awaiting.payloadDigestSha256,
        approvalVersion: awaiting.approvalVersion,
        publicationMode: 'MOCK_ONLY',
      },
      step: makeStep({
        data: {
          requestId: awaiting.requestId,
          orgId: awaiting.orgId,
          approverUserId: 'admin_1',
          approvalNonce: awaiting.approvalNonce!,
          payloadDigestSha256: 'sha256:0000000000000000000000000000000000000000000000000000000000000000',
          approvalVersion: awaiting.approvalVersion,
          decision: 'approved',
          publicationMode: 'MOCK_ONLY',
        },
      }),
      nowMs: () => nowMs,
    });
    expect(badEventDigestRes.outcome).toBe('BLOCKED');
    expect(badEventDigestRes.reason).toBe('LEDGER_DIGEST_CHANGED_AFTER_REQUEST');

    const stored = await getPublishGateById(d1, awaiting.orgId, awaiting.requestId);
    expect(stored?.state).toBe('APPROVED');
    expect(stored?.executionClaimId).toBeNull();
  });

  it('50. enforces single durable SQL claim under concurrent racing claims and across worker restart', async () => {
    const awaiting = await seedAwaiting();
    // Simulate Worker restart before approval: fresh read from durable D1 recovers awaiting state
    const afterRestartBeforeApproval = await getPublishGateById(d1, awaiting.orgId, awaiting.requestId);
    expect(afterRestartBeforeApproval?.state).toBe('AWAITING_HUMAN_APPROVAL');

    const approved = await consumeHumanDecisionAtomic(d1, {
      orgId: afterRestartBeforeApproval!.orgId,
      requestId: afterRestartBeforeApproval!.requestId,
      approverUserId: 'admin_1',
      approvalNonce: afterRestartBeforeApproval!.approvalNonce!,
      expectedPayloadDigest: afterRestartBeforeApproval!.payloadDigestSha256,
      expectedApprovalVersion: afterRestartBeforeApproval!.approvalVersion,
      decision: 'approved',
      nowIso: new Date(nowMs).toISOString(),
    });
    expect(approved?.state).toBe('APPROVED');

    // Concurrent SQL claims race on the exact same APPROVED row: exactly one wins
    const [claimA, claimB] = await Promise.all([
      claimMockExecutionAtomic(d1, {
        orgId: approved!.orgId,
        requestId: approved!.requestId,
        actorUserId: 'admin_1',
        expectedPayloadDigest: approved!.payloadDigestSha256,
        expectedVersion: approved!.version,
        expectedApprovalVersion: approved!.approvalVersion,
        nowIso: new Date(nowMs + 100).toISOString(),
      }),
      claimMockExecutionAtomic(d1, {
        orgId: approved!.orgId,
        requestId: approved!.requestId,
        actorUserId: 'admin_1',
        expectedPayloadDigest: approved!.payloadDigestSha256,
        expectedVersion: approved!.version,
        expectedApprovalVersion: approved!.approvalVersion,
        nowIso: new Date(nowMs + 100).toISOString(),
      }),
    ]);

    const winners = [claimA, claimB].filter((c) => c !== null);
    expect(winners).toHaveLength(1);
    expect(winners[0]!.record.state).toBe('MOCK_EXECUTION_CLAIMED');

    // Simulate Worker restart after approval event while already claimed: racing workflow is blocked
    const racingWorkflowRes = await runB2PublishGateWorkflowCore({
      d1,
      eventData: {
        requestId: approved!.requestId,
        orgId: approved!.orgId,
        payloadDigestSha256: approved!.payloadDigestSha256,
        approvalVersion: approved!.approvalVersion,
        publicationMode: 'MOCK_ONLY',
      },
      step: makeStep({
        data: {
          requestId: approved!.requestId,
          orgId: approved!.orgId,
          approverUserId: 'admin_1',
          approvalNonce: awaiting.approvalNonce!,
          payloadDigestSha256: approved!.payloadDigestSha256,
          approvalVersion: approved!.approvalVersion,
          decision: 'approved',
          publicationMode: 'MOCK_ONLY',
        },
      }),
      nowMs: () => nowMs + 200,
    });
    expect(racingWorkflowRes.outcome).toBe('BLOCKED');
    expect(racingWorkflowRes.reason).toBe('LEDGER_STATE_NOT_APPROVED:MOCK_EXECUTION_CLAIMED');
  });

  it('51. fails closed on D1 error before or during claim and succeeds cleanly on subsequent retry', async () => {
    const awaiting = await seedAwaiting();
    await consumeHumanDecisionAtomic(d1, {
      orgId: awaiting.orgId,
      requestId: awaiting.requestId,
      approverUserId: 'admin_1',
      approvalNonce: awaiting.approvalNonce!,
      expectedPayloadDigest: awaiting.payloadDigestSha256,
      expectedApprovalVersion: awaiting.approvalVersion,
      decision: 'approved',
      nowIso: new Date(nowMs).toISOString(),
    });

    const failingReadD1 = {
      prepare: () => {
        throw new Error('D1_TRANSIENT_READ_FAILURE');
      },
    } as unknown as D1Database;

    const approvalEventPayload = {
      data: {
        requestId: awaiting.requestId,
        orgId: awaiting.orgId,
        approverUserId: 'admin_1',
        approvalNonce: awaiting.approvalNonce!,
        payloadDigestSha256: awaiting.payloadDigestSha256,
        approvalVersion: awaiting.approvalVersion,
        decision: 'approved' as const,
        publicationMode: 'MOCK_ONLY' as const,
      },
    };

    await expect(
      runB2PublishGateWorkflowCore({
        d1: failingReadD1,
        eventData: {
          requestId: awaiting.requestId,
          orgId: awaiting.orgId,
          payloadDigestSha256: awaiting.payloadDigestSha256,
          approvalVersion: awaiting.approvalVersion,
          publicationMode: 'MOCK_ONLY',
        },
        step: makeStep(approvalEventPayload),
        nowMs: () => nowMs,
      }),
    ).rejects.toThrow('D1_TRANSIENT_READ_FAILURE');

    const failingClaimD1 = {
      prepare: (sql: string) => {
        if (sql.includes("SET state = 'MOCK_EXECUTION_CLAIMED'")) {
          throw new Error('D1_TRANSIENT_CLAIM_FAILURE');
        }
        return d1.prepare(sql);
      },
    } as unknown as D1Database;

    await expect(
      runB2PublishGateWorkflowCore({
        d1: failingClaimD1,
        eventData: {
          requestId: awaiting.requestId,
          orgId: awaiting.orgId,
          payloadDigestSha256: awaiting.payloadDigestSha256,
          approvalVersion: awaiting.approvalVersion,
          publicationMode: 'MOCK_ONLY',
        },
        step: makeStep(approvalEventPayload),
        nowMs: () => nowMs,
      }),
    ).rejects.toThrow('D1_TRANSIENT_CLAIM_FAILURE');

    // No partial claim or receipt persisted; retry on healthy D1 succeeds
    const stillApproved = await getPublishGateById(d1, awaiting.orgId, awaiting.requestId);
    expect(stillApproved?.state).toBe('APPROVED');
    expect(stillApproved?.executionClaimId).toBeNull();
    expect(stillApproved?.mockReceipt).toBeNull();

    const retryRes = await runB2PublishGateWorkflowCore({
      d1,
      eventData: {
        requestId: awaiting.requestId,
        orgId: awaiting.orgId,
        payloadDigestSha256: awaiting.payloadDigestSha256,
        approvalVersion: awaiting.approvalVersion,
        publicationMode: 'MOCK_ONLY',
      },
      step: makeStep(approvalEventPayload),
      nowMs: () => nowMs + 1000,
    });
    expect(retryRes.outcome).toBe('SIMULATED_PUBLISHED');
  });
});
