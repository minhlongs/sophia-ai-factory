/**
 * Integration tests for /api/campaign-approvals
 *
 * GET   — list tenant campaign approvals (membership-checked)
 * PATCH — approve / reject / revoke / resume (ADMIN only, CAS + continuation)
 *
 * Uses real repo + guard + offer-eligibility logic against a SQLite-backed D1
 * fake; only auth, workspace access, and the Inngest transport are mocked.
 *
 * @module app/api/campaign-approvals/__tests__/route.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  mockGetCurrentUser: vi.fn(),
  mockGetCurrentUserFromHeaders: vi.fn(),
  mockHasWorkspaceRole: vi.fn(),
  mockGetUserWorkspaceIds: vi.fn(),
  mockGetD1: vi.fn(),
  mockInngestSend: vi.fn(),
}));

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: mocks.mockGetCurrentUser,
  getCurrentUserFromHeaders: mocks.mockGetCurrentUserFromHeaders,
}));

vi.mock('@/seed/auth/workspace-access', () => ({
  hasWorkspaceRole: mocks.mockHasWorkspaceRole,
  getUserWorkspaceIds: mocks.mockGetUserWorkspaceIds,
}));

vi.mock('@/seed/db/client', () => ({
  getD1: mocks.mockGetD1,
}));

vi.mock('@/seed/inngest/client', () => ({
  inngest: { send: mocks.mockInngestSend },
}));

import { createFakeD1 } from '@/seed/testing/fake-d1-sqlite';
import { createCampaignApproval } from '@/tree/affiliate/approval/campaign-approval-repo';
import type { CampaignApprovalPayload } from '@/seed/security/approval-payload-hash';
import { GET } from '../route';
import { PATCH } from '../[id]/route';

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
  `CREATE TABLE affiliate_offers (
    id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, network_id TEXT, external_id TEXT,
    product_url TEXT, destination_url TEXT, status TEXT, commission_terms TEXT,
    niche TEXT, region TEXT, language TEXT
  );`,
  `CREATE TABLE affiliate_execution_runs (
    id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, campaign_id TEXT NOT NULL,
    offer_id TEXT, approval_id TEXT, idempotency_key TEXT NOT NULL,
    state TEXT NOT NULL DEFAULT 'approval_pending', locale TEXT NOT NULL DEFAULT 'en',
    market TEXT, artifact_id TEXT, channel_id TEXT,
    reserved_cost_cents INTEGER NOT NULL DEFAULT 0, actual_cost_cents INTEGER,
    failure_reason TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
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

function makeReq(method: string, url: string, body?: unknown): NextRequest {
  return new NextRequest(url, {
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers: new Headers({ 'content-type': 'application/json' }),
  });
}

describe('/api/campaign-approvals', () => {
  let db: D1Database;

  beforeEach(() => {
    vi.clearAllMocks();
    db = createFakeD1(SCHEMA) as unknown as D1Database;
    mocks.mockGetD1.mockResolvedValue(db);
    mocks.mockGetCurrentUser.mockResolvedValue({ id: 'ceo_1', email: 'ceo@example.com' });
    mocks.mockGetCurrentUserFromHeaders.mockResolvedValue({ id: 'ceo_1', email: 'ceo@example.com' });
    mocks.mockGetUserWorkspaceIds.mockResolvedValue(['ws_1']);
    mocks.mockHasWorkspaceRole.mockResolvedValue(true);
    mocks.mockInngestSend.mockResolvedValue({ ids: ['evt_1'] });
  });

  async function seedOffer(tenantId = 'ws_1', offerId = 'offer_1'): Promise<void> {
    await db
      .prepare(
        `INSERT INTO affiliate_offers
         (id, tenant_id, network_id, external_id, product_url, status, commission_terms, niche, region)
         VALUES (?, ?, 'partnerstack', 'ext_1', 'https://acme.example/signup', 'active', '20% recurring', 'saas_global', 'US')`,
      )
      .bind(offerId, tenantId)
      .run();
  }

  async function seedPending(overrides: Record<string, unknown> = {}): Promise<string> {
    const res = await createCampaignApproval(db, {
      tenantId: 'ws_1',
      campaignId: 'camp_1',
      niche: 'saas_global',
      jurisdiction: 'US',
      payload: basePayload,
      dispatch: {
        userId: 'ceo_1',
        offerId: 'offer_1',
        niche: 'saas_global',
        blueprintId: 'bp_saas_review',
        productName: 'Acme SaaS',
        productUrl: 'https://acme.example/signup',
        locale: 'en',
      },
      ...overrides,
    });
    if (!res.ok) throw new Error(`seed failed: ${res.error.message}`);
    return res.value.id;
  }

  it('GET lists the workspace approvals for members', async () => {
    await seedPending();
    const res = await GET(makeReq('GET', 'http://localhost/api/campaign-approvals?workspaceId=ws_1'));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { approvals: Array<{ id: string; status: string }> };
    expect(body.approvals).toHaveLength(1);
    expect(body.approvals[0]?.status).toBe('pending_ceo');
  });

  it('GET rejects non-members with 403', async () => {
    const res = await GET(makeReq('GET', 'http://localhost/api/campaign-approvals?workspaceId=ws_other'));
    expect(res.status).toBe(403);
  });

  it('PATCH approve grants + sends exactly one continuation', async () => {
    await seedOffer();
    const id = await seedPending();
    const res = await PATCH(makeReq('PATCH', `http://localhost/api/campaign-approvals/${id}`, {
      action: 'approve',
    }), { params: Promise.resolve({ id }) });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; continuation: string };
    expect(body.status).toBe('approved');
    expect(body.continuation).toBe('sent');
    expect(mocks.mockInngestSend).toHaveBeenCalledTimes(1);
    const sent = mocks.mockInngestSend.mock.calls[0]?.[0] as {
      name: string;
      data: Record<string, unknown>;
    };
    expect(sent.name).toBe('niche.video.campaign.requested');
    expect(sent.data.approvalId).toBe(id);
    expect(sent.data.termsVerified).toBe(true);
    expect(sent.data.tenantId).toBe('ws_1');
  });

  it('PATCH approve twice: the second loses (409, no second send)', async () => {
    await seedOffer();
    const id = await seedPending();
    const first = await PATCH(
      makeReq('PATCH', `http://localhost/api/campaign-approvals/${id}`, { action: 'approve' }),
      { params: Promise.resolve({ id }) },
    );
    expect(first.status).toBe(200);
    const second = await PATCH(
      makeReq('PATCH', `http://localhost/api/campaign-approvals/${id}`, { action: 'approve' }),
      { params: Promise.resolve({ id }) },
    );
    expect(second.status).toBe(409);
    expect(mocks.mockInngestSend).toHaveBeenCalledTimes(1);
  });

  it('PATCH approve without verifiable terms grants but does NOT send (202)', async () => {
    // No offer seeded → terms unverified.
    const id = await seedPending();
    const res = await PATCH(makeReq('PATCH', `http://localhost/api/campaign-approvals/${id}`, {
      action: 'approve',
    }), { params: Promise.resolve({ id }) });
    expect(res.status).toBe(202);
    const body = (await res.json()) as { status: string; continuation: string; continuationCode: string };
    expect(body.status).toBe('approved');
    expect(body.continuation).toBe('not_sent');
    expect(body.continuationCode).toBe('TERMS_UNVERIFIED');
    expect(mocks.mockInngestSend).not.toHaveBeenCalled();
  });

  it('PATCH reject flips pending → rejected with reason', async () => {
    const id = await seedPending();
    const res = await PATCH(makeReq('PATCH', `http://localhost/api/campaign-approvals/${id}`, {
      action: 'reject',
      reason: 'Off-brand',
    }), { params: Promise.resolve({ id }) });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string };
    expect(body.status).toBe('rejected');
    expect(mocks.mockInngestSend).not.toHaveBeenCalled();
  });

  it('PATCH revoke flips approved → revoked', async () => {
    await seedOffer();
    const id = await seedPending();
    await PATCH(makeReq('PATCH', `http://localhost/api/campaign-approvals/${id}`, {
      action: 'approve',
    }), { params: Promise.resolve({ id }) });
    const res = await PATCH(makeReq('PATCH', `http://localhost/api/campaign-approvals/${id}`, {
      action: 'revoke',
      reason: 'Offer pulled',
    }), { params: Promise.resolve({ id }) });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string };
    expect(body.status).toBe('revoked');
  });

  it('PATCH resume re-sends for a stuck approval, deduped by idempotency key', async () => {
    await seedOffer();
    const id = await seedPending();
    // Approve without continuation: temporarily fail the send.
    mocks.mockInngestSend.mockRejectedValueOnce(new Error('transport down'));
    const approved = await PATCH(
      makeReq('PATCH', `http://localhost/api/campaign-approvals/${id}`, { action: 'approve' }),
      { params: Promise.resolve({ id }) },
    );
    expect(approved.status).toBe(202);

    const resumed = await PATCH(
      makeReq('PATCH', `http://localhost/api/campaign-approvals/${id}`, { action: 'resume' }),
      { params: Promise.resolve({ id }) },
    );
    expect(resumed.status).toBe(200);
    const body = (await resumed.json()) as { resumed: boolean };
    expect(body.resumed).toBe(true);
    expect(mocks.mockInngestSend).toHaveBeenCalledTimes(2);
  });

  it('PATCH resume marks executed when a run already consumed the approval', async () => {
    await seedOffer();
    const id = await seedPending();
    await PATCH(makeReq('PATCH', `http://localhost/api/campaign-approvals/${id}`, {
      action: 'approve',
    }), { params: Promise.resolve({ id }) });
    // Simulate the gate consuming the approval into a run.
    await db
      .prepare(
        `INSERT INTO affiliate_execution_runs
         (id, tenant_id, campaign_id, offer_id, approval_id, idempotency_key, state, created_at, updated_at)
         VALUES ('run_1', 'ws_1', 'camp_1', 'offer_1', ?, 'ws_1:camp_1', 'render_queued', 1, 1)`,
      )
      .bind(id)
      .run();

    const resumed = await PATCH(
      makeReq('PATCH', `http://localhost/api/campaign-approvals/${id}`, { action: 'resume' }),
      { params: Promise.resolve({ id }) },
    );
    expect(resumed.status).toBe(200);
    const body = (await resumed.json()) as { status: string; resumed: boolean; runId: string };
    expect(body.status).toBe('executed');
    expect(body.resumed).toBe(false);
    expect(body.runId).toBe('run_1');
    // No additional send.
    expect(mocks.mockInngestSend).toHaveBeenCalledTimes(1);
  });

  it('PATCH requires ADMIN (403 for members)', async () => {
    mocks.mockHasWorkspaceRole.mockResolvedValue(false);
    const id = await seedPending();
    const res = await PATCH(makeReq('PATCH', `http://localhost/api/campaign-approvals/${id}`, {
      action: 'approve',
    }), { params: Promise.resolve({ id }) });
    expect(res.status).toBe(403);
  });

  it('PATCH on another workspace approval returns 404 (no cross-tenant probe)', async () => {
    mocks.mockGetUserWorkspaceIds.mockResolvedValue(['ws_other']);
    const id = await seedPending();
    const res = await PATCH(makeReq('PATCH', `http://localhost/api/campaign-approvals/${id}`, {
      action: 'approve',
    }), { params: Promise.resolve({ id }) });
    expect(res.status).toBe(404);
  });

  it('PATCH rejects invalid action with 400', async () => {
    const id = await seedPending();
    const res = await PATCH(makeReq('PATCH', `http://localhost/api/campaign-approvals/${id}`, {
      action: 'explode',
    }), { params: Promise.resolve({ id }) });
    expect(res.status).toBe(400);
  });
});
