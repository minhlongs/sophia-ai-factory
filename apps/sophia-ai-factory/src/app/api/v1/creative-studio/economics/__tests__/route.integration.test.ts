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

  it('test 11 — economics API returns real revenueAttributed after attribution', async () => {
    authed();
    // The route issues TWO prepared statements:
    //   1) SELECT media_jobs → returns job rows with revenue_attribution
    //   2) SELECT attribution_provenance JOIN media_jobs → returns provenance stats
    // Use mockResolvedValueOnce to return different shapes per call.
    mockDbAll
      .mockResolvedValueOnce({
        results: [
          {
            provider: 'flux',
            status: 'completed',
            latency_ms: 1500,
            retry_count: 0,
            provider_cost: 250,
            cost_classification: 'METERED',
            revenue_attribution: 1000,
            gross_margin: 75,
          },
        ],
      })
      .mockResolvedValueOnce({
        results: [
          { provider: 'flux', count: 1, freshest: 1700000000000 },
        ],
      });

    const req = new Request('http://localhost/api/v1/creative-studio/economics');
    const res = await GET(req as never);
    expect(res.status).toBe(200);

    const body = await json<{
      providers: Array<{
        provider: string;
        economics: { revenueAttributed: number | null; knownGrossMarginPercent: number | null };
        attributionConfidence: 'HIGH' | 'MEDIUM' | 'LOW';
        provenanceCount: number;
        dataFreshest: number | null;
      }>;
    }>(res);

    expect(body.providers).toHaveLength(1);
    const provider = body.providers[0];
    expect(provider.provider).toBe('flux');

    // Revenue attribution surfaced from real data — NOT 'UNKNOWN'.
    expect(provider.economics.revenueAttributed).toBe(1000);
    // Gross margin = (1000 - 250) / 1000 * 100 = 75%
    expect(provider.economics.knownGrossMarginPercent).toBe(75);
    // 1 provenance row for 1 completed job → HIGH confidence.
    expect(provider.provenanceCount).toBe(1);
    expect(provider.attributionConfidence).toBe('HIGH');
    expect(provider.dataFreshest).toBe(1700000000000);
  });

  it('test 12 — economics API response contains no secrets (re-verify)', async () => {
    authed();
    mockDbAll
      .mockResolvedValueOnce({
        results: [
          {
            provider: 'flux',
            status: 'completed',
            latency_ms: 1200,
            retry_count: 0,
            provider_cost: 100,
            cost_classification: 'METERED',
            revenue_attribution: 500,
            gross_margin: 80,
          },
        ],
      })
      .mockResolvedValueOnce({ results: [] });

    const req = new Request('http://localhost/api/v1/creative-studio/economics');
    const res = await GET(req as never);
    expect(res.status).toBe(200);

    const body = await json<{ providers: Array<Record<string, unknown>> }>(res);
    expect(body.providers).toHaveLength(1);

    const provider = body.providers[0];
    // Top-level provider object must not leak secrets.
    expect(provider).not.toHaveProperty('apiKey');
    expect(provider).not.toHaveProperty('api_key');
    expect(provider).not.toHaveProperty('token');
    expect(provider).not.toHaveProperty('authorization');
    expect(provider).not.toHaveProperty('oauth_token');
    expect(provider).not.toHaveProperty('secret');
    expect(provider).not.toHaveProperty('client_secret');
    expect(provider).not.toHaveProperty('access_token');

    // Nested economics object must also be clean.
    const economics = provider.economics as Record<string, unknown> | undefined;
    expect(economics).toBeDefined();
    if (economics) {
      expect(economics).not.toHaveProperty('apiKey');
      expect(economics).not.toHaveProperty('token');
      expect(economics).not.toHaveProperty('secret');
    }

    // Verify expected aggregated fields ARE present (additive check).
    expect(provider).toHaveProperty('provider');
    expect(provider).toHaveProperty('health');
    expect(provider).toHaveProperty('reliability');
    expect(provider).toHaveProperty('economics');
    expect(provider).toHaveProperty('attributionConfidence');
    expect(provider).toHaveProperty('provenanceCount');
    expect(provider).toHaveProperty('dataFreshest');
  });
});
