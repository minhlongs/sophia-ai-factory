/**
 * GET /api/v1/creative-studio/economics — Integration Tests
 * SUPREME COMMAND #9 — Phase 7 + Test 18 (no secrets in response).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';
import { GET } from '../route';
import { getCurrentUser } from '@/seed/auth/better-auth-session';

const { mockDbAll, mockDbPrepare } = vi.hoisted(() => {
  const mockDbAll = vi.fn().mockResolvedValue({ results: [] });
  const mockDbPrepare = vi.fn().mockReturnValue({ bind: vi.fn().mockReturnThis(), all: mockDbAll });
  return { mockDbAll, mockDbPrepare };
});

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock('@/seed/db/client', () => ({
  createServerClient: vi.fn().mockReturnValue({
    unwrap: vi.fn().mockReturnValue({ prepare: mockDbPrepare }),
  }),
}));

const mockUser = { id: 'user_001', email: 'test@example.com', full_name: 'Test User', role: 'owner' };

function authed() {
  vi.mocked(getCurrentUser).mockResolvedValue(mockUser);
}
function unauthed() {
  vi.mocked(getCurrentUser).mockResolvedValue(null);
}

async function json<T>(res: NextResponse): Promise<T> {
  return res.json() as Promise<T>;
}

describe('GET /api/v1/creative-studio/economics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when not authenticated', async () => {
    unauthed();
    const req = new Request('http://localhost/api/v1/creative-studio/economics');
    const res = await GET(req as never);
    expect(res.status).toBe(401);
  });

  it('test 18: telemetry contains no secrets (no apiKey/auth fields)', async () => {
    authed();
    mockDbAll.mockResolvedValue({
      results: [
        {
          provider: 'flux',
          status: 'completed',
          latency_ms: 1200,
          retry_count: 0,
          provider_cost: 100,
          cost_classification: 'METERED',
          revenue_attribution: 500,
          gross_margin: null,
        },
      ],
    });

    const req = new Request('http://localhost/api/v1/creative-studio/economics');
    const res = await GET(req as never);
    expect(res.status).toBe(200);

    const body = await json<{ providers: Array<Record<string, unknown>>; generatedAt: number }>(res);
    expect(body.providers).toHaveLength(1);
    expect(body.generatedAt).toBeGreaterThan(0);

    const provider = body.providers[0];
    // Verify NO secret fields leak through
    expect(provider).not.toHaveProperty('apiKey');
    expect(provider).not.toHaveProperty('api_key');
    expect(provider).not.toHaveProperty('token');
    expect(provider).not.toHaveProperty('authorization');
    expect(provider).not.toHaveProperty('oauth_token');
    expect(provider).not.toHaveProperty('secret');

    // Verify expected aggregated fields ARE present
    expect(provider).toHaveProperty('provider');
    expect(provider).toHaveProperty('health');
    expect(provider).toHaveProperty('reliability');
    expect(provider).toHaveProperty('economics');
  });

  it('returns empty providers array when no jobs exist', async () => {
    authed();
    mockDbAll.mockResolvedValue({ results: [] });

    const req = new Request('http://localhost/api/v1/creative-studio/economics');
    const res = await GET(req as never);
    expect(res.status).toBe(200);

    const body = await json<{ providers: unknown[] }>(res);
    expect(body.providers).toEqual([]);
  });
});
