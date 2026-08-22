/**
 * Integration tests for:
 *   POST /api/mission — create mission
 *   GET  /api/mission?workspaceId=X — list missions
 *   POST /api/mission/metrics — get mission metrics
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST, GET } from '../route';
import { POST as postMetrics } from '../metrics/route';

const m = vi.hoisted(() => {
  const cur = vi.fn();
  const prep = vi.fn().mockReturnValue({ bind: vi.fn().mockReturnThis(), first: vi.fn().mockResolvedValue(null) });
  const d1 = { prepare: prep };
  return {
    cur, prep, d1,
    createMission: vi.fn(), listMissions: vi.fn(), newMissionId: vi.fn().mockReturnValue('m1'),
    getMissionMetrics: vi.fn(),
  };
});

vi.mock('@/seed/auth/better-auth-session', () => ({ getCurrentUser: m.cur }));
vi.mock('@/seed/db/client', () => ({ createServerClient: vi.fn().mockReturnValue(m.d1) }));
vi.mock('@/tree/mission', () => ({
  createMission: m.createMission, listMissions: m.listMissions,
  newMissionId: m.newMissionId, getMissionMetrics: m.getMissionMetrics,
}));

const auth = () => m.cur.mockResolvedValueOnce({ id: 'user1' } as never);
const noAuth = () => m.cur.mockResolvedValueOnce(null);
const grant = () => m.prep().first.mockResolvedValueOnce({});
const POST_J = (url: string, body: Record<string, unknown>) =>
  new Request(url, { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } });
const NOW = 1000000;
const mission = (o: Record<string, unknown> = {}) => ({
  id: 'm1', workspaceId: 'ws_1', creatorId: 'user1', title: 'T', objective: '',
  audience: '', geography: '', timeframeStart: 0, timeframeEnd: 0, budgetCents: 0,
  spentCents: 0, autonomyLevel: 1, channels: [], monetizationGoals: [],
  constraints: {}, successMetrics: {}, status: 'draft', currentPhase: 'init',
  createdAt: NOW, updatedAt: NOW, ...o,
});

beforeEach(() => vi.clearAllMocks());

describe('POST /api/mission', () => {
  it('401 unauthenticated', async () => {
    noAuth();
    const r = await POST(POST_J('http://localhost/api/mission', { workspaceId: 'ws_1', title: 'T' }));
    expect(r.status).toBe(401);
  });
  it('400 missing required fields', async () => {
    auth();
    const r = await POST(POST_J('http://localhost/api/mission', { workspaceId: 'ws_1' }));
    expect(r.status).toBe(400);
  });
  it('403 workspace denied', async () => {
    auth();
    const r = await POST(POST_J('http://localhost/api/mission', { workspaceId: 'ws_1', title: 'T' }));
    expect(r.status).toBe(403);
  });
  it('201 creates mission', async () => {
    auth(); grant();
    m.createMission.mockResolvedValueOnce(mission());
    const r = await POST(POST_J('http://localhost/api/mission', { workspaceId: 'ws_1', title: 'Test' }));
    expect(r.status).toBe(201);
    const data = (await r.json()) as Record<string, unknown>;
    expect(data.title).toBe('T');
  });
});

describe('GET /api/mission', () => {
  it('401 unauthenticated', async () => {
    noAuth();
    const r = await GET(new Request('http://localhost/api/mission'));
    expect(r.status).toBe(401);
  });
  it('400 missing workspaceId', async () => {
    auth();
    const r = await GET(new Request('http://localhost/api/mission'));
    expect(r.status).toBe(400);
  });
  it('403 workspace denied', async () => {
    auth();
    const r = await GET(new Request('http://localhost/api/mission?workspaceId=ws_1'));
    expect(r.status).toBe(403);
  });
  it('200 lists missions with pagination', async () => {
    auth(); grant();
    m.listMissions.mockResolvedValueOnce([mission(), mission({ id: 'm2' })]);
    const r = await GET(new Request('http://localhost/api/mission?workspaceId=ws_1&limit=1&offset=0'));
    expect(r.status).toBe(200);
    const data = (await r.json()) as { missions: unknown[]; total: number };
    expect(data.missions).toHaveLength(1);
    expect(data.total).toBe(2);
  });
});

describe('POST /api/mission/metrics', () => {
  it('401 unauthenticated', async () => {
    noAuth();
    const r = await postMetrics(POST_J('http://localhost/api/mission/metrics', { workspaceId: 'ws_1', missionId: 'm1' }));
    expect(r.status).toBe(401);
  });
  it('400 missing fields', async () => {
    auth();
    const r = await postMetrics(POST_J('http://localhost/api/mission/metrics', { workspaceId: 'ws_1' }));
    expect(r.status).toBe(400);
  });
  it('403 workspace denied', async () => {
    auth();
    const r = await postMetrics(POST_J('http://localhost/api/mission/metrics', { workspaceId: 'ws_1', missionId: 'm1' }));
    expect(r.status).toBe(403);
  });
  it('200 returns metrics', async () => {
    auth(); grant();
    m.getMissionMetrics.mockResolvedValueOnce({ missionId: 'm1', spendCents: 0, goalProgress: [] });
    const r = await postMetrics(POST_J('http://localhost/api/mission/metrics', { workspaceId: 'ws_1', missionId: 'm1' }));
    expect(r.status).toBe(200);
    const data = (await r.json()) as Record<string, unknown>;
    expect(data.missionId).toBe('m1');
  });
});
