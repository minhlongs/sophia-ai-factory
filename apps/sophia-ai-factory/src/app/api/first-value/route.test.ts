import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getCurrentUserMock, verifyWorkspaceAccessMock } = vi.hoisted(() => ({
  getCurrentUserMock: vi.fn(),
  verifyWorkspaceAccessMock: vi.fn(),
}));

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: getCurrentUserMock,
}));

vi.mock('@/seed/auth/workspace-access', () => ({
  verifyWorkspaceAccess: verifyWorkspaceAccessMock,
}));

import { POST } from './route';

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/first-value', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

describe('POST /api/first-value', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentUserMock.mockResolvedValue({ id: 'user-1', email: 'founder@example.com' });
    verifyWorkspaceAccessMock.mockResolvedValue(true);
  });

  it('returns 401 for unauthenticated requests', async () => {
    getCurrentUserMock.mockResolvedValue(null);
    const res = await POST(
      makeRequest({
        action: 'cost_preview',
        orgId: 'org-1',
        topic: 'Launch',
        audience: 'Founders',
      }),
    );
    expect(res.status).toBe(401);
    expect(res.headers.get('cache-control')).toBe('private, no-store');
  });

  it('returns 400 for invalid JSON and schema violations', async () => {
    const badJson = await POST(makeRequest('{invalid'));
    expect(badJson.status).toBe(400);

    const badSchema = await POST(makeRequest({ action: 'cost_preview', orgId: '' }));
    expect(badSchema.status).toBe(400);
  });

  it('returns 403 when user does not belong to requested organization', async () => {
    verifyWorkspaceAccessMock.mockResolvedValue(false);
    const res = await POST(
      makeRequest({
        action: 'cost_preview',
        orgId: 'org-other',
        topic: 'Launch',
        audience: 'Founders',
      }),
    );
    expect(res.status).toBe(403);
  });

  it('returns deterministic cost preview and COST_ESTIMATE_UNAVAILABLE when unpriced', async () => {
    const available = await POST(
      makeRequest({
        action: 'cost_preview',
        orgId: 'org-1',
        provider: 'openrouter',
        model: 'openai/gpt-4o-mini',
        topic: 'Cafe promo',
        audience: 'Local owners',
        durationSec: 30,
      }),
    );
    expect(available.status).toBe(200);
    const availableBody = (await available.json()) as {
      paidInferenceExecuted: boolean;
      preview: { status: string; estimatedCostRangeUsd: { minUsd: number; maxUsd: number } };
    };
    expect(availableBody.paidInferenceExecuted).toBe(false);
    expect(availableBody.preview.status).toBe('COST_ESTIMATE_AVAILABLE');
    expect(availableBody.preview.estimatedCostRangeUsd.minUsd).toBeGreaterThan(0);

    const unavailable = await POST(
      makeRequest({
        action: 'cost_preview',
        orgId: 'org-1',
        provider: 'openrouter',
        model: 'unknown/unpriced-model',
        topic: 'Cafe promo',
        audience: 'Local owners',
      }),
    );
    expect(unavailable.status).toBe(200);
    const unavailableBody = (await unavailable.json()) as {
      preview: { status: string; estimatedCostRangeUsd: null };
    };
    expect(unavailableBody.preview.status).toBe('COST_ESTIMATE_UNAVAILABLE');
    expect(unavailableBody.preview.estimatedCostRangeUsd).toBeNull();
  });

  it('returns labeled fixture preview with private no-store headers and publicPublished=false', async () => {
    const res = await POST(
      makeRequest({
        action: 'fixture_preview',
        orgId: 'org-1',
        topic: 'Bakery intro',
        audience: 'Founders',
        durationSec: 30,
      }),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('private, no-store');
    const body = (await res.json()) as {
      provenance: string;
      provenanceLabel: string;
      reviewState: string;
      publicPublished: boolean;
      paidInferenceExecuted: boolean;
      script: { scenes: unknown[] };
    };
    expect(body.provenance).toBe('fixture_simulated');
    expect(body.provenanceLabel).toBe('SIMULATED_FIXTURE_NOT_LIVE_AI_INFERENCE');
    expect(body.reviewState).toBe('pending_review');
    expect(body.publicPublished).toBe(false);
    expect(body.paidInferenceExecuted).toBe(false);
    expect(body.script.scenes.length).toBe(3);
  });
});
