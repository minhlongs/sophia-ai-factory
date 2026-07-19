/**
 * Tests for GET /api/cron/credit-expiry
 * Verifies one-time credit pack purchases are expired when past their TTL.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// Hoisted mocks so vi.mock() can reference them
const mocks = vi.hoisted(() => ({
  verifyCronAuth: vi.fn(),
  loggerInfo: vi.fn(),
  loggerError: vi.fn(),
  recordCronRun: vi.fn().mockResolvedValue(undefined),
  wasRecentlyRun: vi.fn().mockResolvedValue(false),
  startCronCheckIn: vi.fn(() => ({})),
  finishCronCheckIn: vi.fn(),
  failCronCheckIn: vi.fn(),
}));

vi.mock('@/seed/security/cron-auth', () => ({
  verifyCronAuth: mocks.verifyCronAuth,
}));

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: mocks.loggerError },
}));

vi.mock('@/land/cron/run-tracker', () => ({
  recordCronRun: mocks.recordCronRun,
  wasRecentlyRun: mocks.wasRecentlyRun,
}));

vi.mock('@/seed/observability/cron-check-in', () => ({
  startCronCheckIn: mocks.startCronCheckIn,
  finishCronCheckIn: mocks.finishCronCheckIn,
  failCronCheckIn: mocks.failCronCheckIn,
}));

// Track SQL call sequence for prepare().bind().all() chain
let callSeq = 0;

function freshMockDb(expiredPurchases: unknown[] = []) {
  callSeq = 0;
  return {
    prepare: (_sql: string) => {
      return {
        bind: (..._bindings: unknown[]) => ({
          all: async () => {
            callSeq++;
            if (callSeq === 1 && expiredPurchases.length > 0) {
              return { results: expiredPurchases as never };
            }
            return { results: null as never };
          },
          run: async () => ({
            meta: { changes: expiredPurchases.length },
          }),
        }),
      };
    },
  } as never;
}

vi.mock('@/seed/db/client', () => ({
  createServerClient: vi.fn(() => freshMockDb()),
}));

import { GET } from './route';

const NOW_SEC = 1752562500; // 2026-07-15 03:15:00 UTC — stable frozen time

function makeRequest(headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(
    'https://sophia.agencyos.network/api/cron/credit-expiry',
    { headers }
  );
}

describe('GET /api/cron/credit-expiry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('CRON_SECRET', 'test-secret');
    vi.useFakeTimers();
    vi.setSystemTime(NOW_SEC * 1000);
    callSeq = 0;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  // ── Auth ──────────────────────────────────────────────────────────────────
  it('returns 401 when no auth header', async () => {
    mocks.verifyCronAuth.mockReturnValue(new Response('Unauthorized', { status: 401 }));
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it('returns 401 for wrong Bearer token', async () => {
    mocks.verifyCronAuth.mockReturnValue(new Response('Unauthorized', { status: 401 }));
    const res = await GET(makeRequest({ authorization: 'Bearer wrong-token' }));
    expect(res.status).toBe(401);
  });

  // ── Happy path ─────────────────────────────────────────────────────────────
  it('returns 200 with 0 expired when no purchases past TTL', async () => {
    mocks.verifyCronAuth.mockReturnValue(null); // auth passes
    const res = await GET(makeRequest({ authorization: 'Bearer test-secret' }));
    expect(res.status).toBe(200);
    const data = (await res.json()) as Record<string, unknown>;
    expect(data.ok).toBe(true);
    expect(data.expired).toBe(0);
  });

  it('expires purchases past their TTL', async () => {
    mocks.verifyCronAuth.mockReturnValue(null);
    mocks.wasRecentlyRun.mockResolvedValue(false);

    const expiredPurchases = [
      { id: 'p1', user_id: 'u1', credits_remaining: 10, expires_at: NOW_SEC - 86400 },
      { id: 'p2', user_id: 'u2', credits_remaining: 5, expires_at: NOW_SEC - 172800 },
    ];

    // Dynamically patch createServerClient for this test
    const { createServerClient } = await import('@/seed/db/client');
    vi.mocked(createServerClient).mockReturnValue(
      freshMockDb(expiredPurchases) as ReturnType<typeof createServerClient>
    );

    const res = await GET(makeRequest({ authorization: 'Bearer test-secret' }));
    expect(res.status).toBe(200);
    const data = (await res.json()) as Record<string, unknown>;
    expect(data.ok).toBe(true);
    expect(data.expired).toBe(2);
  });

  // ── Idempotency ───────────────────────────────────────────────────────────
  it('skips when recently run', async () => {
    mocks.verifyCronAuth.mockReturnValue(null);
    mocks.wasRecentlyRun.mockResolvedValue(true);

    const res = await GET(makeRequest({ authorization: 'Bearer test-secret' }));
    expect(res.status).toBe(200);
    const data = (await res.json()) as Record<string, unknown>;
    expect(data).toHaveProperty('skipped', true);
    expect(data.reason).toBe('recently_run');
  });

  // ── Observability ─────────────────────────────────────────────────────────
  it('records cron run on success', async () => {
    mocks.verifyCronAuth.mockReturnValue(null);
    mocks.wasRecentlyRun.mockResolvedValue(false);

    const res = await GET(makeRequest({ authorization: 'Bearer test-secret' }));
    expect(res.status).toBe(200);
    expect(mocks.recordCronRun).toHaveBeenCalledWith(
      expect.anything(),
      'credit-expiry',
      'success'
    );
    expect(mocks.finishCronCheckIn).toHaveBeenCalled();
  });

  it('calls failCronCheckIn on error', async () => {
    mocks.verifyCronAuth.mockReturnValue(null);
    mocks.wasRecentlyRun.mockRejectedValue(new Error('DB closed'));

    const res = await GET(makeRequest({ authorization: 'Bearer test-secret' }));
    expect(res.status).toBe(500);
    expect(mocks.failCronCheckIn).toHaveBeenCalled();
  });
});
