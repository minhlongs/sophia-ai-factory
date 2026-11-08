/**
 * Integration tests for /api/publish-approvals/[id]
 *
 * PATCH — Approve or reject a publish waiting for a human decision.
 *
 * Covers the three cases the gate depends on: a workspace admin's answer reaches
 * the ledger and wakes the job, a non-member cannot resolve someone else's
 * publish (IDOR), and a second reviewer of an already-resolved request is told
 * their answer was superseded rather than being recorded twice.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockDbPrepare, mockDbBind, mockDbFirst, mockDbAll } = vi.hoisted(() => {
  const mockDbFirst = vi.fn().mockResolvedValue(null);
  const mockDbAll = vi.fn().mockResolvedValue({ results: [] });
  const mockDbBind = vi.fn().mockReturnThis();
  const mockDbPrepare = vi.fn(() => ({
    bind: mockDbBind,
    first: mockDbFirst,
    all: mockDbAll,
  }));
  return { mockDbPrepare, mockDbBind, mockDbFirst, mockDbAll };
});

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: vi.fn().mockResolvedValue({
    id: 'user_test_001',
    email: 'test@example.com',
  }),
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
import {
  getPublishLedgerRecordByKey,
  resolveAndAnnouncePublishApproval,
} from '@/tree/publishing/approval';
import { PATCH } from '../[id]/route';

function makePatchReq(id: string, body: unknown): NextRequest {
  return new NextRequest(`http://localhost/api/publish-approvals/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: new Headers({ 'content-type': 'application/json' }),
  });
}

type LedgerRow = {
  idempotencyKey: string;
  tenantId: string;
  channelId: string;
  platform: string;
  mediaRef: string;
  decision: 'pending' | 'approved' | 'rejected';
  createdAt: number;
  expiresAt: number;
};

const CREATED_AT = 1_760_000_000;
const EXPIRES_AT = CREATED_AT + 86_400;

function pendingRow(overrides: Partial<LedgerRow> = {}): LedgerRow {
  return {
    idempotencyKey: 'key_pending_001',
    tenantId: 'ws_test_001',
    channelId: 'ch_test_001',
    platform: 'youtube',
    mediaRef: 'r2://video/test.mp4',
    decision: 'pending',
    createdAt: CREATED_AT,
    expiresAt: EXPIRES_AT,
    ...overrides,
  };
}

describe('PATCH /api/publish-approvals/[id] — resolve', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCurrentUser).mockReset().mockResolvedValue({
      id: 'user_test_001',
      email: 'test@example.com',
    });
    vi.mocked(getPublishLedgerRecordByKey).mockReset();
    vi.mocked(resolveAndAnnouncePublishApproval).mockReset();
    // Default: no membership row, so role verification fails closed.
    mockDbFirst.mockResolvedValue(null);
  });

  it('approves when the reviewer is an admin and wakes the waiting job', async () => {
    vi.mocked(getPublishLedgerRecordByKey).mockResolvedValue(pendingRow());
    mockDbFirst.mockResolvedValue({ role: 'admin' });
    vi.mocked(resolveAndAnnouncePublishApproval).mockResolvedValue({
      resolved: true,
      alreadyResolved: false,
    });

    const res = await PATCH(
      makePatchReq('key_pending_001', { approved: true, comment: 'Looks good' }),
      { params: Promise.resolve({ id: 'key_pending_001' }) },
    );

    expect(res.status).toBe(200);
    const data = await res.json() as { resolved: boolean; decision: string };
    expect(data.resolved).toBe(true);
    expect(data.decision).toBe('approved');
    expect(resolveAndAnnouncePublishApproval).toHaveBeenCalledTimes(1);
    const call = vi.mocked(resolveAndAnnouncePublishApproval).mock.calls[0][0];
    expect(call.tenantId).toBe('ws_test_001');
    expect(call.channelId).toBe('ch_test_001');
    expect(call.platform).toBe('youtube');
    expect(call.mediaRef).toBe('r2://video/test.mp4');
    expect(call.decision).toBe('approved');
    expect(call.reviewerId).toBe('user_test_001');
    expect(call.comment).toBe('Looks good');
  });

  it('rejects when the reviewer is an admin', async () => {
    vi.mocked(getPublishLedgerRecordByKey).mockResolvedValue(pendingRow());
    mockDbFirst.mockResolvedValue({ role: 'owner' });
    vi.mocked(resolveAndAnnouncePublishApproval).mockResolvedValue({
      resolved: true,
      alreadyResolved: false,
    });

    const res = await PATCH(
      makePatchReq('key_pending_001', { approved: false, comment: 'Wrong thumbnail' }),
      { params: Promise.resolve({ id: 'key_pending_001' }) },
    );

    expect(res.status).toBe(200);
    const call = vi.mocked(resolveAndAnnouncePublishApproval).mock.calls[0][0];
    expect(call.decision).toBe('rejected');
  });

  it('returns 401 when not authenticated', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    vi.mocked(getPublishLedgerRecordByKey).mockResolvedValue(pendingRow());

    const res = await PATCH(
      makePatchReq('key_pending_001', { approved: true }),
      { params: Promise.resolve({ id: 'key_pending_001' }) },
    );

    expect(res.status).toBe(401);
    expect(resolveAndAnnouncePublishApproval).not.toHaveBeenCalled();
  });

  it('returns 403 when the reviewer is not a member of the owning workspace (IDOR)', async () => {
    vi.mocked(getPublishLedgerRecordByKey).mockResolvedValue(pendingRow());
    mockDbFirst.mockResolvedValue(null);

    const res = await PATCH(
      makePatchReq('key_pending_001', { approved: true }),
      { params: Promise.resolve({ id: 'key_pending_001' }) },
    );

    expect(res.status).toBe(403);
    expect(resolveAndAnnouncePublishApproval).not.toHaveBeenCalled();
  });

  it('returns 403 when the reviewer is only a viewer', async () => {
    vi.mocked(getPublishLedgerRecordByKey).mockResolvedValue(pendingRow());
    mockDbFirst.mockResolvedValue({ role: 'viewer' });

    const res = await PATCH(
      makePatchReq('key_pending_001', { approved: true }),
      { params: Promise.resolve({ id: 'key_pending_001' }) },
    );

    expect(res.status).toBe(403);
    expect(resolveAndAnnouncePublishApproval).not.toHaveBeenCalled();
  });

  it('returns 404 when the approval row does not exist', async () => {
    vi.mocked(getPublishLedgerRecordByKey).mockResolvedValue(null);

    const res = await PATCH(
      makePatchReq('key_ghost', { approved: true }),
      { params: Promise.resolve({ id: 'key_ghost' }) },
    );

    expect(res.status).toBe(404);
    expect(resolveAndAnnouncePublishApproval).not.toHaveBeenCalled();
  });

  it('returns 409 without writing when the approval was already resolved', async () => {
    vi.mocked(getPublishLedgerRecordByKey).mockResolvedValue(
      pendingRow({ decision: 'approved' }),
    );

    const res = await PATCH(
      makePatchReq('key_pending_001', { approved: false }),
      { params: Promise.resolve({ id: 'key_pending_001' }) },
    );

    expect(res.status).toBe(409);
    expect(resolveAndAnnouncePublishApproval).not.toHaveBeenCalled();
  });

  it('returns 409 when another reviewer won the ledger write', async () => {
    vi.mocked(getPublishLedgerRecordByKey).mockResolvedValue(pendingRow());
    mockDbFirst.mockResolvedValue({ role: 'admin' });
    vi.mocked(resolveAndAnnouncePublishApproval).mockResolvedValue({
      resolved: false,
      alreadyResolved: true,
    });

    const res = await PATCH(
      makePatchReq('key_pending_001', { approved: true }),
      { params: Promise.resolve({ id: 'key_pending_001' }) },
    );

    expect(res.status).toBe(409);
    const data = await res.json() as { alreadyResolved: boolean };
    expect(data.alreadyResolved).toBe(true);
  });

  it('returns 500 when the ledger write fails outright', async () => {
    vi.mocked(getPublishLedgerRecordByKey).mockResolvedValue(pendingRow());
    mockDbFirst.mockResolvedValue({ role: 'admin' });
    vi.mocked(resolveAndAnnouncePublishApproval).mockResolvedValue({
      resolved: false,
      alreadyResolved: false,
      error: 'DB_ERROR',
    });

    const res = await PATCH(
      makePatchReq('key_pending_001', { approved: true }),
      { params: Promise.resolve({ id: 'key_pending_001' }) },
    );

    expect(res.status).toBe(500);
    const data = await res.json() as { error: string };
    expect(data.error).toBe('DB_ERROR');
  });

  it('returns 400 for an invalid request body', async () => {
    vi.mocked(getPublishLedgerRecordByKey).mockResolvedValue(pendingRow());

    const res = await PATCH(
      makePatchReq('key_pending_001', { approved: 'yes' }),
      { params: Promise.resolve({ id: 'key_pending_001' }) },
    );

    expect(res.status).toBe(400);
    expect(resolveAndAnnouncePublishApproval).not.toHaveBeenCalled();
  });
});
