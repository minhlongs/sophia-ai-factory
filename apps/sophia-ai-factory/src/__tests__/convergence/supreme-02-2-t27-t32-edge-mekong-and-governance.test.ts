/**
 * Supreme Command #02.2 Regression Suite — T27 through T32
 * Tests Cloudflare D1 Mekong 10/10 Contract Store (`0495_mekong_contract_tickets.sql`),
 * External Mekong Pull-Worker HMAC-SHA256 Authentication & Lease/CAS Convergence,
 * CSRF & Public Route Worker Pass-Through, and GitHub Release Governance Level 1.
 */

import fs from 'node:fs';
import path from 'node:path';
import { NextRequest } from 'next/server';
import { describe, it, expect, beforeEach } from 'vitest';
import { freshDb, makeD1 } from '@/__tests__/integration/shared-d1-shim';
import type { D1Database } from '@/seed/db/client';
import { verifyCsrfToken } from '@/seed/security/csrf';
import { isPublicApiRoute } from '@/forest/middleware/guard/public-routes';
import { createOrGetConvergenceJobD1 } from '@/tree/convergence';
import {
  MEKONG_D1_BRIDGE_MODE, MEKONG_SIGNATURE_HEADER, MEKONG_TIMESTAMP_HEADER,
  MekongContractClient, getMekongContractCapabilityMatrix, signMekongWorkerPayload, verifyMekongWorkerHmac,
} from '@/tree/mekong';
import { runCreativeJobVerticalSliceD1 } from '@/forest/convergence/creative-job-d1-runner';
import { claimNextConvergenceJobD1, completeWorkerAttemptD1 } from '@/forest/convergence/mekong-pull-worker-d1';
import {
  buildProductionEnvironmentPayload, buildSoloFounderBranchProtectionPayload, verifyGovernanceWorkflowContracts,
} from '../../../scripts/configure-github-release-governance.mjs';

const MIGRATION_0494_SQL = fs.readFileSync(path.resolve(process.cwd(), 'migrations/0494_authoritative_job_convergence_ledger.sql'), 'utf8');
const MIGRATION_0495_SQL = fs.readFileSync(path.resolve(process.cwd(), 'migrations/0495_mekong_contract_tickets.sql'), 'utf8');

describe('Supreme Command #02.2 — T27..T32: D1 Mekong Store, HMAC Pull-Worker & GitHub Governance', () => {
  let d1: D1Database;

  beforeEach(() => {
    const raw = freshDb();
    raw.exec(MIGRATION_0494_SQL);
    raw.exec(MIGRATION_0495_SQL);
    d1 = makeD1(raw) as unknown as D1Database;
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

  it('T29 & T30 & T31: verifies HMAC-SHA256 anti-replay, CSRF/public-route pass-through, and external pull-worker claim/complete with D1 Lease & CAS conflict protection', async () => {
    const secret = 'test-worker-hmac-secret-02-2';
    const nowMs = 1_762_000_000_000;
    const tsSec = Math.floor(nowMs / 1000);
    const body = JSON.stringify({ action: 'claim_next_job', workspaceId: 'ws_alpha', workerId: 'wk_1' });
    const sig = await signMekongWorkerPayload(secret, tsSec, body);

    expect((await verifyMekongWorkerHmac({ secret, signatureHeader: sig, timestampHeader: String(tsSec), rawBody: body, nowMs })).ok).toBe(true);
    expect((await verifyMekongWorkerHmac({ secret, signatureHeader: 'bad', timestampHeader: String(tsSec), rawBody: body, nowMs })).ok).toBe(false);
    expect((await verifyMekongWorkerHmac({ secret, signatureHeader: sig, timestampHeader: String(tsSec - 301), rawBody: body, nowMs })).ok).toBe(false);

    expect(isPublicApiRoute('/api/convergence/vertical-slice')).toBe(true);
    const reqWithHmac = new NextRequest('https://sophia.agencyos.network/api/convergence/vertical-slice', {
      method: 'POST', headers: { [MEKONG_SIGNATURE_HEADER]: sig, [MEKONG_TIMESTAMP_HEADER]: String(tsSec) }, body,
    });
    expect(verifyCsrfToken(reqWithHmac)).toBe(true);

    await createOrGetConvergenceJobD1(d1, {
      jobId: 'job_t30_pull', workspaceId: 'ws_alpha', userId: 'u_alpha', idempotencyKey: 'idem_t30_pull', nowMs,
    });
    const claim1 = await claimNextConvergenceJobD1(d1, { workspaceId: 'ws_alpha', workerId: 'wk_1', jobId: 'job_t30_pull', nowMs });
    expect(claim1.ok && claim1.value.claimed).toBe(true);
    if (!claim1.ok || !claim1.value.record || !claim1.value.leaseToken) return;

    const claim2 = await claimNextConvergenceJobD1(d1, { workspaceId: 'ws_alpha', workerId: 'wk_2', jobId: 'job_t30_pull', nowMs: nowMs + 1000 });
    expect(claim2.ok).toBe(false);
    if (!claim2.ok) expect(claim2.error.code).toBe('LEASE_HELD');

    const staleCas = await completeWorkerAttemptD1(d1, {
      jobId: 'job_t30_pull', workspaceId: 'ws_alpha', workerId: 'wk_1',
      leaseToken: claim1.value.leaseToken, expectedVersion: claim1.value.record.version - 1, nowMs: nowMs + 1500,
    });
    expect(staleCas.ok).toBe(false);
    if (!staleCas.ok) expect(staleCas.error.code).toBe('CAS_VERSION_CONFLICT');

    const comp = await completeWorkerAttemptD1(d1, {
      jobId: 'job_t30_pull', workspaceId: 'ws_alpha', workerId: 'wk_1',
      leaseToken: claim1.value.leaseToken, expectedVersion: claim1.value.record.version, nowMs: nowMs + 2000,
    });
    expect(comp.ok && comp.value.truthState.isTrulyComplete).toBe(true);
  });

  it('T32: enforces GitHub Server-Side Release Governance Level 1 payloads and workflow definitions', () => {
    const envPayload = buildProductionEnvironmentPayload();
    expect(envPayload.deployment_branch_policy.protected_branches).toBe(true);
    const bp = buildSoloFounderBranchProtectionPayload();
    expect(bp.required_status_checks.contexts).toHaveLength(3);
    expect(bp.allow_force_pushes).toBe(false);
    expect(verifyGovernanceWorkflowContracts(path.resolve(process.cwd(), '../..')).ok).toBe(true);
  });
});
