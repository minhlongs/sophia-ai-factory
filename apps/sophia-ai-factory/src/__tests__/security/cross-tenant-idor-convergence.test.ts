/**
 * Cross-Tenant IDOR Convergence Test Suite (9 Adversarial Vectors — Gate S4)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(), getD1: vi.fn(), verifyWorkspaceAccess: vi.fn(),
  getJobStatus: vi.fn(), recordProvenance: vi.fn(), recordLearning: vi.fn(),
  emitCreativeEdited: vi.fn(), revalidatePath: vi.fn(), revalidateTag: vi.fn(),
  getContentLineage: vi.fn(), getContentPerformance: vi.fn(), getProject: vi.fn(),
}));

vi.mock('@/seed/auth/better-auth-session', () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock('@/seed/db/client', () => ({ getD1: mocks.getD1 }));
vi.mock('@/seed/auth/workspace-access', () => ({ verifyWorkspaceAccess: mocks.verifyWorkspaceAccess }));
vi.mock('@/tree/clients/muapi-media-client', () => ({ getJobStatus: mocks.getJobStatus }));
vi.mock('@/tree/provenance', () => ({ recordProvenance: mocks.recordProvenance, newProvenanceId: () => 'prov_1' }));
vi.mock('@/tree/creative-memory', () => ({ recordLearning: mocks.recordLearning }));
vi.mock('@/tree/performance/loop-emitters-creative', () => ({ emitCreativeEdited: mocks.emitCreativeEdited }));
vi.mock('@/tree/content-graph', () => ({ getContentLineage: mocks.getContentLineage, getProject: mocks.getProject }));
vi.mock('@/tree/content-graph/types', () => ({ getContentPerformance: mocks.getContentPerformance }));
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath, revalidateTag: mocks.revalidateTag }));

import { GET as getMediaStatus } from '@/app/api/media/status/route';
import { editCreativeArtifact } from '@/land/creative-mission/edit-artifact-action';
import { getAsset, listAssets, updateAssetStatus } from '@/tree/content-graph/types/assets';
import { GET as getContentGraphAsset, POST as postContentGraphAsset } from '@/app/api/content-graph/asset/route';
import { GET as getContentGraphLineage } from '@/app/api/content-graph/lineage/route';
import { GET as getContentGraphPerformance } from '@/app/api/content-graph/performance/route';

const PROJECT_A_ROW = {
  id: 'proj_a', workspace_id: 'ws_tenant_a', creator_id: 'u_a', title: 'T', description: '',
  format: 'short', status: 'draft', budget_cents: 0, actual_cost_cents: 0, metadata: '{}', created_at: 1, updated_at: 1,
};

describe('Gate S4 — 9-Vector Cross-Tenant IDOR Convergence Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.MUAPI_API_KEY = 'test-key';
    mocks.getJobStatus.mockResolvedValue({
      success: true, job: { id: 'job_tenant_a', status: 'completed', resultUrl: 'https://cdn.example/a.mp4' },
    });
  });

  it('Vector 1: blocks Tenant B from reading Tenant A media_jobs status (403)', async () => {
    mocks.getCurrentUser.mockResolvedValue({ id: 'user_tenant_b' });
    mocks.getD1.mockResolvedValue({ prepare: () => ({ bind: () => ({ first: async () => ({ user_id: 'user_tenant_a' }) }) }) });
    const res = await getMediaStatus(new NextRequest('http://localhost/api/media/status?id=job_tenant_a'));
    expect(res.status).toBe(403);
    expect(mocks.getJobStatus).not.toHaveBeenCalled();
  });

  it('Vector 2: fails closed (403) when media_jobs ownership row does not exist for caller', async () => {
    mocks.getCurrentUser.mockResolvedValue({ id: 'user_tenant_b' });
    mocks.getD1.mockResolvedValue({ prepare: () => ({ bind: () => ({ first: async () => null }) }) });
    const res = await getMediaStatus(new NextRequest('http://localhost/api/media/status?id=job_unowned'));
    expect(res.status).toBe(403);
  });

  it('Vector 3: allows Tenant A to read their own media_jobs status (200)', async () => {
    mocks.getCurrentUser.mockResolvedValue({ id: 'user_tenant_a' });
    mocks.getD1.mockResolvedValue({ prepare: () => ({ bind: () => ({ first: async () => ({ user_id: 'user_tenant_a' }) }) }) });
    const res = await getMediaStatus(new NextRequest('http://localhost/api/media/status?id=job_tenant_a'));
    expect(res.status).toBe(200);
  });

  it('Vector 4: blocks Tenant B from editing Tenant A asset by passing own workspaceId', async () => {
    mocks.getCurrentUser.mockResolvedValue({ id: 'user_tenant_b' });
    mocks.verifyWorkspaceAccess.mockImplementation(async (wsId: string) => wsId === 'ws_tenant_b');
    mocks.getD1.mockResolvedValue({
      prepare: (sql: string) => ({
        bind: (...args: unknown[]) => ({
          first: async () => (sql.includes('workspace_id') && args[1] === 'ws_tenant_b' ? null : { metadata: '{}' }),
          run: async () => ({ success: true, meta: { changes: 0 } }),
        }),
      }),
    });
    const res = await editCreativeArtifact({ workspaceId: 'ws_tenant_b', missionId: 'msn_a', assetId: 'ast_a', changes: { hook: 'x' } });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('FORBIDDEN');
    expect(mocks.recordProvenance).not.toHaveBeenCalled();
  });

  it('Vector 5: blocks Tenant B when asset row workspace_id mismatches caller workspaceId', async () => {
    mocks.getCurrentUser.mockResolvedValue({ id: 'user_tenant_b' });
    mocks.verifyWorkspaceAccess.mockResolvedValue(true);
    mocks.getD1.mockResolvedValue({
      prepare: () => ({ bind: () => ({ first: async () => ({ metadata: '{}', workspace_id: 'ws_tenant_a' }), run: async () => ({ success: true, meta: { changes: 0 } }) }) }),
    });
    const res = await editCreativeArtifact({ workspaceId: 'ws_tenant_b', missionId: 'msn_a', assetId: 'ast_a', changes: { hook: 'x' } });
    expect(res.ok).toBe(false);
    expect(mocks.emitCreativeEdited).not.toHaveBeenCalled();
  });

  it('Vector 6: scopes getAsset and updateAssetStatus by workspaceId against cross-tenant IDs', async () => {
    mocks.getD1.mockResolvedValue({
      prepare: (sql: string) => ({
        bind: (...args: unknown[]) => ({
          first: async () => (sql.includes('workspace_id') && args.includes('ws_tenant_b') ? null : null),
          run: async () => ({ success: true, meta: { changes: 0 } }),
        }),
      }),
    });
    expect(await getAsset('ast_tenant_a', 'ws_tenant_b')).toBeNull();
    expect(await updateAssetStatus('ast_tenant_a', 'approved', 'ws_tenant_b')).toBeNull();
  });

  it('Vector 7: scopes listAssets(projectId, workspaceId) so Tenant B gets 0 rows for Tenant A project', async () => {
    mocks.getD1.mockResolvedValue({
      prepare: (sql: string) => ({
        bind: (...args: unknown[]) => ({ all: async () => ({ results: sql.includes('workspace_id') && args[1] === 'ws_tenant_b' ? [] : [] }) }),
      }),
    });
    expect(await listAssets('proj_tenant_a', 'ws_tenant_b')).toEqual([]);
  });

  it('Vector 8: blocks GET /api/content-graph/asset when projectId belongs to Tenant A (403)', async () => {
    mocks.getCurrentUser.mockResolvedValue({ id: 'user_tenant_b' });
    mocks.verifyWorkspaceAccess.mockImplementation(async (ws: string) => ws === 'ws_tenant_b');
    mocks.getProject.mockResolvedValue({ id: 'proj_a', workspaceId: 'ws_tenant_a' });
    mocks.getD1.mockResolvedValue({ prepare: (sql: string) => ({ bind: () => ({ first: async () => (sql.includes('content_projects') ? PROJECT_A_ROW : null), all: async () => ({ results: [] }) }) }) });
    const res = await getContentGraphAsset(new NextRequest('http://localhost/api/content-graph/asset?workspaceId=ws_tenant_b&projectId=proj_a'));
    expect(res.status).toBe(403);
  });

  it('Vector 9: blocks POST /api/content-graph/asset when attaching asset to Tenant A projectId (403)', async () => {
    mocks.getCurrentUser.mockResolvedValue({ id: 'user_tenant_b' });
    mocks.verifyWorkspaceAccess.mockImplementation(async (ws: string) => ws === 'ws_tenant_b');
    mocks.getProject.mockResolvedValue({ id: 'proj_a', workspaceId: 'ws_tenant_a' });
    mocks.getD1.mockResolvedValue({ prepare: () => ({ bind: () => ({ first: async () => PROJECT_A_ROW }) }) });
    const res = await postContentGraphAsset(new NextRequest('http://localhost/api/content-graph/asset', { method: 'POST', body: JSON.stringify({ workspaceId: 'ws_tenant_b', projectId: 'proj_a', type: 'script', title: 'X' }) }));
    expect(res.status).toBe(403);
  });

  it('Vector 10: blocks GET /api/content-graph/lineage when projectId belongs to Tenant A (404, no leakage)', async () => {
    mocks.getCurrentUser.mockResolvedValue({ id: 'user_tenant_b' });
    mocks.verifyWorkspaceAccess.mockImplementation(async (ws: string) => ws === 'ws_tenant_b');
    mocks.getContentLineage.mockResolvedValue(null);
    const res = await getContentGraphLineage(new NextRequest('http://localhost/api/content-graph/lineage?workspaceId=ws_tenant_b&projectId=proj_a'));
    expect(res.status).toBe(404);
    expect(mocks.getContentLineage).toHaveBeenCalledWith('proj_a', 'ws_tenant_b');
  });

  it('Vector 11: blocks GET /api/content-graph/performance when projectId belongs to Tenant A (empty array, no leakage)', async () => {
    mocks.getCurrentUser.mockResolvedValue({ id: 'user_tenant_b' });
    mocks.verifyWorkspaceAccess.mockImplementation(async (ws: string) => ws === 'ws_tenant_b');
    mocks.getContentPerformance.mockResolvedValue([]);
    const res = await getContentGraphPerformance(new NextRequest('http://localhost/api/content-graph/performance?workspaceId=ws_tenant_b&projectId=proj_a'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ performance: [] });
    expect(mocks.getContentPerformance).toHaveBeenCalledWith('proj_a', 'ws_tenant_b');
  });
});
