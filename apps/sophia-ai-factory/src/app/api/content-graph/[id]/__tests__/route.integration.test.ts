/**
 * Integration tests for GET/PATCH /api/content-graph/[id]
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, PATCH } from '../route';

const m = vi.hoisted(() => {
  const cur = vi.fn();
  const prep = vi.fn().mockReturnValue({ bind: vi.fn().mockReturnThis(), first: vi.fn().mockResolvedValue(null) });
  const d1 = { prepare: prep };
  return {
    cur, prep, d1,
    getProject: vi.fn(),
    updateProjectStatus: vi.fn(),
  };
});

vi.mock('@/seed/auth/better-auth-session', () => ({ getCurrentUser: m.cur }));
vi.mock('@/seed/db/client', () => ({ createServerClient: vi.fn().mockReturnValue(m.d1) }));
vi.mock('@/tree/content-graph', () => ({
  getProject: m.getProject,
  updateProjectStatus: m.updateProjectStatus,
}));

const auth = () => m.cur.mockResolvedValueOnce({ id: 'user1' } as never);
const noAuth = () => m.cur.mockResolvedValueOnce(null);
const grant = () => m.prep().first.mockResolvedValueOnce({});
const PATCH_J = (url: string, body: Record<string, unknown>) =>
  new NextRequest(url, { method: 'PATCH', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } });
const mkProject = (overrides: Record<string, unknown> = {}) => ({
  id: 'proj_1', workspaceId: 'ws_1', creatorId: 'user1', title: 'T',
  description: '', format: 'video_short', status: 'draft', budgetCents: 0,
  actualCostCents: 0, metadata: {}, createdAt: 1000, updatedAt: 1000, ...overrides,
});

beforeEach(() => vi.clearAllMocks());

const params = (id: string) => ({ params: Promise.resolve({ id }) });

describe('GET /api/content-graph/[id]', () => {
  it('401 unauthenticated', async () => {
    noAuth();
    const r = await GET(new NextRequest('http://localhost/api/content-graph/proj_1'), params('proj_1'));
    expect(r.status).toBe(401);
  });
  it('404 project not found', async () => {
    auth(); m.getProject.mockResolvedValueOnce(null);
    const r = await GET(new NextRequest('http://localhost/api/content-graph/proj_1'), params('proj_1'));
    expect(r.status).toBe(404);
  });
  it('403 workspace access denied', async () => {
    auth(); m.getProject.mockResolvedValueOnce(mkProject());
    const r = await GET(new NextRequest('http://localhost/api/content-graph/proj_1'), params('proj_1'));
    expect(r.status).toBe(403);
  });
  it('200 returns project', async () => {
    auth(); grant(); m.getProject.mockResolvedValueOnce(mkProject());
    const r = await GET(new NextRequest('http://localhost/api/content-graph/proj_1'), params('proj_1'));
    expect(r.status).toBe(200);
    const data = (await r.json()) as { project: Record<string, unknown> };
    expect(data.project.id).toBe('proj_1');
  });
});

describe('PATCH /api/content-graph/[id]', () => {
  it('401 unauthenticated', async () => {
    noAuth();
    const r = await PATCH(PATCH_J('http://localhost/api/content-graph/proj_1', { status: 'published' }), params('proj_1'));
    expect(r.status).toBe(401);
  });
  it('400 missing status', async () => {
    auth();
    const r = await PATCH(PATCH_J('http://localhost/api/content-graph/proj_1', {}), params('proj_1'));
    expect(r.status).toBe(400);
  });
  it('404 project not found', async () => {
    auth(); m.getProject.mockResolvedValueOnce(null);
    const r = await PATCH(PATCH_J('http://localhost/api/content-graph/proj_1', { status: 'published' }), params('proj_1'));
    expect(r.status).toBe(404);
  });
  it('403 workspace access denied', async () => {
    auth(); m.getProject.mockResolvedValueOnce(mkProject());
    const r = await PATCH(PATCH_J('http://localhost/api/content-graph/proj_1', { status: 'published' }), params('proj_1'));
    expect(r.status).toBe(403);
  });
  it('200 updates project status', async () => {
    auth(); grant();
    m.getProject.mockResolvedValueOnce(mkProject());
    m.updateProjectStatus.mockResolvedValueOnce(mkProject({ status: 'published' }));
    const r = await PATCH(PATCH_J('http://localhost/api/content-graph/proj_1', { status: 'published' }), params('proj_1'));
    expect(r.status).toBe(200);
    const data = (await r.json()) as { project: Record<string, unknown> };
    expect(data.project.status).toBe('published');
  });
});
