/**
 * Integration tests for /api/publish-approvals/[id]
 *
 * PATCH — Approve or reject a publish waiting for a human decision.
 * Covers admin approval, rejection, auth/IDOR/role guards, 404/409/500/400 states,
 * attribution vs selfApproval semantics, and TikTok Music Usage Confirmation enforcement.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockDbPrepare, mockDbBind, mockDbFirst, mockDbAll } = vi.hoisted(() => {
  const mockDbFirst = vi.fn().mockResolvedValue(null);
  const mockDbAll = vi.fn().mockResolvedValue({ results: [] });
  const mockDbBind = vi.fn().mockReturnThis();
  const mockDbPrepare = vi.fn(() => ({ bind: mockDbBind, first: mockDbFirst, all: mockDbAll }));
  return { mockDbPrepare, mockDbBind, mockDbFirst, mockDbAll };
});

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: vi.fn().mockResolvedValue({ id: 'user_test_001', email: 'test@example.com' }),
}));

vi.mock('@/seed/db/client', () => ({
  getD1: vi.fn().mockResolvedValue({ prepare: mockDbPrepare }),
}));

vi.mock('@/tree/publishing/approval', () => ({
  getPublishLedgerRecordByKey: vi.fn(),
  listPendingPublishApprovals: vi.fn().mockResolvedValue([]),
  resolveAndAnnouncePublishApproval: vi.fn(),
}));

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getPublishLedgerRecordByKey, resolveAndAnnouncePublishApproval } from '@/tree/publishing/approval';
import { PATCH } from '../[id]/route';

function makePatchReq(id: string, body: unknown): NextRequest {
  return new NextRequest(`http://localhost/api/publish-approvals/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: new Headers({ 'content-type': 'application/json' }),
  });
}

type LedgerRow = {
  idempotencyKey: string; tenantId: string; channelId: string; platform: string;
  mediaRef: string; decision: 'pending' | 'approved' | 'rejected'; requesterId?: string;
  createdAt: number; expiresAt: number;
};

const CREATED_AT = 1_760_000_000;
const EXPIRES_AT = CREATED_AT + 86_400;

function pendingRow(overrides: Partial<LedgerRow> = {}): LedgerRow {
  return {
    idempotencyKey: 'key_pending_001', tenantId: 'ws_test_001', channelId: 'ch_test_001',
    platform: 'youtube', mediaRef: 'r2://video/test.mp4', decision: 'pending',
    createdAt: CREATED_AT, expiresAt: EXPIRES_AT, ...overrides,
  };
}

describe('PATCH /api/publish-approvals/[id] — resolve', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCurrentUser).mockReset().mockResolvedValue({ id: 'user_test_001', email: 'test@example.com' });
    vi.mocked(getPublishLedgerRecordByKey).mockReset();
    vi.mocked(resolveAndAnnouncePublishApproval).mockReset();
    mockDbFirst.mockResolvedValue(null);
  });

  it('approves when the reviewer is an admin and wakes the waiting job', async () => {
    vi.mocked(getPublishLedgerRecordByKey).mockResolvedValue(pendingRow());
    mockDbFirst.mockResolvedValue({ role: 'admin' });
    vi.mocked(resolveAndAnnouncePublishApproval).mockResolvedValue({ resolved: true, alreadyResolved: false });
    const res = await PATCH(makePatchReq('key_pending_001', { approved: true, comment: 'Looks good' }), { params: Promise.resolve({ id: 'key_pending_001' }) });
    expect(res.status).toBe(200);
    const data = (await res.json()) as { resolved: boolean; decision: string };
    expect(data.resolved).toBe(true);
    expect(data.decision).toBe('approved');
    const call = vi.mocked(resolveAndAnnouncePublishApproval).mock.calls[0][0];
    expect(call).toMatchObject({ tenantId: 'ws_test_001', channelId: 'ch_test_001', platform: 'youtube', mediaRef: 'r2://video/test.mp4', decision: 'approved', reviewerId: 'user_test_001', comment: 'Looks good' });
  });

  it('rejects when the reviewer is an admin', async () => {
    vi.mocked(getPublishLedgerRecordByKey).mockResolvedValue(pendingRow());
    mockDbFirst.mockResolvedValue({ role: 'owner' });
    vi.mocked(resolveAndAnnouncePublishApproval).mockResolvedValue({ resolved: true, alreadyResolved: false });
    const res = await PATCH(makePatchReq('key_pending_001', { approved: false, comment: 'Wrong thumbnail' }), { params: Promise.resolve({ id: 'key_pending_001' }) });
    expect(res.status).toBe(200);
    expect(vi.mocked(resolveAndAnnouncePublishApproval).mock.calls[0][0].decision).toBe('rejected');
  });

  it('returns 401 when not authenticated', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    vi.mocked(getPublishLedgerRecordByKey).mockResolvedValue(pendingRow());
    const res = await PATCH(makePatchReq('key_pending_001', { approved: true }), { params: Promise.resolve({ id: 'key_pending_001' }) });
    expect(res.status).toBe(401);
    expect(resolveAndAnnouncePublishApproval).not.toHaveBeenCalled();
  });

  it('returns 403 when the reviewer is not a member of the owning workspace (IDOR)', async () => {
    vi.mocked(getPublishLedgerRecordByKey).mockResolvedValue(pendingRow());
    mockDbFirst.mockResolvedValue(null);
    const res = await PATCH(makePatchReq('key_pending_001', { approved: true }), { params: Promise.resolve({ id: 'key_pending_001' }) });
    expect(res.status).toBe(403);
    expect(resolveAndAnnouncePublishApproval).not.toHaveBeenCalled();
  });

  it('returns 403 when the reviewer is only a viewer', async () => {
    vi.mocked(getPublishLedgerRecordByKey).mockResolvedValue(pendingRow());
    mockDbFirst.mockResolvedValue({ role: 'viewer' });
    const res = await PATCH(makePatchReq('key_pending_001', { approved: true }), { params: Promise.resolve({ id: 'key_pending_001' }) });
    expect(res.status).toBe(403);
    expect(resolveAndAnnouncePublishApproval).not.toHaveBeenCalled();
  });

  it('returns 404 when the approval row does not exist', async () => {
    vi.mocked(getPublishLedgerRecordByKey).mockResolvedValue(null);
    const res = await PATCH(makePatchReq('key_ghost', { approved: true }), { params: Promise.resolve({ id: 'key_ghost' }) });
    expect(res.status).toBe(404);
    expect(resolveAndAnnouncePublishApproval).not.toHaveBeenCalled();
  });

  it('returns 409 without writing when the approval was already resolved', async () => {
    vi.mocked(getPublishLedgerRecordByKey).mockResolvedValue(pendingRow({ decision: 'approved' }));
    const res = await PATCH(makePatchReq('key_pending_001', { approved: false }), { params: Promise.resolve({ id: 'key_pending_001' }) });
    expect(res.status).toBe(409);
    expect(resolveAndAnnouncePublishApproval).not.toHaveBeenCalled();
  });

  it('returns 409 when another reviewer won the ledger write', async () => {
    vi.mocked(getPublishLedgerRecordByKey).mockResolvedValue(pendingRow());
    mockDbFirst.mockResolvedValue({ role: 'admin' });
    vi.mocked(resolveAndAnnouncePublishApproval).mockResolvedValue({ resolved: false, alreadyResolved: true });
    const res = await PATCH(makePatchReq('key_pending_001', { approved: true }), { params: Promise.resolve({ id: 'key_pending_001' }) });
    expect(res.status).toBe(409);
    expect(((await res.json()) as { alreadyResolved: boolean }).alreadyResolved).toBe(true);
  });

  it('returns 500 when the ledger write fails outright', async () => {
    vi.mocked(getPublishLedgerRecordByKey).mockResolvedValue(pendingRow());
    mockDbFirst.mockResolvedValue({ role: 'admin' });
    vi.mocked(resolveAndAnnouncePublishApproval).mockResolvedValue({ resolved: false, alreadyResolved: false, error: 'DB_ERROR' });
    const res = await PATCH(makePatchReq('key_pending_001', { approved: true }), { params: Promise.resolve({ id: 'key_pending_001' }) });
    expect(res.status).toBe(500);
    expect(((await res.json()) as { error: string }).error).toBe('DB_ERROR');
  });

  it('returns 400 for an invalid request body', async () => {
    vi.mocked(getPublishLedgerRecordByKey).mockResolvedValue(pendingRow());
    const res = await PATCH(makePatchReq('key_pending_001', { approved: 'yes' }), { params: Promise.resolve({ id: 'key_pending_001' }) });
    expect(res.status).toBe(400);
    expect(resolveAndAnnouncePublishApproval).not.toHaveBeenCalled();
  });

  it('returns 400 when TikTok approval explicitly sets musicUsageConfirmed to false', async () => {
    vi.mocked(getPublishLedgerRecordByKey).mockResolvedValue(pendingRow({ platform: 'tiktok' }));
    mockDbFirst.mockResolvedValue({ role: 'admin' });
    const res = await PATCH(
      makePatchReq('key_pending_001', { approved: true, compliance: { privacyLevel: 'SELF_ONLY', musicUsageConfirmed: false } }),
      { params: Promise.resolve({ id: 'key_pending_001' }) },
    );
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toBe('TikTok publish approval requires Music Usage Confirmation');
    expect(resolveAndAnnouncePublishApproval).not.toHaveBeenCalled();
  });

  it('returns 400 when TikTok approval omits compliance or musicUsageConfirmed', async () => {
    vi.mocked(getPublishLedgerRecordByKey).mockResolvedValue(pendingRow({ platform: 'tiktok' }));
    mockDbFirst.mockResolvedValue({ role: 'admin' });

    const missingCompliance = await PATCH(
      makePatchReq('key_pending_001', { approved: true }),
      { params: Promise.resolve({ id: 'key_pending_001' }) },
    );
    expect(missingCompliance.status).toBe(400);
    expect(((await missingCompliance.json()) as { error: string }).error).toBe(
      'TikTok publish approval requires explicit privacyLevel selection',
    );

    const omittedConsent = await PATCH(
      makePatchReq('key_pending_001', { approved: true, compliance: { privacyLevel: 'SELF_ONLY' } }),
      { params: Promise.resolve({ id: 'key_pending_001' }) },
    );
    expect(omittedConsent.status).toBe(400);
    expect(((await omittedConsent.json()) as { error: string }).error).toBe(
      'TikTok publish approval requires Music Usage Confirmation',
    );
    expect(resolveAndAnnouncePublishApproval).not.toHaveBeenCalled();
  });

  it('marks the decision unattributed when the request recorded no requester', async () => {
    vi.mocked(getPublishLedgerRecordByKey).mockResolvedValue(pendingRow());
    mockDbFirst.mockResolvedValue({ role: 'admin' });
    vi.mocked(resolveAndAnnouncePublishApproval).mockResolvedValue({ resolved: true, alreadyResolved: false });
    const res = await PATCH(makePatchReq('key_pending_001', { approved: true }), { params: Promise.resolve({ id: 'key_pending_001' }) });
    expect(res.status).toBe(200);
    const data = (await res.json()) as { selfApproval: boolean; attribution: string };
    expect(data).toMatchObject({ selfApproval: false, attribution: 'unattributed' });
  });

  it('does not treat a legacy workspace id in the requester column as the reviewer', async () => {
    vi.mocked(getPublishLedgerRecordByKey).mockResolvedValue(pendingRow({ requesterId: 'ws_test_001' }));
    mockDbFirst.mockResolvedValue({ role: 'admin' });
    vi.mocked(resolveAndAnnouncePublishApproval).mockResolvedValue({ resolved: true, alreadyResolved: false });
    const res = await PATCH(makePatchReq('key_pending_001', { approved: true }), { params: Promise.resolve({ id: 'key_pending_001' }) });
    expect(res.status).toBe(200);
    expect(((await res.json()) as { selfApproval: boolean }).selfApproval).toBe(false);
  });

  it('flags selfApproval when the sole admin resolves a publish they requested themselves', async () => {
    vi.mocked(getPublishLedgerRecordByKey).mockResolvedValue(pendingRow({ requesterId: 'user_test_001' }));
    mockDbFirst.mockResolvedValue({ role: 'admin' });
    vi.mocked(resolveAndAnnouncePublishApproval).mockResolvedValue({ resolved: true, alreadyResolved: false });
    const res = await PATCH(makePatchReq('key_pending_001', { approved: true }), { params: Promise.resolve({ id: 'key_pending_001' }) });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ resolved: true, selfApproval: true });
  });
});
