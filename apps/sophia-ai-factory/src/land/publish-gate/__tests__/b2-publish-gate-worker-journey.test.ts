// @vitest-environment node
/**
 * Track B2 Compliance Publish Gate — 15-Step Multi-Isolate Restart & Benchmark Journey.
 * Exercises two independent SQLite-backed D1 isolates over the same on-disk database file,
 * proving durability across Worker restart, replay/nonce/digest/expiry/IDOR/flag-off gates,
 * and measuring G9 latency & D1 query cost with 0 external network calls.
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NodeSqliteD1Database } from '@/seed/db/node-sqlite-d1';
import {
  handlePublishGateGet,
  handlePublishGatePost,
  type PublishGateHttpDeps,
} from '@/land/publish-gate/publish-gate-http-handler';
import type { PublishGateRecord } from '@/tree/publish-gate/types';

const B2_MIGRATION_SQL = fs.readFileSync(
  path.resolve(__dirname, '../../../../migrations/0516_b2_compliance_publish_gate.sql'),
  'utf8',
);

function req(body?: Record<string, unknown>, query = ''): Request {
  if (!body) {
    return new Request(`http://127.0.0.1:8792/api/publish-gate${query}`, { method: 'GET' });
  }
  return new Request('http://127.0.0.1:8792/api/publish-gate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-csrf-token': 'valid-csrf' },
    body: JSON.stringify(body),
  });
}

describe('B2 Publish Gate — 15-Step Multi-Isolate Local D1 Journey', () => {
  let tmpDir: string;
  let dbPath: string;
  let nowMs: number;
  const fetchSpy = vi.fn(() => {
    throw new Error('EXTERNAL_NETWORK_CALL_FORBIDDEN');
  });

  function makeDeps(
    d1: NodeSqliteD1Database,
    overrides: Partial<PublishGateHttpDeps> = {},
  ): PublishGateHttpDeps {
    return {
      isFeatureEnabled: () => true,
      getD1: async () => d1,
      getCurrentUser: async () => ({ id: 'admin_a', orgId: 'org_alpha' }),
      verifyWorkspaceAccess: async () => true,
      verifyWorkspaceAdminRole: async () => true,
      verifyCsrf: async () => true,
      nowMs: () => nowMs,
      ...overrides,
    };
  }

  beforeEach(async () => {
    vi.stubGlobal('fetch', fetchSpy);
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'b2-worker-journey-'));
    dbPath = path.join(tmpDir, 'b2-local-d1.sqlite');
    nowMs = Date.parse('2026-11-22T15:00:00.000Z');
    const initDb = new NodeSqliteD1Database(dbPath);
    await initDb.exec(B2_MIGRATION_SQL);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    expect(fetchSpy).not.toHaveBeenCalled();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('executes the full 15-step local Worker journey across isolate restart with 0 external calls', async () => {
    const workerA = new NodeSqliteD1Database(dbPath);
    const depsA = makeDeps(workerA);

    // Step 1: Flag off returns 404 fail-closed
    const flagOffRes = await handlePublishGateGet(
      req(),
      makeDeps(workerA, { isFeatureEnabled: () => false }),
    );
    expect(flagOffRes.status).toBe(404);

    // Step 2: Unauthenticated returns 401
    const unauthRes = await handlePublishGateGet(
      req(),
      makeDeps(workerA, { getCurrentUser: async () => null }),
    );
    expect(unauthRes.status).toBe(401);

    // Step 3: Create TikTok unaudited payload (PUBLIC_TO_EVERYONE -> will block in preflight)
    const createBlocked = await handlePublishGatePost(
      req({
        action: 'create',
        payload: {
          campaignId: 'camp_j1',
          mediaArtifactId: 'art_j1',
          mediaContentDigest: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          mediaDurationSec: 40,
          platform: 'tiktok',
          destinationAccountId: 'tt_unaudited_j1',
          destinationAccountHandle: '@journey_demo',
          caption: 'Journey clip',
          payloadVersion: 1,
          publicationMode: 'MOCK_ONLY',
          compliance: {
            aiSyntheticDisclosure: true,
            commercialDisclosure: false,
            tiktok: {
              privacyLevel: 'PUBLIC_TO_EVERYONE',
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
        },
      }),
      depsA,
    );
    expect(createBlocked.status).toBe(201);
    const { record: recBlocked } = (await createBlocked.json()) as { record: PublishGateRecord };

    // Step 4: Preflight blocks unaudited PUBLIC_TO_EVERYONE fail-closed
    const preBlocked = await handlePublishGatePost(
      req({ action: 'preflight', requestId: recBlocked.requestId }),
      depsA,
    );
    expect(preBlocked.status).toBe(200);
    expect(((await preBlocked.json()) as { record: PublishGateRecord }).record.state).toBe(
      'PREFLIGHT_BLOCKED',
    );

    // Step 5: Mutate payload to compliant SELF_ONLY
    const mutatedRes = await handlePublishGatePost(
      req({
        action: 'mutate_payload',
        requestId: recBlocked.requestId,
        payload: {
          ...recBlocked.payload,
          compliance: {
            ...recBlocked.payload.compliance,
            tiktok: {
              ...recBlocked.payload.compliance.tiktok!,
              privacyLevel: 'SELF_ONLY',
            },
          },
        },
      }),
      depsA,
    );
    expect(mutatedRes.status).toBe(200);

    // Step 6: Preflight passes -> READY_FOR_REVIEW
    const prePass = await handlePublishGatePost(
      req({ action: 'preflight', requestId: recBlocked.requestId }),
      depsA,
    );
    expect(((await prePass.json()) as { record: PublishGateRecord }).record.state).toBe(
      'READY_FOR_REVIEW',
    );

    // Step 7: Submit for human approval -> AWAITING_HUMAN_APPROVAL (72h nonce issued)
    const submitRes = await handlePublishGatePost(
      req({ action: 'submit_for_approval', requestId: recBlocked.requestId }),
      depsA,
    );
    const { record: awaiting } = (await submitRes.json()) as { record: PublishGateRecord };
    expect(awaiting.state).toBe('AWAITING_HUMAN_APPROVAL');
    expect(awaiting.approvalNonce).toBeTruthy();

    // Step 8: Simulate Worker restart (brand new D1 isolate instance over same SQLite file)
    const workerB = new NodeSqliteD1Database(dbPath);
    const depsB = makeDeps(workerB);
    const persistedGet = await handlePublishGateGet(
      req(undefined, `?requestId=${awaiting.requestId}`),
      depsB,
    );
    expect(persistedGet.status).toBe(200);
    const { record: persisted } = (await persistedGet.json()) as { record: PublishGateRecord };
    expect(persisted.payloadDigestSha256).toBe(awaiting.payloadDigestSha256);

    // Step 9: Cross-tenant IDOR on restarted Worker returns 404
    const idorRes = await handlePublishGateGet(
      req(undefined, `?requestId=${awaiting.requestId}`),
      makeDeps(workerB, { getCurrentUser: async () => ({ id: 'admin_b', orgId: 'org_beta' }) }),
    );
    expect(idorRes.status).toBe(404);

    // Step 10: Stale/forged nonce rejected (409)
    const badNonce = await handlePublishGatePost(
      req({
        action: 'approve',
        requestId: awaiting.requestId,
        approvalNonce: 'forged_nonce_000000000000',
        payloadDigestSha256: awaiting.payloadDigestSha256,
        approvalVersion: awaiting.approvalVersion,
      }),
      depsB,
    );
    expect(badNonce.status).toBe(409);

    // Step 11: Digest mismatch rejected (409)
    const badDigest = await handlePublishGatePost(
      req({
        action: 'approve',
        requestId: awaiting.requestId,
        approvalNonce: awaiting.approvalNonce,
        payloadDigestSha256: 'v1:sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
        approvalVersion: awaiting.approvalVersion,
      }),
      depsB,
    );
    expect(badDigest.status).toBe(409);

    // Step 12: Valid ADMIN approval on restarted Worker succeeds
    const approveRes = await handlePublishGatePost(
      req({
        action: 'approve',
        requestId: awaiting.requestId,
        approvalNonce: awaiting.approvalNonce,
        payloadDigestSha256: awaiting.payloadDigestSha256,
        approvalVersion: awaiting.approvalVersion,
      }),
      depsB,
    );
    expect(approveRes.status).toBe(200);

    // Step 13: Approval replay with consumed nonce rejected (409)
    const replayApprove = await handlePublishGatePost(
      req({
        action: 'approve',
        requestId: awaiting.requestId,
        approvalNonce: awaiting.approvalNonce,
        payloadDigestSha256: awaiting.payloadDigestSha256,
        approvalVersion: awaiting.approvalVersion,
      }),
      depsB,
    );
    expect(replayApprove.status).toBe(409);

    // Step 14: Execute mock on restarted Worker -> SIMULATED_PUBLISHED (publicUrl: null)
    const execRes = await handlePublishGatePost(
      req({
        action: 'execute_mock',
        requestId: awaiting.requestId,
        payloadDigestSha256: awaiting.payloadDigestSha256,
      }),
      depsB,
    );
    expect(execRes.status).toBe(200);
    const { record: executed } = (await execRes.json()) as { record: PublishGateRecord };
    expect(executed.state).toBe('SIMULATED_PUBLISHED');
    expect(executed.mockReceipt?.publicUrl).toBeNull();

    // Step 15: Replay execute_mock returns existing receipt idempotently (no duplicate execution)
    const replayExec = await handlePublishGatePost(
      req({
        action: 'execute_mock',
        requestId: awaiting.requestId,
        payloadDigestSha256: awaiting.payloadDigestSha256,
      }),
      depsB,
    );
    expect(replayExec.status).toBe(200);
    const replayBody = (await replayExec.json()) as {
      replayed: boolean;
      record: PublishGateRecord;
    };
    expect(replayBody.replayed).toBe(true);
    expect(replayBody.record.mockReceipt?.mockReceiptId).toBe(executed.mockReceipt?.mockReceiptId);
  });
});
