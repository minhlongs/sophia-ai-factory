import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '../route';

const mockGetCurrentUser = vi.fn();
const mockGetD1 = vi.fn();
const mockResolveOrgId = vi.fn();
const mockGetWorkspaceROI = vi.fn();

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: () => mockGetCurrentUser(),
}));

vi.mock('@/seed/db/client', () => ({
  getD1: () => mockGetD1(),
}));

vi.mock('@/seed/auth/workspace-access', () => ({
  resolveOrgId: (...args: unknown[]) => mockResolveOrgId(...args),
}));

vi.mock('@/tree/roi', () => ({
  getWorkspaceROI: (...args: unknown[]) => mockGetWorkspaceROI(...args),
}));

describe('POST /api/studio/pipeline/execute — zero-revenue, validation & provenance semantics (PR #357)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects invalid payload with HTTP 400', async () => {
    const req = new NextRequest('http://127.0.0.1:8788/api/studio/pipeline/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ platform: 'invalid_platform_xyz', grossUsd: -50 }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('preserves genuine $0 workspace revenue as live_d1 and passes $0 to financial engine', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'u-zero', email: 'zero@example.test' });
    mockGetD1.mockResolvedValue({});
    mockResolveOrgId.mockResolvedValue('org-zero');
    mockGetWorkspaceROI.mockResolvedValue({ totalRevenueCents: 0, totalCostCents: 0, roi: 0, unitCount: 0 });

    const req = new NextRequest('http://127.0.0.1:8788/api/studio/pipeline/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        script: 'Test zero revenue — SCENARIO_CRYPTO_SECURITY_VN_2026_MARKER',
        platform: 'facebook_reels',
        jurisdiction: 'EU',
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      ok: boolean;
      telemetrySource: string;
      results: Array<{ engineId: string; metricOutput?: string }>;
    };
    expect(body.ok).toBe(true);
    expect(body.telemetrySource).toBe('live_d1');
    expect(body.results).toHaveLength(39);
    const waterfall = body.results.find((r) => r.engineId === 'integer-cent-waterfall');
    expect(waterfall?.metricOutput).toContain('$0');
  });

  it('falls back to default_sample when workspace ROI telemetry is unavailable', async () => {
    mockGetCurrentUser.mockResolvedValue(null);

    const req = new NextRequest('http://127.0.0.1:8788/api/studio/pipeline/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        script: 'Test unavailable telemetry',
        platform: 'tiktok',
        jurisdiction: 'VN',
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; telemetrySource: string; results: Array<{ engineId: string }> };
    expect(body.ok).toBe(true);
    expect(body.telemetrySource).toBe('default_sample');
    expect(body.results).toHaveLength(39);
  });
});
