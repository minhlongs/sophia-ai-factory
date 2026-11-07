/**
 * Supreme Command #02.2 Regression Suite — T27 through T32
 * Cloudflare D1 Mekong 10/10 Store, HMAC-SHA256 Pull-Worker & GitHub Governance Level 1.
 */
import fs from 'node:fs';
import path from 'node:path';
import { NextRequest } from 'next/server';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { freshDb, makeD1 } from '@/__tests__/integration/shared-d1-shim';
import * as dbClient from '@/seed/db/client';
import type { D1Database } from '@/seed/db/client';
import { verifyCsrfToken } from '@/seed/security/csrf';
import { isPublicApiRoute } from '@/forest/middleware/guard/public-routes';
import { createOrGetConvergenceJobD1 } from '@/tree/convergence';
import { MEKONG_D1_BRIDGE_MODE, MEKONG_SIGNATURE_HEADER, MEKONG_TIMESTAMP_HEADER, MekongContractClient, getMekongContractCapabilityMatrix, signMekongWorkerPayload, verifyMekongWorkerHmac } from '@/tree/mekong';
import { runCreativeJobVerticalSliceD1 } from '@/forest/convergence/creative-job-d1-runner';
import { claimNextConvergenceJobD1, completeWorkerAttemptD1 } from '@/forest/convergence/mekong-pull-worker-d1';
import { POST } from '@/app/api/convergence/vertical-slice/route';
import { isWorkerPullActionRequest } from '@/app/api/convergence/vertical-slice/worker-route-handler';
import { buildProductionEnvironmentPayload, buildSoloFounderBranchProtectionPayload, verifyGovernanceWorkflowContracts } from '../../../scripts/configure-github-release-governance.mjs';

const MIGRATION_0494_SQL = fs.readFileSync(path.resolve(process.cwd(), 'migrations/0494_authoritative_job_convergence_ledger.sql'), 'utf8');
const MIGRATION_0495_SQL = fs.readFileSync(path.resolve(process.cwd(), 'migrations/0495_mekong_contract_tickets.sql'), 'utf8');

describe('Supreme Command #02.2 — T27..T32: D1 Mekong Store, HMAC Pull-Worker & GitHub Governance', () => {
  let d1: D1Database;

  beforeEach(() => {
    const raw = freshDb();
    raw.exec(MIGRATION_0494_SQL);
    raw.exec(MIGRATION_0495_SQL);
    d1 = makeD1(raw) as unknown as D1Database;
    vi.spyOn(dbClient, 'getD1').mockResolvedValue(d1);
  });

  it('T27 & T28: executes all 10 Mekong contract operations on Cloudflare D1 in ENABLED mode, fails closed without D1/SQLite, and runs 12-stage D1 slice in ENABLED mode', async () => {
    const client = new MekongContractClient({ mode: 'ENABLED', d1 });
    expect(client.getRealRuntimeVerificationStatus()).toBe('VERIFIED_D1_EDGE');
    const matrix = getMekongContractCapabilityMatrix({ d1Enabled: true });
    expect(matrix.every((m) => m.implementedThroughRealAuthorizedRuntime && m.realRuntimeStatus === 'VERIFIED_D1_EDGE')).toBe(true);

    const sub = await client.submitTaskAsync({
      source_id: 'sophia_t27', event_id: 'evt_t27_d1', goal: 'Execute 10 ops on D1', workspace_id: 'ws_alpha',
    });
    expect(sub.ok).toBe(true);
    if (!sub.ok) return;
    const tid = sub.value.ticket.ticket_id;
    expect((sub.value as unknown as { bridge_mode: string }).bridge_mode).toBe(MEKONG_D1_BRIDGE_MODE);

    for (const op of ['get_ticket', 'get_status', 'get_verification_evidence', 'get_artifacts', 'report_approval_required', 'resume_reconcile', 'list_durable_reports', 'get_cost_usage', 'request_cancel'] as const) {
      const r = await client.invokeOperationAsync(op, { ticket_id: tid, reason: 't27_check' });
      expect(r.ok).toBe(true);
    }

    const failed = await new MekongContractClient({ mode: 'ENABLED' }).submitTaskAsync({
      source_id: 'sophia_t28', event_id: 'evt_t28', goal: 'Fail closed without D1', workspace_id: 'ws_alpha',
    });
    expect(failed.ok).toBe(false);
    if (!failed.ok) expect(failed.error.code).toBe('RUNTIME_UNAVAILABLE');

    const slice = await runCreativeJobVerticalSliceD1(d1, {
      jobId: 'job_t28_enabled', workspaceId: 'ws_alpha', userId: 'u_alpha',
      idempotencyKey: 'idem_t28_enabled', goal: 'Run ENABLED D1 creative slice', contractMode: 'ENABLED',
    });
    expect(slice.ok && slice.value.truthState.isTrulyComplete).toBe(true);
    if (slice.ok) expect(slice.value.record.executionMode).toBe('MEKONG_ENABLED');
  });

  it('T29 & T30 & T31: verifies HMAC-SHA256 anti-replay, CSRF/public-route pass-through, and external pull-worker HTTP POST & D1 Lease/CAS convergence', async () => {
    const secret = 'test-worker-hmac-secret-02-2';
    process.env.MEKONG_WORKER_SHARED_SECRET = secret;
    const nowMs = Date.now();
    const tsSec = Math.floor(nowMs / 1000);
    const makeWorkerReq = async (payload: Record<string, unknown>, sigOverride?: string) => {
      const raw = JSON.stringify(payload);
      const sig = sigOverride ?? (await signMekongWorkerPayload(secret, tsSec, raw));
      return new NextRequest('https://sophia.agencyos.network/api/convergence/vertical-slice', {
        method: 'POST', headers: { [MEKONG_SIGNATURE_HEADER]: sig, [MEKONG_TIMESTAMP_HEADER]: String(tsSec) }, body: raw,
      });
    };

    const claimPayload = { action: 'claim_next_job', workspaceId: 'ws_alpha', workerId: 'wk_1', jobId: 'job_t30_pull' };
    const reqWithHmac = await makeWorkerReq(claimPayload);
    expect((await verifyMekongWorkerHmac({ secret, signatureHeader: reqWithHmac.headers.get(MEKONG_SIGNATURE_HEADER), timestampHeader: String(tsSec), rawBody: JSON.stringify(claimPayload), nowMs })).ok).toBe(true);
    expect((await verifyMekongWorkerHmac({ secret, signatureHeader: 'bad', timestampHeader: String(tsSec), rawBody: '{}', nowMs })).ok).toBe(false);
    expect((await verifyMekongWorkerHmac({ secret, signatureHeader: 'bad', timestampHeader: String(tsSec - 301), rawBody: '{}', nowMs })).ok).toBe(false);
    expect(isPublicApiRoute('/api/convergence/vertical-slice')).toBe(true);
    expect(verifyCsrfToken(reqWithHmac)).toBe(true);
    expect(isWorkerPullActionRequest(new NextRequest('https://sophia.agencyos.network/api/convergence/vertical-slice'), claimPayload)).toBe(true);

    expect((await POST(await makeWorkerReq(claimPayload, 'invalid_sig'))).status).toBe(401);
    expect((await POST(await makeWorkerReq({ action: 'claim_next_job', workspaceId: '' }))).status).toBe(400);

    await createOrGetConvergenceJobD1(d1, { jobId: 'job_t30_pull', workspaceId: 'ws_alpha', userId: 'u_alpha', idempotencyKey: 'idem_t30_pull', nowMs });
    const claimRes = await POST(await makeWorkerReq(claimPayload));
    expect(claimRes.status).toBe(200);
    const claimJson = (await claimRes.json()) as { claimed: boolean; leaseToken: string; record: { version: number } };
    expect(claimJson.claimed).toBe(true);

    expect((await POST(await makeWorkerReq({ ...claimPayload, workerId: 'wk_2' }))).status).toBe(409);
    const staleRes = await POST(await makeWorkerReq({
      action: 'complete_worker_attempt', jobId: 'job_t30_pull', workspaceId: 'ws_alpha',
      workerId: 'wk_1', leaseToken: claimJson.leaseToken, expectedVersion: claimJson.record.version - 1,
    }));
    expect(staleRes.status).toBe(409);

    const compRes = await POST(await makeWorkerReq({
      action: 'complete_worker_attempt', jobId: 'job_t30_pull', workspaceId: 'ws_alpha',
      workerId: 'wk_1', leaseToken: claimJson.leaseToken, expectedVersion: claimJson.record.version,
    }));
    expect(compRes.status).toBe(200);
    expect(((await compRes.json()) as { truthState: { isTrulyComplete: boolean } }).truthState.isTrulyComplete).toBe(true);

    const directNoMatch = await claimNextConvergenceJobD1(d1, { workspaceId: 'ws_empty', workerId: 'wk_1', nowMs });
    expect(directNoMatch.ok && !directNoMatch.value.claimed).toBe(true);
    expect((await completeWorkerAttemptD1(d1, { jobId: 'missing', workspaceId: 'ws_alpha', workerId: 'wk_1', leaseToken: 'lt', expectedVersion: 1 })).ok).toBe(false);
  });

  it('T32: enforces independent-approval governance payloads and a self-authorization-free workflow', () => {
    const environmentPayload = buildProductionEnvironmentPayload();
    // Independent approval is a release blocker: self-review must be prevented.
    expect(environmentPayload.prevent_self_review).toBe(true);
    expect(environmentPayload.deployment_branch_policy.protected_branches).toBe(true);

    const branchProtection = buildSoloFounderBranchProtectionPayload();
    expect(branchProtection.required_status_checks.contexts).toHaveLength(3);
    // A stale branch behind the checks it must pass must not ship.
    expect(branchProtection.required_status_checks.strict).toBe(true);
    expect(branchProtection.required_pull_request_reviews.required_approving_review_count).toBeGreaterThanOrEqual(1);

    const contracts = verifyGovernanceWorkflowContracts(path.resolve(process.cwd(), '../..'));
    expect(contracts.ok).toBe(true);
    // The workflow must not wire any author-controlled authorization source into the guard.
    expect(contracts.guardsSelfAuthorization).toBe(false);
    expect(contracts.hasReleaseApprovalInput).toBe(false);
  });
});
