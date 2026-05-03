/**
 * Tests for GET /api/cron/clearance-promote
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('@/seed/utils/to-error', () => ({
  toError: (e: unknown) => (e instanceof Error ? e : new Error(String(e))),
}));

import { GET } from './route';
import { NextRequest } from 'next/server';

// Defined outside so they can be referenced in assertions
let mockRun: ReturnType<typeof vi.fn>;
let mockPrepare: ReturnType<typeof vi.fn>;
let mockDb: { prepare: ReturnType<typeof vi.fn> };

function makeRequest(headers: Record<string, string> = {}, params = ''): NextRequest {
  return new NextRequest(`https://sophia.agencyos.network/api/cron/clearance-promote${params}`, {
    headers,
  });
}

beforeEach(() => {
  // Recreate mocks each test so clearAllMocks doesn't break factory implementations
  mockRun = vi.fn().mockResolvedValue({ changes: 3 });
  // Route calls: db.prepare(sql).run() — no .bind() step
  mockPrepare = vi.fn(() => ({ run: mockRun }));
  mockDb = { prepare: mockPrepare };

  (globalThis as unknown as { __env: Record<string, unknown> }).__env = { DB: mockDb };
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('GET /api/cron/clearance-promote', () => {
  describe('auth: CRON_SECRET set', () => {
    beforeEach(() => {
      vi.stubEnv('CRON_SECRET', 'test-secret');
    });

    it('returns 401 when no auth header provided', async () => {
      const res = await GET(makeRequest());
      expect(res.status).toBe(401);
      expect(mockRun).not.toHaveBeenCalled();
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
    });

    it('invokes D1 UPDATE query to promote clearance conversions', async () => {
      await GET(makeRequest({ authorization: 'Bearer test-secret' }));
      // Route now calls prepare multiple times (idempotency check + UPDATE + run-tracker)
      expect(mockPrepare).toHaveBeenCalled();
      const sqls = mockPrepare.mock.calls.map((c) => c[0] as string);
      const updateSql = sqls.find((s) => s.includes('payout_status'));
      expect(updateSql).toBeDefined();
      expect(updateSql).toContain('available');
      expect(updateSql).toContain('pending_clearance');
    });

    it('returns promoted=0 when no conversions are ready', async () => {
      mockRun.mockResolvedValue({ changes: 0 });

      const res = await GET(makeRequest({ authorization: 'Bearer test-secret' }));
      const data = await res.json() as { ok: boolean; promoted: number };

      expect(res.status).toBe(200);
      expect(data.promoted).toBe(0);
    });
  });

  describe('auth: CRON_SECRET unset (auth rejects)', () => {
    it('returns 401 without any auth header when CRON_SECRET unset', async () => {
      vi.stubEnv('CRON_SECRET', '');

      const res = await GET(makeRequest());
      expect(res.status).toBe(401);
      expect(mockRun).not.toHaveBeenCalled();
    });
  });

  describe('service errors', () => {
    beforeEach(() => {
      vi.stubEnv('CRON_SECRET', 'test-secret');
    });

    it('returns 500 on D1 failure', async () => {
      mockRun.mockRejectedValue(new Error('D1 error'));

      const res = await GET(makeRequest({ authorization: 'Bearer test-secret' }));
      const data = await res.json() as { error: string };

      expect(res.status).toBe(500);
      expect(data.error).toBe('Clearance promote failed');
    });
  });
});
