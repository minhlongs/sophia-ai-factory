/**
 * Tests for GET /api/cron/clearance-promote
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock refs: 'var' so initialization is hoisted alongside the declaration,
// making them available when the vi.mock factory (also hoisted) runs.
const mockRecordCronRun = vi.fn().mockResolvedValue(undefined);
const mockWasRecentlyRun = vi.fn().mockResolvedValue(false);

vi.mock('@/land/cron/run-tracker', () => ({
  recordCronRun: (...args: unknown[]) => mockRecordCronRun(...args),
  wasRecentlyRun: (...args: unknown[]) => mockWasRecentlyRun(...args),
}));

// --- Other mocks ---

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('@/seed/utils/to-error', () => ({
  toError: (e: unknown) => (e instanceof Error ? e : new Error(String(e))),
}));

vi.mock('@/seed/observability/cron-check-in', () => ({
  startCronCheckIn: vi.fn().mockReturnValue({}),
  finishCronCheckIn: vi.fn(),
  failCronCheckIn: vi.fn(),
}));

import { GET } from './route';
import { NextRequest } from 'next/server';

// Shared D1 mock — prepare() returns the same stmt so prepare.mock.calls tracks all SQL
const stmt = {
  run: vi.fn().mockResolvedValue({ changes: 3 }),
  first: vi.fn().mockResolvedValue(null),
};
const prepare = vi.fn(() => stmt);

function makeRequest(headers: Record<string, string> = {}): NextRequest {
  return new NextRequest('https://sophia.agencyos.network/api/cron/clearance-promote', { headers });
}

function setDb(runResult: { changes: number } | Error) {
  const isErr = runResult instanceof Error;
  if (isErr) {
    stmt.run = vi.fn().mockRejectedValue(runResult);
  } else {
    stmt.run = vi.fn().mockResolvedValue(runResult);
  }
  stmt.first.mockResolvedValue(null);
  prepare.mockClear();
  const db = { prepare };
  (globalThis as unknown as { __env: Record<string, unknown> }).__env = { DB: db };
}

beforeEach(() => {
  setDb({ changes: 3 });
  vi.stubEnv('CRON_SECRET', 'test-secret');
  mockRecordCronRun.mockClear();
  mockWasRecentlyRun.mockClear();
});

afterEach(() => {
  vi.unstubAllEnvs();
  delete (globalThis as unknown as { __env?: Record<string, unknown> }).__env;
});

describe('GET /api/cron/clearance-promote', () => {
  it('returns 401 when no auth header provided', async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
    expect(stmt.run).not.toHaveBeenCalled();
  });

  it('returns 401 for wrong Bearer token', async () => {
    const res = await GET(makeRequest({ authorization: 'Bearer wrong-token' }));
    expect(res.status).toBe(401);
  });

  it('returns 200 for valid Bearer token', async () => {
    const res = await GET(makeRequest({ authorization: 'Bearer test-secret' }));
    const data = await res.json() as { ok: boolean; promoted: number };
    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.promoted).toBe(3);
  });

  it('returns 200 for valid x-cron-secret header', async () => {
    const res = await GET(makeRequest({ 'x-cron-secret': 'test-secret' }));
    expect(res.status).toBe(200);
    expect(mockRecordCronRun).toHaveBeenCalledWith(
      expect.anything(),
      'clearance-promote',
      'success'
    );
  });

  it('invokes D1 UPDATE query to promote clearance conversions', async () => {
    await GET(makeRequest({ authorization: 'Bearer test-secret' }));
    expect(prepare).toHaveBeenCalled();
    const sqls = (prepare.mock.calls as unknown[][]).map((c) => (c[0] as unknown) as string);
    const updateSql = sqls.find((s) => s.includes('payout_status'));
    expect(updateSql).toBeDefined();
    expect(updateSql).toContain('available');
    expect(updateSql).toContain('pending_clearance');
  });

  it('returns promoted=0 when no conversions are ready', async () => {
    setDb({ changes: 0 });
    const res = await GET(makeRequest({ authorization: 'Bearer test-secret' }));
    const data = await res.json() as { ok: boolean; promoted: number };
    expect(res.status).toBe(200);
    expect(data.promoted).toBe(0);
  });

  it('returns 401 without auth header when CRON_SECRET unset', async () => {
    vi.unstubAllEnvs();
    vi.stubEnv('CRON_SECRET', '');
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
    expect(stmt.run).not.toHaveBeenCalled();
  });

  it('returns 500 on D1 failure', async () => {
    setDb(new Error('D1 error'));
    const res = await GET(makeRequest({ authorization: 'Bearer test-secret' }));
    const data = await res.json() as { error: string };
    expect(res.status).toBe(500);
    expect(data.error).toBe('Clearance promote failed');
  });
});
