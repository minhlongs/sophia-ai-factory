/**
 * Integration tests for content-graph API routes:
 *   POST/GET /api/content-graph, /asset, /derivative, /lineage, /performance
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST, GET } from '../route';
import { POST as postAsset, GET as getAsset } from '../asset/route';
import { POST as postDerivative } from '../derivative/route';
import { GET as getLineage } from '../lineage/route';
import { GET as getPerformance } from '../performance/route';

const m = vi.hoisted(() => {
  const cur = vi.fn();
  const prep = vi.fn().mockReturnValue({ bind: vi.fn().mockReturnThis(), first: vi.fn().mockResolvedValue(null) });
  const d1 = { prepare: prep };
  return {
    cur, prep, d1,
    createProject: vi.fn(), listProjects: vi.fn(), newProjectId: vi.fn().mockReturnValue('p1'),
    createAsset: vi.fn(), listAssets: vi.fn(), newAssetId: vi.fn().mockReturnValue('a1'),
    createDerivative: vi.fn(), getLineage: vi.fn(), getPerf: vi.fn(),
  };
});

vi.mock('@/seed/auth/better-auth-session', () => ({ getCurrentUser: m.cur }));
vi.mock('@/seed/db/client', () => ({ createServerClient: vi.fn().mockReturnValue(m.d1) }));
vi.mock('@/tree/content-graph', () => ({
  createProject: m.createProject, listProjects: m.listProjects,
  newProjectId: m.newProjectId, createAsset: m.createAsset,
  listAssets: m.listAssets, newAssetId: m.newAssetId,
  createDerivative: m.createDerivative, getContentLineage: m.getLineage,
}));
vi.mock('@/tree/content-graph/types', () => ({ getContentPerformance: m.getPerf }));

const auth = () => m.cur.mockResolvedValueOnce({ id: 'user1' } as never);
const noAuth = () => m.cur.mockResolvedValueOnce(null);
const grant = () => m.prep().first.mockResolvedValueOnce({});
const POST_J = (url: string, body: Record<string, unknown>) =>
  new NextRequest(url, { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } });
const NOW = 1000000;
const proj = (o: Record<string, unknown> = {}) => ({
  id: 'p1', workspaceId: 'ws_1', creatorId: 'user1', title: 'T', description: '',
  format: 'video_short', status: 'draft', budgetCents: 0, actualCostCents: 0,
  metadata: {}, createdAt: NOW, updatedAt: NOW, ...o,
});

beforeEach(() => vi.clearAllMocks());

describe('POST /api/content-graph', () => {
  it('401 unauthenticated', async () => {
    noAuth();
    const r = await POST(POST_J('http://localhost/api/content-graph', { workspaceId: 'ws_1', title: 'T' }));
    expect(r.status).toBe(401);
  });
  it('400 missing fields', async () => {
    auth();
    const r = await POST(POST_J('http://localhost/api/content-graph', { workspaceId: 'ws_1' }));
    expect(r.status).toBe(400);
  });
  it('403 workspace denied', async () => {
    auth();
    const r = await POST(POST_J('http://localhost/api/content-graph', { workspaceId: 'ws_1', title: 'T' }));
    expect(r.status).toBe(403);
  });
  it('201 creates project', async () => {
    auth(); grant();
    m.createProject.mockResolvedValueOnce(proj());
    const r = await POST(POST_J('http://localhost/api/content-graph', { workspaceId: 'ws_1', title: 'Test' }));
    expect(r.status).toBe(201);
    expect((await r.json() as Record<string, unknown>).title).toBe('T');
  });
});

describe('GET /api/content-graph', () => {
  it('401 unauthenticated', async () => { noAuth(); expect((await GET(new NextRequest('http://localhost/api/content-graph'))).status).toBe(401); });
  it('400 missing workspaceId', async () => { auth(); expect((await GET(new NextRequest('http://localhost/api/content-graph'))).status).toBe(400); });
  it('200 lists projects', async () => {
    auth(); grant(); m.listProjects.mockResolvedValueOnce([proj()]);
    const r = await GET(new NextRequest('http://localhost/api/content-graph?workspaceId=ws_1'));
    expect(r.status).toBe(200);
    expect(((await r.json()) as { projects: unknown[] }).projects).toHaveLength(1);
  });
});

describe('POST /api/content-graph/asset', () => {
  const mkBody = { workspaceId: 'ws_1', projectId: 'p1', type: 'script', title: 'S1' };
  it('401 unauthenticated', async () => { noAuth(); expect((await postAsset(POST_J('http://localhost/api/content-graph/asset', mkBody))).status).toBe(401); });
  it('400 missing fields', async () => { auth(); expect((await postAsset(POST_J('http://localhost/api/content-graph/asset', { workspaceId: 'ws_1' }))).status).toBe(400); });
  it('403 workspace denied', async () => { auth(); expect((await postAsset(POST_J('http://localhost/api/content-graph/asset', mkBody))).status).toBe(403); });
  it('201 creates asset', async () => {
    auth(); grant();
    m.createAsset.mockResolvedValueOnce({ id: 'a1', workspaceId: 'ws_1', projectId: 'p1', type: 'script', status: 'draft', metadata: { title: 'S1' }, createdAt: NOW, updatedAt: NOW });
    const r = await postAsset(POST_J('http://localhost/api/content-graph/asset', mkBody));
    expect(r.status).toBe(201);
  });
});

describe('GET /api/content-graph/asset', () => {
  it('401 unauthenticated', async () => { noAuth(); expect((await getAsset(new NextRequest('http://localhost/api/content-graph/asset'))).status).toBe(401); });
  it('400 missing params', async () => { auth(); expect((await getAsset(new NextRequest('http://localhost/api/content-graph/asset?workspaceId=ws_1'))).status).toBe(400); });
  it('200 lists assets', async () => {
    auth(); grant(); m.listAssets.mockResolvedValueOnce([{ id: 'a1', type: 'script' }]);
    const r = await getAsset(new NextRequest('http://localhost/api/content-graph/asset?workspaceId=ws_1&projectId=p1'));
    expect(r.status).toBe(200);
    expect(((await r.json()) as { assets: unknown[] }).assets).toHaveLength(1);
  });
});

describe('POST /api/content-graph/derivative', () => {
  const mkBody = { workspaceId: 'ws_1', sourceAssetId: 's1', derivativeAssetId: 'd1' };
  it('401 unauthenticated', async () => { noAuth(); expect((await postDerivative(POST_J('http://localhost/api/content-graph/derivative', mkBody))).status).toBe(401); });
  it('400 missing fields', async () => { auth(); expect((await postDerivative(POST_J('http://localhost/api/content-graph/derivative', { workspaceId: 'ws_1' }))).status).toBe(400); });
  it('403 workspace denied', async () => { auth(); expect((await postDerivative(POST_J('http://localhost/api/content-graph/derivative', mkBody))).status).toBe(403); });
  it('201 creates derivative', async () => {
    auth(); grant();
    m.createDerivative.mockResolvedValueOnce({ id: 'a1', workspaceId: 'ws_1', sourceAssetId: 's1', parentAssetId: 'd1', type: 'remix', metadata: {}, createdAt: NOW });
    const r = await postDerivative(POST_J('http://localhost/api/content-graph/derivative', mkBody));
    expect(r.status).toBe(201);
  });
});

describe('GET /api/content-graph/lineage', () => {
  it('401 unauthenticated', async () => { noAuth(); expect((await getLineage(new NextRequest('http://localhost/api/content-graph/lineage'))).status).toBe(401); });
  it('400 missing params', async () => { auth(); expect((await getLineage(new NextRequest('http://localhost/api/content-graph/lineage?workspaceId=ws_1'))).status).toBe(400); });
  it('404 project not found', async () => { auth(); grant(); m.getLineage.mockResolvedValueOnce(null); expect((await getLineage(new NextRequest('http://localhost/api/content-graph/lineage?workspaceId=ws_1&projectId=p1'))).status).toBe(404); });
  it('200 returns lineage', async () => { auth(); grant(); m.getLineage.mockResolvedValueOnce({ project: { id: 'p1' }, derivatives: [] }); expect((await getLineage(new NextRequest('http://localhost/api/content-graph/lineage?workspaceId=ws_1&projectId=p1'))).status).toBe(200); });
});

describe('GET /api/content-graph/performance', () => {
  it('401 unauthenticated', async () => { noAuth(); expect((await getPerformance(new NextRequest('http://localhost/api/content-graph/performance'))).status).toBe(401); });
  it('400 missing params', async () => { auth(); expect((await getPerformance(new NextRequest('http://localhost/api/content-graph/performance?workspaceId=ws_1'))).status).toBe(400); });
  it('200 returns performance', async () => {
    auth(); grant(); m.getPerf.mockResolvedValueOnce([]);
    const r = await getPerformance(new NextRequest('http://localhost/api/content-graph/performance?workspaceId=ws_1&projectId=p1'));
    expect(r.status).toBe(200);
    expect(((await r.json()) as { performance: unknown[] }).performance).toEqual([]);
  });
});
