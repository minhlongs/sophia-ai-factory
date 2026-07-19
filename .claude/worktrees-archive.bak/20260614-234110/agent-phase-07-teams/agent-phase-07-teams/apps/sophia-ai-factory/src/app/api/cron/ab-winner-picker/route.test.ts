/**
 * Tests for /api/cron/ab-winner-picker route
 *
 * Verifies:
 * - Auth gate (401 without CRON_SECRET)
 * - Dry-run mode (no DB writes)
 * - Empty experiment list → 200 with 0 decided
 * - Experiments with clear winner → decided count
 * - Experiments still pending → not in decided list
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import type { AbExperiment } from '@/forest/ab/ab-types';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/forest/ab/experiment-store', () => ({
  getActiveExperimentsOlderThan: vi.fn().mockResolvedValue([]),
  markWinner: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/seed/security/cron-auth', () => ({
  verifyCronAuth: vi.fn().mockReturnValue(null), // null = auth passes
}));

import { GET } from './route';
import { getActiveExperimentsOlderThan, markWinner } from '@/forest/ab/experiment-store';
import { verifyCronAuth } from '@/seed/security/cron-auth';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildRequest(params?: Record<string, string>): NextRequest {
  const url = new URL('http://localhost/api/cron/ab-winner-picker');
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }
  return new NextRequest(url, {
    headers: { authorization: 'Bearer test-secret' },
  });
}

function makeExperiment(overrides: Partial<AbExperiment> = {}): AbExperiment {
  const createdAt = new Date(Date.now() - 30 * 60 * 60 * 1000).toISOString(); // 30h ago
  return {
    id: 'exp-001',
    videoId: 'vid-001',
    tenantId: 'tenant-001',
    variantACaption: 'Title A',
    variantBCaption: 'Title B',
    variantAThumbUrl: null,
    variantBThumbUrl: null,
    impressionsA: 200,
    impressionsB: 200,
    conversionsA: 40,
    conversionsB: 10,
    winner: null,
    status: 'active',
    createdAt,
    decidedAt: null,
    offerId: null,
    bundleId: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /api/cron/ab-winner-picker', () => {
  beforeEach(() => {
    vi.mocked(verifyCronAuth).mockReturnValue(null);
    vi.mocked(getActiveExperimentsOlderThan).mockResolvedValue([]);
    vi.mocked(markWinner).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when auth fails', async () => {
    const { NextResponse } = await import('next/server');
    vi.mocked(verifyCronAuth).mockReturnValue(
      NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    );
    const res = await GET(buildRequest());
    expect(res.status).toBe(401);
  });

  it('returns 200 with 0 decided when no experiments found', async () => {
    const res = await GET(buildRequest());
    expect(res.status).toBe(200);
    const body = await res.json() as { evaluated: number; decided: number };
    expect(body.evaluated).toBe(0);
    expect(body.decided).toBe(0);
  });

  it('picks winner for experiment with clear 2× CTR advantage', async () => {
    const exp = makeExperiment({
      impressionsA: 200,
      impressionsB: 200,
      conversionsA: 40,
      conversionsB: 10,
    });
    vi.mocked(getActiveExperimentsOlderThan).mockResolvedValue([exp]);

    const res = await GET(buildRequest());
    expect(res.status).toBe(200);
    const body = await res.json() as { decided: number; decisions: Array<{ winner: string }> };
    expect(body.decided).toBe(1);
    expect(body.decisions[0].winner).toBe('a');
    expect(markWinner).toHaveBeenCalledWith('exp-001', 'a');
  });

  it('does not call markWinner in dry_run mode', async () => {
    const exp = makeExperiment({
      impressionsA: 200,
      impressionsB: 200,
      conversionsA: 40,
      conversionsB: 10,
    });
    vi.mocked(getActiveExperimentsOlderThan).mockResolvedValue([exp]);

    const res = await GET(buildRequest({ dry_run: 'true' }));
    expect(res.status).toBe(200);
    const body = await res.json() as { dryRun: boolean; decided: number };
    expect(body.dryRun).toBe(true);
    expect(body.decided).toBe(1);
    expect(markWinner).not.toHaveBeenCalled();
  });

  it('returns 0 decided for pending experiment (< 100 impressions)', async () => {
    const exp = makeExperiment({
      impressionsA: 30,
      impressionsB: 30,
      conversionsA: 5,
      conversionsB: 1,
    });
    vi.mocked(getActiveExperimentsOlderThan).mockResolvedValue([exp]);

    const res = await GET(buildRequest());
    const body = await res.json() as { decided: number };
    expect(body.decided).toBe(0);
    expect(markWinner).not.toHaveBeenCalled();
  });

  it('handles multiple experiments in one pass', async () => {
    const expA = makeExperiment({
      id: 'exp-a',
      impressionsA: 200,
      impressionsB: 200,
      conversionsA: 40,
      conversionsB: 10,
    });
    const expB = makeExperiment({
      id: 'exp-b',
      impressionsA: 100,
      impressionsB: 100,
      conversionsA: 5,
      conversionsB: 25,
    });
    const expPending = makeExperiment({
      id: 'exp-pending',
      impressionsA: 10,
      impressionsB: 10,
    });

    vi.mocked(getActiveExperimentsOlderThan).mockResolvedValue([expA, expB, expPending]);

    const res = await GET(buildRequest());
    const body = await res.json() as {
      evaluated: number;
      decided: number;
      decisions: Array<{ id: string; winner: string }>;
    };

    expect(body.evaluated).toBe(3);
    expect(body.decided).toBe(2);

    const ids = body.decisions.map((d) => d.id);
    expect(ids).toContain('exp-a');
    expect(ids).toContain('exp-b');
    expect(ids).not.toContain('exp-pending');
  });
});
