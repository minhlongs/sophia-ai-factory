/**
 * Tests for /api/account/change-email POST + verify GET routes (Wave 20 Phase 04 / 7B).
 *
 * Covers: auth gate, validation, conflict detection, happy path, expired token,
 * mismatched token, race conflict on verify.
 */

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
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

import { POST } from '../route';
import { GET as VERIFY_GET } from '../verify/route';

interface PreparedStmt {
  first: Mock;
  run: Mock;
}

function buildDb(stmts: PreparedStmt[]) {
  let i = 0;
  return {
    prepare: vi.fn(() => {
      const stmt = stmts[i++];
      if (!stmt) throw new Error('No more prepared stmts mocked');
      return {
        bind: () => ({
          first: stmt.first,
          run: stmt.run,
        }),
      };
    }),
  };
}

function stmt(opts: { first?: unknown; run?: unknown } = {}): PreparedStmt {
  return {
    first: vi.fn().mockResolvedValue(opts.first ?? null),
    run: vi.fn().mockResolvedValue(opts.run ?? { meta: { rows_written: 1 } }),
  };
}

const USER = { id: 'user-1', email: 'old@example.com' };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.mockGetCurrentUser.mockResolvedValue(USER);
  mocks.mockSendEmail.mockResolvedValue({ success: true, provider: 'resend' });
  process.env.NEXT_PUBLIC_APP_URL = 'https://sophia.test';
});

describe('POST /api/account/change-email', () => {
  it('rejects when unauthenticated', async () => {
    mocks.mockGetCurrentUser.mockResolvedValue(null);
    const req = new NextRequest('http://localhost/api/account/change-email', {
      method: 'POST',
      body: JSON.stringify({ newEmail: 'new@example.com' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('rejects malformed body', async () => {
    const req = new NextRequest('http://localhost/api/account/change-email', {
      method: 'POST',
      body: JSON.stringify({ newEmail: 'not-an-email' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('rejects when newEmail equals current email', async () => {
    const req = new NextRequest('http://localhost/api/account/change-email', {
      method: 'POST',
      body: JSON.stringify({ newEmail: 'OLD@example.com' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('rejects when newEmail already taken', async () => {
    mocks.mockGetD1Raw.mockResolvedValue(buildDb([
      stmt({ first: { id: 'other-user', email: 'taken@example.com' } }),
    ]));
    const req = new NextRequest('http://localhost/api/account/change-email', {
      method: 'POST',
      body: JSON.stringify({ newEmail: 'taken@example.com' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(409);
  });

  it('happy path inserts verification + sends email', async () => {
    mocks.mockGetD1Raw.mockResolvedValue(buildDb([
      stmt({ first: null }),  // existing-email lookup
      stmt(),                  // DELETE existing pending
      stmt(),                  // INSERT verification
    ]));
    const req = new NextRequest('http://localhost/api/account/change-email', {
      method: 'POST',
      body: JSON.stringify({ newEmail: 'new@example.com' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mocks.mockSendEmail).toHaveBeenCalledTimes(1);
    const call = mocks.mockSendEmail.mock.calls[0][0];
    expect(call.to).toBe('new@example.com');
    expect(call.html).toContain('Confirm new email');
  });

  it('returns 502 if sendEmail throws', async () => {
    mocks.mockGetD1Raw.mockResolvedValue(buildDb([
      stmt({ first: null }),
      stmt(),
      stmt(),
    ]));
    mocks.mockSendEmail.mockRejectedValueOnce(new Error('Resend down'));
    const req = new NextRequest('http://localhost/api/account/change-email', {
      method: 'POST',
      body: JSON.stringify({ newEmail: 'new@example.com' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(502);
  });
});

describe('GET /api/account/change-email/verify', () => {
  function makeReq(qs: string) {
    return new NextRequest(`http://localhost/api/account/change-email/verify?${qs}`);
  }

  it('redirects to error when token missing', async () => {
    const res = await VERIFY_GET(makeReq('userId=user-1'));
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toContain('error=email-change-invalid');
  });

  it('redirects to error when token row not found', async () => {
    mocks.mockGetD1Raw.mockResolvedValue(buildDb([stmt({ first: null })]));
    const res = await VERIFY_GET(makeReq('token=abc&userId=user-1'));
    expect(res.headers.get('location')).toContain('error=email-change-invalid');
  });

  it('redirects to error and deletes row when expired', async () => {
    const expired = new Date(Date.now() - 1000).toISOString();
    const deleteStmt = stmt();
    mocks.mockGetD1Raw.mockResolvedValue(buildDb([
      stmt({ first: { id: 'v-1', value: 'new@example.com:tok-x', expiresAt: expired } }),
      deleteStmt,
    ]));
    const res = await VERIFY_GET(makeReq('token=tok-x&userId=user-1'));
    expect(res.headers.get('location')).toContain('error=email-change-expired');
    expect(deleteStmt.run).toHaveBeenCalled();
  });

  it('redirects to error when stored token mismatch', async () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    mocks.mockGetD1Raw.mockResolvedValue(buildDb([
      stmt({ first: { id: 'v-1', value: 'new@example.com:other-token', expiresAt: future } }),
    ]));
    const res = await VERIFY_GET(makeReq('token=tok-x&userId=user-1'));
    expect(res.headers.get('location')).toContain('error=email-change-invalid');
  });

  it('redirects to conflict when new email already taken at verify time', async () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    const deleteStmt = stmt();
    mocks.mockGetD1Raw.mockResolvedValue(buildDb([
      stmt({ first: { id: 'v-1', value: 'new@example.com:tok-x', expiresAt: future } }),
      stmt({ first: { id: 'other-user' } }), // race conflict
      deleteStmt,
    ]));
    const res = await VERIFY_GET(makeReq('token=tok-x&userId=user-1'));
    expect(res.headers.get('location')).toContain('error=email-change-conflict');
    expect(deleteStmt.run).toHaveBeenCalled();
  });

  it('happy path updates user.email and redirects success', async () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    const updateStmt = stmt();
    const deleteStmt = stmt();
    mocks.mockGetD1Raw.mockResolvedValue(buildDb([
      stmt({ first: { id: 'v-1', value: 'new@example.com:tok-x', expiresAt: future } }),
      stmt({ first: null }), // no race conflict
      updateStmt,
      deleteStmt,
    ]));
    const res = await VERIFY_GET(makeReq('token=tok-x&userId=user-1'));
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toContain('?ok=email-changed');
    expect(updateStmt.run).toHaveBeenCalled();
    expect(deleteStmt.run).toHaveBeenCalled();
  });
});
