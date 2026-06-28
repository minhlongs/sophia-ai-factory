/**
 * Tests for Wave 21 Phase 02 account self-delete endpoints.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  mockGetCurrentUser: vi.fn(),
  mockGetD1Raw: vi.fn(),
  mockSendEmail: vi.fn(),
}));

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: mocks.mockGetCurrentUser,
}));

vi.mock('@/seed/db/client', () => ({
  getD1Raw: mocks.mockGetD1Raw,
}));

vi.mock('@/forest/email/sender', () => ({
  sendEmail: mocks.mockSendEmail,
}));

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

import { POST as RequestPOST } from '../request/route';
import { GET as ConfirmGET } from '../confirm/route';
import { GET as StatusGET } from '../status/route';
import { sha256Hex } from '@/seed/security/token-hash';

interface PendingRow {
  user_id: string;
  confirmation_token: string;
  confirmation_token_hash?: string | null;
  confirmed_at: number | null;
  cancelled_at: number | null;
  scheduled_at: number;
  requested_at?: number;
}

function makeDb(opts: {
  existingActive?: PendingRow | null;
  rowForConfirm?: PendingRow | null;
  rowForStatus?: PendingRow | null;
  cancelChanges?: number;
}) {
  const calls: { sql: string; binds: unknown[] }[] = [];
  return {
    calls,
    db: {
      prepare: vi.fn().mockImplementation((sql: string) => ({
        bind: vi.fn().mockImplementation((...binds: unknown[]) => {
          calls.push({ sql, binds });
          const wantsActiveCheck =
            sql.includes('FROM account_deletion_requests') &&
            sql.includes('WHERE user_id = ?') &&
            sql.includes('cancelled_at IS NULL');
          const wantsConfirmRow =
            sql.includes('SELECT user_id, confirmation_token');
          const wantsStatusRow =
            sql.includes('SELECT requested_at, scheduled_at');
          const wantsCancelUpdate = sql.startsWith('UPDATE account_deletion_requests');
          return {
            first: vi.fn().mockImplementation(() => {
              if (wantsActiveCheck) return Promise.resolve(opts.existingActive ?? null);
              if (wantsConfirmRow) return Promise.resolve(opts.rowForConfirm ?? null);
              if (wantsStatusRow) return Promise.resolve(opts.rowForStatus ?? null);
              return Promise.resolve(null);
            }),
            run: vi.fn().mockResolvedValue({
              meta: { changes: wantsCancelUpdate ? (opts.cancelChanges ?? 1) : 1 },
            }),
          };
        }),
      })),
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.mockGetCurrentUser.mockResolvedValue({ id: 'user-1', email: 'a@b.com' });
  mocks.mockSendEmail.mockResolvedValue(undefined);
});

describe('POST /api/account/delete/request — request action', () => {
  it('returns 401 when unauthenticated', async () => {
    mocks.mockGetCurrentUser.mockResolvedValue(null);
    const req = new NextRequest('http://localhost/api/account/delete/request', {
      method: 'POST',
      body: JSON.stringify({ action: 'request' }),
    });
    const res = await RequestPOST(req);
    expect(res.status).toBe(401);
  });

  it('creates request, sends email, returns 200', async () => {
    const { db, calls } = makeDb({ existingActive: null });
    mocks.mockGetD1Raw.mockResolvedValue(db);
    const req = new NextRequest('http://localhost/api/account/delete/request', {
      method: 'POST',
      body: JSON.stringify({ action: 'request' }),
      headers: { 'content-type': 'application/json' },
    });
    const res = await RequestPOST(req);
    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean; cooldownDays: number };
    expect(body.ok).toBe(true);
    expect(body.cooldownDays).toBe(7);
    expect(mocks.mockSendEmail).toHaveBeenCalledOnce();
    expect(calls.some((c) => c.sql.includes('INSERT OR REPLACE INTO account_deletion_requests'))).toBe(true);
  });

  it('returns 409 when active request already exists', async () => {
    const { db } = makeDb({
      existingActive: {
        user_id: 'user-1', confirmation_token: 't', confirmed_at: null,
        cancelled_at: null, scheduled_at: 9_999_999_999,
      },
    });
    mocks.mockGetD1Raw.mockResolvedValue(db);
    const req = new NextRequest('http://localhost/api/account/delete/request', {
      method: 'POST',
      body: JSON.stringify({ action: 'request' }),
      headers: { 'content-type': 'application/json' },
    });
    const res = await RequestPOST(req);
    expect(res.status).toBe(409);
  });

  it('rolls back row on email send failure (502)', async () => {
    const { db, calls } = makeDb({ existingActive: null });
    mocks.mockGetD1Raw.mockResolvedValue(db);
    mocks.mockSendEmail.mockRejectedValue(new Error('SMTP boom'));
    const req = new NextRequest('http://localhost/api/account/delete/request', {
      method: 'POST',
      body: JSON.stringify({ action: 'request' }),
      headers: { 'content-type': 'application/json' },
    });
    const res = await RequestPOST(req);
    expect(res.status).toBe(502);
    expect(calls.some((c) => c.sql.includes('DELETE FROM account_deletion_requests'))).toBe(true);
  });
});

describe('POST /api/account/delete/request — cancel action', () => {
  it('returns 200 when active request cancelled', async () => {
    const { db } = makeDb({ cancelChanges: 1 });
    mocks.mockGetD1Raw.mockResolvedValue(db);
    const req = new NextRequest('http://localhost/api/account/delete/request', {
      method: 'POST',
      body: JSON.stringify({ action: 'cancel' }),
      headers: { 'content-type': 'application/json' },
    });
    const res = await RequestPOST(req);
    expect(res.status).toBe(200);
    const body = await res.json() as { cancelled: boolean };
    expect(body.cancelled).toBe(true);
  });

  it('returns 404 when no active request to cancel', async () => {
    const { db } = makeDb({ cancelChanges: 0 });
    mocks.mockGetD1Raw.mockResolvedValue(db);
    const req = new NextRequest('http://localhost/api/account/delete/request', {
      method: 'POST',
      body: JSON.stringify({ action: 'cancel' }),
      headers: { 'content-type': 'application/json' },
    });
    const res = await RequestPOST(req);
    expect(res.status).toBe(404);
  });
});

describe('GET /api/account/delete/confirm', () => {
  it('redirects with error when missing params', async () => {
    const req = new NextRequest('http://localhost/api/account/delete/confirm');
    const res = await ConfirmGET(req);
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('error=delete-confirm-missing');
  });

  it('confirms request when token matches + redirects ok', async () => {
    const { db, calls } = makeDb({
      rowForConfirm: {
        user_id: 'user-1', confirmation_token: 'good-token',
        confirmed_at: null, cancelled_at: null, scheduled_at: 9_999_999_999,
      },
    });
    mocks.mockGetD1Raw.mockResolvedValue(db);
    const req = new NextRequest(
      'http://localhost/api/account/delete/confirm?token=good-token&userId=user-1',
    );
    const res = await ConfirmGET(req);
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('ok=delete-confirmed');
    expect(calls.some((c) => c.sql.includes('SET confirmed_at'))).toBe(true);
  });

  it('redirects error when token mismatch', async () => {
    const { db } = makeDb({
      rowForConfirm: {
        user_id: 'user-1', confirmation_token: 'real-token',
        confirmed_at: null, cancelled_at: null, scheduled_at: 9_999_999_999,
      },
    });
    mocks.mockGetD1Raw.mockResolvedValue(db);
    const req = new NextRequest(
      'http://localhost/api/account/delete/confirm?token=wrong&userId=user-1',
    );
    const res = await ConfirmGET(req);
    expect(res.headers.get('location')).toContain('error=delete-confirm-invalid');
  });

  it('redirects error when row cancelled', async () => {
    const { db } = makeDb({
      rowForConfirm: {
        user_id: 'user-1', confirmation_token: 'good',
        confirmed_at: null, cancelled_at: 1, scheduled_at: 9_999_999_999,
      },
    });
    mocks.mockGetD1Raw.mockResolvedValue(db);
    const req = new NextRequest(
      'http://localhost/api/account/delete/confirm?token=good&userId=user-1',
    );
    const res = await ConfirmGET(req);
    expect(res.headers.get('location')).toContain('error=delete-confirm-cancelled');
  });
});

describe('GET /api/account/delete/status', () => {
  it('returns state=none when no row', async () => {
    const { db } = makeDb({ rowForStatus: null });
    mocks.mockGetD1Raw.mockResolvedValue(db);
    const res = await StatusGET();
    const body = await res.json() as { state: string };
    expect(body.state).toBe('none');
  });

  it('returns state=pending when not yet confirmed', async () => {
    const { db } = makeDb({
      rowForStatus: {
        user_id: 'user-1', confirmation_token: 't',
        confirmed_at: null, cancelled_at: null, scheduled_at: 100, requested_at: 50,
      },
    });
    mocks.mockGetD1Raw.mockResolvedValue(db);
    const res = await StatusGET();
    const body = await res.json() as { state: string; scheduledAt: number };
    expect(body.state).toBe('pending');
    expect(body.scheduledAt).toBe(100);
  });

  it('returns state=confirmed when confirmed_at set', async () => {
    const { db } = makeDb({
      rowForStatus: {
        user_id: 'user-1', confirmation_token: 't',
        confirmed_at: 60, cancelled_at: null, scheduled_at: 100, requested_at: 50,
      },
    });
    mocks.mockGetD1Raw.mockResolvedValue(db);
    const res = await StatusGET();
    const body = await res.json() as { state: string };
    expect(body.state).toBe('confirmed');
  });

  it('returns state=cancelled when cancelled_at set', async () => {
    const { db } = makeDb({
      rowForStatus: {
        user_id: 'user-1', confirmation_token: 't',
        confirmed_at: null, cancelled_at: 70, scheduled_at: 100, requested_at: 50,
      },
    });
    mocks.mockGetD1Raw.mockResolvedValue(db);
    const res = await StatusGET();
    const body = await res.json() as { state: string };
    expect(body.state).toBe('cancelled');
  });
});

describe('Wave 22 P01 — sha256 hash token verification', () => {
  it('confirms when confirmation_token_hash matches sha256 of incoming token', async () => {
    const tokenHash = await sha256Hex('mytoken');
    const { db, calls } = makeDb({
      rowForConfirm: {
        user_id: 'user-1',
        confirmation_token: '',
        confirmation_token_hash: tokenHash,
        confirmed_at: null,
        cancelled_at: null,
        scheduled_at: 9_999_999_999,
      },
    });
    mocks.mockGetD1Raw.mockResolvedValue(db);
    const req = new NextRequest(
      'http://localhost/api/account/delete/confirm?token=mytoken&userId=user-1',
    );
    const res = await ConfirmGET(req);
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('ok=delete-confirmed');
    expect(calls.some((c) => c.sql.includes('SET confirmed_at'))).toBe(true);
  });

  it('rejects when confirmation_token_hash does not match sha256 of incoming token', async () => {
    const wrongHash = await sha256Hex('different-token');
    const { db } = makeDb({
      rowForConfirm: {
        user_id: 'user-1',
        confirmation_token: '',
        confirmation_token_hash: wrongHash,
        confirmed_at: null,
        cancelled_at: null,
        scheduled_at: 9_999_999_999,
      },
    });
    mocks.mockGetD1Raw.mockResolvedValue(db);
    const req = new NextRequest(
      'http://localhost/api/account/delete/confirm?token=mytoken&userId=user-1',
    );
    const res = await ConfirmGET(req);
    expect(res.headers.get('location')).toContain('error=delete-confirm-invalid');
  });
});

describe('Wave 22 P03 — invalid email URL throws', () => {
  it('returns 502 + rolls back row when NEXT_PUBLIC_APP_URL has invalid scheme', async () => {
    process.env.NEXT_PUBLIC_APP_URL = 'ftp://bad-host';
    const { db, calls } = makeDb({ existingActive: null });
    mocks.mockGetD1Raw.mockResolvedValue(db);
    const req = new NextRequest('http://localhost/api/account/delete/request', {
      method: 'POST',
      body: JSON.stringify({ action: 'request' }),
      headers: { 'content-type': 'application/json' },
    });
    const res = await RequestPOST(req);
    expect(res.status).toBe(502);
    expect(calls.some((c) => c.sql.includes('DELETE FROM account_deletion_requests'))).toBe(true);
    delete process.env.NEXT_PUBLIC_APP_URL;
  });
});
