/**
 * gdpr-account.test.ts
 *
 * Tests for GDPR account export and deletion API routes.
 * Phase 14: Launch Hardening
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => {
  const mockGetCurrentUser = vi.fn();
  const mockGetD1Raw = vi.fn();
  return { mockGetCurrentUser, mockGetD1Raw };
});

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: mocks.mockGetCurrentUser,
}));

vi.mock('@/seed/db/client', () => ({
  getD1Raw: mocks.mockGetD1Raw,
}));

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

import { GET } from '../export/route';
import { DELETE } from '../route';

const TENANT_ID = 'tenant-gdpr-test';

function makeD1Mock() {
  return {
    prepare: vi.fn().mockReturnValue({
      bind: vi.fn().mockReturnValue({
        all: vi.fn().mockResolvedValue({ results: [{ id: 'row-1' }] }),
        run: vi.fn().mockResolvedValue({ meta: { rows_written: 3 } }),
      }),
    }),
  };
}

describe('GDPR Account Export — GET /api/account/export', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockGetCurrentUser.mockResolvedValue({ id: 'user-1', tenantId: TENANT_ID });
    mocks.mockGetD1Raw.mockResolvedValue(makeD1Mock());
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
    mocks.mockGetD1Raw.mockRejectedValue(new Error('D1 not configured'));
    const req = new NextRequest('http://localhost/api/account/export');
    const res = await GET(req);
    expect(res.status).toBe(503);
  });
});

describe('GDPR Account Deletion — DELETE /api/account', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockGetCurrentUser.mockResolvedValue({ id: 'user-1', tenantId: TENANT_ID });
    mocks.mockGetD1Raw.mockResolvedValue(makeD1Mock());
  });

  it('returns 401 when unauthenticated', async () => {
    mocks.mockGetCurrentUser.mockResolvedValue(null);
    const req = new NextRequest('http://localhost/api/account', {
      method: 'DELETE',
      headers: { 'x-confirm-delete': 'DELETE_MY_ACCOUNT' },
    });
    const res = await DELETE(req);
    expect(res.status).toBe(401);
  });

  it('returns 400 without confirmation header', async () => {
    const req = new NextRequest('http://localhost/api/account', { method: 'DELETE' });
    const res = await DELETE(req);
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toContain('X-Confirm-Delete');
  });

  it('returns 200 with deletion summary when confirmed', async () => {
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

  it('returns 503 when D1 unavailable', async () => {
    mocks.mockGetD1Raw.mockRejectedValue(new Error('D1 not configured'));
    const req = new NextRequest('http://localhost/api/account', {
      method: 'DELETE',
      headers: { 'x-confirm-delete': 'DELETE_MY_ACCOUNT' },
    });
    const res = await DELETE(req);
    expect(res.status).toBe(503);
  });
});
