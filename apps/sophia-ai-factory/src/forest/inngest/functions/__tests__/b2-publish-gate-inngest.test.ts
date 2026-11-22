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
  consumeHumanDecisionAtomic,
  mutatePayloadInvalidateApprovalAtomic,
} from '@/tree/publish-gate/publish-gate-execution-repo';
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
});
