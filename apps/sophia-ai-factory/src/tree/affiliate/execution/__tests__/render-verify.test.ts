/**
 * Pre-side-effect re-verification tests: every binding the render worker
 * requires before provider submit.
 *
 * @module tree/affiliate/execution/__tests__/render-verify.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/tree/affiliate/kill-switch/kill-switch-store', () => ({
  getAffiliateKillSwitchState: vi.fn(async () => ({ active: false, known: true })),
}));

import { getAffiliateKillSwitchState } from '@/tree/affiliate/kill-switch/kill-switch-store';
import { createFakeD1 } from '@/seed/testing/fake-d1-sqlite';
import { createCampaignApproval } from '@/tree/affiliate/approval/campaign-approval-repo';
import type { CampaignApprovalPayload } from '@/seed/security/approval-payload-hash';
import { beginExecutionRun, type ExecutionRunRecord } from '../execution-repo';
import { verifyRenderReady } from '../render-verify';

const SCHEMA = [
  `CREATE TABLE agent_campaign_approvals (
    id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, campaign_id TEXT NOT NULL,
    niche TEXT NOT NULL, jurisdiction TEXT NOT NULL, approval_payload_hash TEXT NOT NULL,
    estimated_render_cost_cents INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'pending_ceo',
    approved_by TEXT, approved_at INTEGER, invalidated_reason TEXT,
    payload_json TEXT, dispatch_json TEXT, expires_at INTEGER,
    revoked_by TEXT, revoked_at INTEGER, executed_at INTEGER, rejection_reason TEXT,
    created_at INTEGER NOT NULL
  );`,
  `CREATE TABLE affiliate_execution_runs (
    id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, campaign_id TEXT NOT NULL,
    offer_id TEXT, approval_id TEXT, idempotency_key TEXT NOT NULL,
    state TEXT NOT NULL DEFAULT 'approval_pending', locale TEXT NOT NULL DEFAULT 'en',
    market TEXT, artifact_id TEXT, channel_id TEXT,
    reserved_cost_cents INTEGER NOT NULL DEFAULT 0, actual_cost_cents INTEGER,
    failure_reason TEXT, provider_job_id TEXT, render_attempts INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
  );`,
  `CREATE UNIQUE INDEX idx_runs_idem ON affiliate_execution_runs(tenant_id, idempotency_key);`,
];

const basePayload: CampaignApprovalPayload = {
  scriptBody: 'Honest review of Acme SaaS for agencies',
  affiliateTargetUrl: 'https://sophia.ai/r/acme',
  jurisdiction: 'US',
  disclosureText: '#ad — affiliate link',
  maxRenderCostCents: 50,
};

async function seedApproved(db: D1Database): Promise<string> {
  const created = await createCampaignApproval(db, {
    tenantId: 'ws_1',
    campaignId: 'camp_1',
    niche: 'saas_global',
    jurisdiction: 'US',
    payload: basePayload,
    dispatch: {
      userId: 'ceo_1',
      offerId: 'offer_1',
      niche: 'saas_global',
      blueprintId: 'bp_1',
      productName: 'Acme',
      productUrl: 'https://acme.example/signup',
    },
    status: 'approved',
    approvedBy: 'ceo_1',
  });
  if (!created.ok) throw new Error(created.error.message);
  return created.value.id;
}

async function seedRun(db: D1Database, approvalId: string, reserved = 50): Promise<ExecutionRunRecord> {
  const begun = await beginExecutionRun(db, {
    tenantId: 'ws_1',
    campaignId: 'camp_1',
    offerId: 'offer_1',
    approvalId,
    idempotencyKey: 'ws_1:camp_1',
    reservedCostCents: reserved,
  });
  if (!begun.ok) throw new Error(begun.error);
  await db
    .prepare(`UPDATE affiliate_execution_runs SET state = 'render_queued' WHERE id = ?`)
    .bind(begun.value.id)
    .run();
  return { ...begun.value, state: 'render_queued' };
}

describe('verifyRenderReady', () => {
  let db: D1Database;

  beforeEach(() => {
    vi.clearAllMocks();
    db = createFakeD1(SCHEMA) as unknown as D1Database;
  });

  it('passes for a bound, approved, funded, key-connected run', async () => {
    const approvalId = await seedApproved(db);
    const run = await seedRun(db, approvalId);
    const res = await verifyRenderReady({
      db,
      tenantId: 'ws_1',
      run,
      resolveApiKey: async () => 'key_byok_1',
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.scriptBody).toBe(basePayload.scriptBody);
    expect(res.apiKey).toBe('key_byok_1');
    expect(res.approvalId).toBe(approvalId);
  });

  it('blocks when the kill switch flips after approval', async () => {
    vi.mocked(getAffiliateKillSwitchState).mockResolvedValueOnce({ active: true, known: true });
    const approvalId = await seedApproved(db);
    const run = await seedRun(db, approvalId);
    const res = await verifyRenderReady({
      db, tenantId: 'ws_1', run, resolveApiKey: async () => 'key_byok_1',
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.code).toBe('KILL_SWITCH_ACTIVE');
  });

  it('treats an unknown kill-switch state as active (fail closed)', async () => {
    vi.mocked(getAffiliateKillSwitchState).mockResolvedValueOnce({ active: false, known: false });
    const approvalId = await seedApproved(db);
    const run = await seedRun(db, approvalId);
    const res = await verifyRenderReady({
      db, tenantId: 'ws_1', run, resolveApiKey: async () => 'key_byok_1',
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.code).toBe('KILL_SWITCH_ACTIVE');
  });

  it('fails when no render key is connected (no platform fallback)', async () => {
    const approvalId = await seedApproved(db);
    const run = await seedRun(db, approvalId);
    const res = await verifyRenderReady({
      db, tenantId: 'ws_1', run, resolveApiKey: async () => null,
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.code).toBe('CREDENTIALS_MISSING');
  });

  it('fails when the reservation exceeds the approved budget', async () => {
    const approvalId = await seedApproved(db);
    const run = await seedRun(db, approvalId, 5000);
    const res = await verifyRenderReady({
      db, tenantId: 'ws_1', run, resolveApiKey: async () => 'key_byok_1',
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.code).toBe('BUDGET_EXCEEDED');
  });

  it('fails for revoked approvals and cross-workspace runs', async () => {
    const approvalId = await seedApproved(db);
    await db
      .prepare(`UPDATE agent_campaign_approvals SET status = 'revoked' WHERE id = ?`)
      .bind(approvalId)
      .run();
    const run = await seedRun(db, approvalId);
    const revoked = await verifyRenderReady({
      db, tenantId: 'ws_1', run, resolveApiKey: async () => 'key_byok_1',
    });
    expect(revoked.ok).toBe(false);
    if (revoked.ok) return;
    expect(revoked.code).toBe('APPROVAL_NOT_CONSUMABLE');

    const crossTenant = await verifyRenderReady({
      db, tenantId: 'ws_other', run, resolveApiKey: async () => 'key_byok_1',
    });
    expect(crossTenant.ok).toBe(false);
  });

  it('fails when the persisted payload no longer matches its digest', async () => {
    const approvalId = await seedApproved(db);
    await db
      .prepare(`UPDATE agent_campaign_approvals SET payload_json = ? WHERE id = ?`)
      .bind(JSON.stringify({ ...basePayload, scriptBody: 'tampered after approval' }), approvalId)
      .run();
    const run = await seedRun(db, approvalId);
    const res = await verifyRenderReady({
      db, tenantId: 'ws_1', run, resolveApiKey: async () => 'key_byok_1',
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.code).toBe('APPROVAL_PAYLOAD_CORRUPT');
  });

  it('fails for runs that are not render_queued', async () => {
    const approvalId = await seedApproved(db);
    const begun = await beginExecutionRun(db, {
      tenantId: 'ws_1', campaignId: 'camp_1', approvalId,
      idempotencyKey: 'ws_1:camp_1', reservedCostCents: 50,
    });
    if (!begun.ok) throw new Error(begun.error);
    const res = await verifyRenderReady({
      db, tenantId: 'ws_1', run: begun.value, resolveApiKey: async () => 'key_byok_1',
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.code).toBe('RUN_NOT_RENDER_QUEUED');
  });
});
