/**
 * Lifecycle tests for CEO campaign approvals (migration 0485).
 *
 * Covers: draft persistence of payload + dispatch context, pending dedupe,
 * CAS approve (single winner), reject / revoke / executed transitions, expiry,
 * tenant listing, stuck-approved recovery lookup, and guard enforcement of the
 * new terminal states. Uses a real SQLite-backed D1 fake.
 *
 * @module tree/affiliate/approval/__tests__/campaign-approval-lifecycle.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type { CampaignApprovalPayload } from '@/seed/security/approval-payload-hash';
import { createFakeD1 } from '@/seed/testing/fake-d1-sqlite';
import {
  APPROVAL_TTL_MS,
  approveCampaignApprovalCAS,
  createCampaignApproval,
  findStuckApproved,
  getCampaignApprovalById,
  listTenantApprovals,
  markApprovalExecuted,
  rejectCampaignApproval,
  revokeCampaignApproval,
  verifyAndEnforceCampaignApprovalD1,
  type ApprovalDispatchContext,
} from '../campaign-approval-repo';
import {
  verifyCampaignApprovalIntegrity,
  type StoredCampaignApproval,
} from '../campaign-approval-guard';

const APPROVALS_TABLE = `CREATE TABLE agent_campaign_approvals (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, campaign_id TEXT NOT NULL,
  niche TEXT NOT NULL, jurisdiction TEXT NOT NULL, approval_payload_hash TEXT NOT NULL,
  estimated_render_cost_cents INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'pending_ceo',
  approved_by TEXT, approved_at INTEGER, invalidated_reason TEXT,
  payload_json TEXT, dispatch_json TEXT, expires_at INTEGER,
  revoked_by TEXT, revoked_at INTEGER, executed_at INTEGER, rejection_reason TEXT,
  created_at INTEGER NOT NULL
);`;

const basePayload: CampaignApprovalPayload = {
  scriptBody: 'Top AI automation tool for engineering leads in 2026',
  affiliateTargetUrl: 'https://sophia.ai/partner/signup?ref=ws_1',
  jurisdiction: 'US',
  disclosureText: 'Ad: Contains affiliate links.',
  maxRenderCostCents: 1500,
  targetAccount: '@sophia_automation',
};

const baseDispatch: ApprovalDispatchContext = {
  userId: 'user_1',
  offerId: 'offer_1',
  niche: 'saas_global',
  blueprintId: 'bp_saas_review',
  productName: 'Acme SaaS',
  productUrl: 'https://acme.example/signup',
  locale: 'en',
};

function testDb(): D1Database {
  return createFakeD1([APPROVALS_TABLE]) as unknown as D1Database;
}

describe('campaign-approval lifecycle', () => {
  let db: D1Database;

  beforeEach(() => {
    db = testDb();
  });

  it('persists payload + dispatch context + expiry on draft creation', async () => {
    const before = Date.now();
    const res = await createCampaignApproval(db, {
      tenantId: 'ws_1',
      campaignId: 'camp_1',
      niche: 'saas_global',
      jurisdiction: 'US',
      payload: basePayload,
      dispatch: baseDispatch,
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.status).toBe('pending_ceo');
    expect(res.value.payloadJson).toContain('Top AI automation tool');
    expect(res.value.dispatchJson).toContain('offer_1');
    expect(res.value.expiresAtMs).toBeGreaterThanOrEqual(before + APPROVAL_TTL_MS);
    expect(res.value.niche).toBe('saas_global');
    expect(res.value.jurisdiction).toBe('US');
  });

  it('dedupes identical pending drafts for the same campaign', async () => {
    const first = await createCampaignApproval(db, {
      tenantId: 'ws_1', campaignId: 'camp_1', niche: 'saas_global',
      jurisdiction: 'US', payload: basePayload, dispatch: baseDispatch,
    });
    const second = await createCampaignApproval(db, {
      tenantId: 'ws_1', campaignId: 'camp_1', niche: 'saas_global',
      jurisdiction: 'US', payload: basePayload, dispatch: baseDispatch,
    });
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(second.value.id).toBe(first.value.id);
    expect(second.value.deduplicated).toBe(true);

    const listed = await listTenantApprovals(db, 'ws_1');
    expect(listed).toHaveLength(1);
  });

  it('creates a new row when the payload hash changes', async () => {
    const first = await createCampaignApproval(db, {
      tenantId: 'ws_1', campaignId: 'camp_1', niche: 'saas_global',
      jurisdiction: 'US', payload: basePayload, dispatch: baseDispatch,
    });
    const second = await createCampaignApproval(db, {
      tenantId: 'ws_1', campaignId: 'camp_1', niche: 'saas_global',
      jurisdiction: 'US',
      payload: { ...basePayload, scriptBody: 'A completely different script' },
      dispatch: baseDispatch,
    });
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(second.value.id).not.toBe(first.value.id);
    expect(second.value.deduplicated).toBeUndefined();
  });

  it('approves exactly once: the second concurrent approve loses the CAS', async () => {
    const created = await createCampaignApproval(db, {
      tenantId: 'ws_1', campaignId: 'camp_1', niche: 'saas_global',
      jurisdiction: 'US', payload: basePayload, dispatch: baseDispatch,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const winner = await approveCampaignApprovalCAS(db, {
      tenantId: 'ws_1', approvalId: created.value.id, operatorId: 'ceo_1',
    });
    expect(winner.ok).toBe(true);
    if (!winner.ok) return;
    expect(winner.value.status).toBe('approved');
    expect(winner.value.approvedBy).toBe('ceo_1');

    const loser = await approveCampaignApprovalCAS(db, {
      tenantId: 'ws_1', approvalId: created.value.id, operatorId: 'ceo_2',
    });
    expect(loser.ok).toBe(false);
    if (loser.ok) return;
    expect(loser.error.code).toBe('APPROVAL_STATE_CONFLICT');

    const stored = await getCampaignApprovalById(db, 'ws_1', created.value.id);
    expect(stored?.approvedBy).toBe('ceo_1');
  });

  it('rejects a pending row with a reason, then blocks further transitions', async () => {
    const created = await createCampaignApproval(db, {
      tenantId: 'ws_1', campaignId: 'camp_1', niche: 'saas_global',
      jurisdiction: 'US', payload: basePayload, dispatch: baseDispatch,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const rejected = await rejectCampaignApproval(db, {
      tenantId: 'ws_1', approvalId: created.value.id, operatorId: 'ceo_1', reason: 'Off-brand script',
    });
    expect(rejected.ok).toBe(true);
    if (!rejected.ok) return;
    expect(rejected.value.status).toBe('rejected');
    expect(rejected.value.rejectionReason).toBe('Off-brand script');

    const lateApprove = await approveCampaignApprovalCAS(db, {
      tenantId: 'ws_1', approvalId: created.value.id, operatorId: 'ceo_1',
    });
    expect(lateApprove.ok).toBe(false);
  });

  it('revokes an approved row; revoke of a pending row is a conflict', async () => {
    const created = await createCampaignApproval(db, {
      tenantId: 'ws_1', campaignId: 'camp_1', niche: 'saas_global',
      jurisdiction: 'US', payload: basePayload, dispatch: baseDispatch,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const id = created.value.id;

    const earlyRevoke = await revokeCampaignApproval(db, {
      tenantId: 'ws_1', approvalId: id, operatorId: 'ceo_1',
    });
    expect(earlyRevoke.ok).toBe(false);

    const approved = await approveCampaignApprovalCAS(db, {
      tenantId: 'ws_1', approvalId: id, operatorId: 'ceo_1',
    });
    expect(approved.ok).toBe(true);

    const revoked = await revokeCampaignApproval(db, {
      tenantId: 'ws_1', approvalId: id, operatorId: 'ceo_1', reason: 'Offer pulled by network',
    });
    expect(revoked.ok).toBe(true);
    if (!revoked.ok) return;
    expect(revoked.value.status).toBe('revoked');
    expect(revoked.value.revokedBy).toBe('ceo_1');
    expect(revoked.value.revokedAtMs).not.toBeNull();
  });

  it('marks executed idempotently; refuses non-approved rows', async () => {
    const created = await createCampaignApproval(db, {
      tenantId: 'ws_1', campaignId: 'camp_1', niche: 'saas_global',
      jurisdiction: 'US', payload: basePayload, dispatch: baseDispatch,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const id = created.value.id;

    // Not approved yet → conflict.
    const early = await markApprovalExecuted(db, 'ws_1', id);
    expect(early.ok).toBe(false);

    await approveCampaignApprovalCAS(db, { tenantId: 'ws_1', approvalId: id, operatorId: 'ceo_1' });
    const first = await markApprovalExecuted(db, 'ws_1', id);
    expect(first.ok).toBe(true);
    expect(first.ok && first.value.status).toBe('executed');
    const replay = await markApprovalExecuted(db, 'ws_1', id);
    expect(replay.ok).toBe(true);
    expect(replay.ok && replay.value.status).toBe('executed');
  });

  it('refuses to approve an expired row and flips it to expired', async () => {
    const created = await createCampaignApproval(db, {
      tenantId: 'ws_1', campaignId: 'camp_1', niche: 'saas_global',
      jurisdiction: 'US', payload: basePayload, dispatch: baseDispatch,
      expiresAtMs: Date.now() - 1000,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const res = await approveCampaignApprovalCAS(db, {
      tenantId: 'ws_1', approvalId: created.value.id, operatorId: 'ceo_1',
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe('APPROVAL_EXPIRED');

    const stored = await getCampaignApprovalById(db, 'ws_1', created.value.id);
    expect(stored?.status).toBe('expired');
  });

  it('lists tenant rows newest-first with status filter', async () => {
    const a = await createCampaignApproval(db, {
      tenantId: 'ws_1', campaignId: 'camp_a', niche: 'saas_global',
      jurisdiction: 'US', payload: basePayload, dispatch: baseDispatch, nowMs: 1000,
    });
    const b = await createCampaignApproval(db, {
      tenantId: 'ws_1', campaignId: 'camp_b', niche: 'saas_global',
      jurisdiction: 'US', payload: { ...basePayload, scriptBody: 'second script' },
      dispatch: baseDispatch, nowMs: 2000,
    });
    await createCampaignApproval(db, {
      tenantId: 'ws_2', campaignId: 'camp_other', niche: 'saas_global',
      jurisdiction: 'US', payload: basePayload, dispatch: baseDispatch, nowMs: 3000,
    });
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    await approveCampaignApprovalCAS(db, {
      tenantId: 'ws_1', approvalId: a.value.id, operatorId: 'ceo_1', nowMs: 4000,
    });

    const all = await listTenantApprovals(db, 'ws_1');
    expect(all.map((r) => r.campaignId)).toEqual(['camp_b', 'camp_a']);
    const pending = await listTenantApprovals(db, 'ws_1', { status: 'pending_ceo' });
    expect(pending.map((r) => r.campaignId)).toEqual(['camp_b']);
    const approved = await listTenantApprovals(db, 'ws_1', { status: 'approved' });
    expect(approved.map((r) => r.campaignId)).toEqual(['camp_a']);
  });

  it('finds stuck approved rows for the resume path', async () => {
    const stuck = await createCampaignApproval(db, {
      tenantId: 'ws_1', campaignId: 'camp_stuck', niche: 'saas_global',
      jurisdiction: 'US', payload: basePayload, dispatch: baseDispatch, nowMs: 1000,
    });
    const fresh = await createCampaignApproval(db, {
      tenantId: 'ws_1', campaignId: 'camp_fresh', niche: 'saas_global',
      jurisdiction: 'US', payload: { ...basePayload, scriptBody: 'fresh script' },
      dispatch: baseDispatch, nowMs: 9000,
    });
    expect(stuck.ok && fresh.ok).toBe(true);
    if (!stuck.ok || !fresh.ok) return;
    await approveCampaignApprovalCAS(db, {
      tenantId: 'ws_1', approvalId: stuck.value.id, operatorId: 'ceo_1', nowMs: 2000,
    });
    await approveCampaignApprovalCAS(db, {
      tenantId: 'ws_1', approvalId: fresh.value.id, operatorId: 'ceo_1', nowMs: 9500,
    });

    const found = await findStuckApproved(db, 'ws_1', 5000, 10_000);
    expect(found.map((r) => r.campaignId)).toEqual(['camp_stuck']);
  });

  it('verifyAndEnforce by approval id ignores newer shadow drafts', async () => {
    const first = await createCampaignApproval(db, {
      tenantId: 'ws_1', campaignId: 'camp_1', niche: 'saas_global',
      jurisdiction: 'US', payload: basePayload, dispatch: baseDispatch, nowMs: 1000,
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    await approveCampaignApprovalCAS(db, {
      tenantId: 'ws_1', approvalId: first.value.id, operatorId: 'ceo_1', nowMs: 2000,
    });
    // A later dispatch of a mutated campaign creates a NEWER pending row.
    const shadow = await createCampaignApproval(db, {
      tenantId: 'ws_1', campaignId: 'camp_1', niche: 'saas_global',
      jurisdiction: 'US',
      payload: { ...basePayload, scriptBody: 'mutated script' },
      dispatch: baseDispatch, nowMs: 3000,
    });
    expect(shadow.ok).toBe(true);

    const byId = await verifyAndEnforceCampaignApprovalD1(
      db, 'ws_1', 'camp_1', basePayload, false, { approvalId: first.value.id, nowMs: 4000 },
    );
    expect(byId.ok).toBe(true);

    // Latest-row lookup (no approvalId) sees the shadow draft → not granted.
    const latest = await verifyAndEnforceCampaignApprovalD1(db, 'ws_1', 'camp_1', basePayload, false);
    expect(latest.ok).toBe(false);
  });
});

describe('campaign-approval guard terminal states', () => {
  const stored = (overrides: Partial<StoredCampaignApproval>): StoredCampaignApproval => ({
    id: 'app_1',
    tenantId: 'ws_1',
    campaignId: 'camp_1',
    status: 'approved',
    approvalPayloadHash: 'hash',
    approvedBy: 'ceo_1',
    approvedAtMs: 1000,
    ...overrides,
  });

  it('blocks rejected rows', async () => {
    const res = await verifyCampaignApprovalIntegrity(stored({ status: 'rejected' }), basePayload);
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe('APPROVAL_REJECTED');
  });

  it('blocks revoked rows', async () => {
    const res = await verifyCampaignApprovalIntegrity(stored({ status: 'revoked' }), basePayload);
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe('APPROVAL_REVOKED');
  });

  it('blocks executed rows (no double consumption)', async () => {
    const res = await verifyCampaignApprovalIntegrity(stored({ status: 'executed' }), basePayload);
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe('APPROVAL_ALREADY_EXECUTED');
  });

  it('expires approved rows past expiresAtMs and persists the flip', async () => {
    const db = testDb();
    const created = await createCampaignApproval(db, {
      tenantId: 'ws_1', campaignId: 'camp_1', niche: 'saas_global',
      jurisdiction: 'US', payload: basePayload, dispatch: baseDispatch,
      expiresAtMs: 5000, nowMs: 1000,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    await approveCampaignApprovalCAS(db, {
      tenantId: 'ws_1', approvalId: created.value.id, operatorId: 'ceo_1', nowMs: 2000,
    });

    const res = await verifyAndEnforceCampaignApprovalD1(db, 'ws_1', 'camp_1', basePayload, false, {
      approvalId: created.value.id,
      nowMs: 6000,
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe('APPROVAL_EXPIRED');

    const storedRow = await getCampaignApprovalById(db, 'ws_1', created.value.id);
    expect(storedRow?.status).toBe('expired');
  });

  it('still enforces hash binding on approved rows', async () => {
    const res = await verifyCampaignApprovalIntegrity(
      stored({ approvalPayloadHash: 'wrong-hash' }),
      basePayload,
    );
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe('APPROVAL_INVALIDATED_BY_MUTATION');
  });
});
