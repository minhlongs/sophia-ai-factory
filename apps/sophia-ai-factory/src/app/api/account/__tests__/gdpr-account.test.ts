/**
 * gdpr-account.test.ts
 *
 * Tests for GDPR account export and deletion API routes.
 * Phase 14: Launch Hardening
 * Wave 21 Phase 02: DELETE now gated by 7-day cooldown unless override flag.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => {
  const mockGetCurrentUser = vi.fn();
  const mockGetD1 = vi.fn();
  return { mockGetCurrentUser, mockGetD1 };
});

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: mocks.mockGetCurrentUser,
}));

vi.mock('@/seed/db/client', () => ({
  getD1: mocks.mockGetD1,
}));

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

import { GET } from '../export/route';
import { DELETE } from '../route';

const TENANT_ID = 'tenant-gdpr-test';

interface CooldownState {
  confirmed_at: number | null;
  cancelled_at: number | null;
  scheduled_at: number;
}

function makeD1Mock(cooldown: CooldownState | null = null) {
  const cooldownGet = vi.fn().mockResolvedValue(cooldown);
  return {
    prepare: vi.fn().mockImplementation((sql: string) => {
      const isCooldownRead =
        sql.includes('FROM account_deletion_requests') && sql.includes('confirmed_at');
      return {
        bind: vi.fn().mockReturnValue({
          all: vi.fn().mockResolvedValue({ results: [{ id: 'row-1' }] }),
          first: isCooldownRead ? cooldownGet : vi.fn().mockResolvedValue(null),
          run: vi.fn().mockResolvedValue({ meta: { rows_written: 3, changes: 1 } }),
        }),
      };
    }),
  };
}

describe('GDPR Account Export — GET /api/account/export', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockGetCurrentUser.mockResolvedValue({ id: 'user-1', tenantId: TENANT_ID });
    mocks.mockGetD1.mockReturnValue(makeD1Mock());
  });

  it('returns 401 when unauthenticated', async () => {
    mocks.mockGetCurrentUser.mockResolvedValue(null);
    const req = new NextRequest('http://localhost/api/account/export');
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('returns export payload with tables array', async () => {
    const req = new NextRequest('http://localhost/api/account/export');
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json() as { tenantId: string; tables: unknown[] };
    expect(body.tenantId).toBe(TENANT_ID);
    expect(Array.isArray(body.tables)).toBe(true);
    expect(body.tables.length).toBeGreaterThan(0);
  });

  it('includes Content-Disposition header for file download', async () => {
    const req = new NextRequest('http://localhost/api/account/export');
    const res = await GET(req);
    expect(res.headers.get('content-disposition')).toContain('attachment');
    expect(res.headers.get('content-disposition')).toContain(TENANT_ID);
  });

  it('returns 503 when D1 unavailable', async () => {
    mocks.mockGetD1.mockReturnValue(null);
    const req = new NextRequest('http://localhost/api/account/export');
    const res = await GET(req);
    expect(res.status).toBe(503);
  });
});

describe('GDPR Account Deletion — DELETE /api/account (cooldown gated)', () => {
  const ORIGINAL_OVERRIDE = process.env.ALLOW_COOLDOWN_OVERRIDE;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockGetCurrentUser.mockResolvedValue({ id: 'user-1', tenantId: TENANT_ID });
    delete process.env.ALLOW_COOLDOWN_OVERRIDE;
  });

  afterEach(() => {
    if (ORIGINAL_OVERRIDE === undefined) {
      delete process.env.ALLOW_COOLDOWN_OVERRIDE;
    } else {
      process.env.ALLOW_COOLDOWN_OVERRIDE = ORIGINAL_OVERRIDE;
    }
  });

  it('returns 401 when unauthenticated', async () => {
    mocks.mockGetCurrentUser.mockResolvedValue(null);
    mocks.mockGetD1.mockReturnValue(makeD1Mock());
    const req = new NextRequest('http://localhost/api/account', {
      method: 'DELETE',
      headers: { 'x-confirm-delete': 'DELETE_MY_ACCOUNT' },
    });
    const res = await DELETE(req);
    expect(res.status).toBe(401);
  });

  it('returns 400 without confirmation header', async () => {
    mocks.mockGetD1.mockReturnValue(makeD1Mock());
    const req = new NextRequest('http://localhost/api/account', { method: 'DELETE' });
    const res = await DELETE(req);
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toContain('X-Confirm-Delete');
  });

  it('returns 412 when no active deletion request exists', async () => {
    mocks.mockGetD1.mockReturnValue(makeD1Mock(null));
    const req = new NextRequest('http://localhost/api/account', {
      method: 'DELETE',
      headers: { 'x-confirm-delete': 'DELETE_MY_ACCOUNT' },
    });
    const res = await DELETE(req);
    expect(res.status).toBe(412);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/No active|cooldown|confirmed/i);
  });

  it('returns 412 when cooldown not elapsed', async () => {
    const futureTs = Math.floor(Date.now() / 1000) + 86400; // +1 day
    mocks.mockGetD1.mockReturnValue(
      makeD1Mock({ confirmed_at: futureTs - 60_000, cancelled_at: null, scheduled_at: futureTs }),
    );
    const req = new NextRequest('http://localhost/api/account', {
      method: 'DELETE',
      headers: { 'x-confirm-delete': 'DELETE_MY_ACCOUNT' },
    });
    const res = await DELETE(req);
    expect(res.status).toBe(412);
    const body = await res.json() as { error: string; secondsRemaining: number };
    expect(body.secondsRemaining).toBeGreaterThan(0);
  });

  it('returns 200 when cooldown elapsed + confirmed', async () => {
    const pastTs = Math.floor(Date.now() / 1000) - 60;
    mocks.mockGetD1.mockReturnValue(
      makeD1Mock({ confirmed_at: pastTs - 86400, cancelled_at: null, scheduled_at: pastTs }),
    );
    const req = new NextRequest('http://localhost/api/account', {
      method: 'DELETE',
      headers: { 'x-confirm-delete': 'DELETE_MY_ACCOUNT' },
    });
    const res = await DELETE(req);
    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean; tenantId: string; totalRowsDeleted: number };
    expect(body.ok).toBe(true);
    expect(body.tenantId).toBe(TENANT_ID);
    expect(typeof body.totalRowsDeleted).toBe('number');
  });

  it('returns 200 with override header + env flag (admin path)', async () => {
    process.env.ALLOW_COOLDOWN_OVERRIDE = '1';
    mocks.mockGetD1.mockReturnValue(makeD1Mock(null));
    const req = new NextRequest('http://localhost/api/account', {
      method: 'DELETE',
      headers: {
        'x-confirm-delete': 'DELETE_MY_ACCOUNT',
        'x-override-cooldown': 'I_KNOW_WHAT_IM_DOING',
      },
    });
    const res = await DELETE(req);
    expect(res.status).toBe(200);
  });

  it('returns 503 when D1 unavailable', async () => {
    mocks.mockGetD1.mockReturnValue(null);
    const req = new NextRequest('http://localhost/api/account', {
      method: 'DELETE',
      headers: { 'x-confirm-delete': 'DELETE_MY_ACCOUNT' },
    });
    const res = await DELETE(req);
    expect(res.status).toBe(503);
  });
});
