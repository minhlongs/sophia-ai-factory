/**
 * Integration tests for GET/PATCH/DELETE /api/mission/[id]
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, PATCH, DELETE } from '../route';

const m = vi.hoisted(() => {
  const cur = vi.fn();
  const prep = vi.fn().mockReturnValue({ bind: vi.fn().mockReturnThis(), first: vi.fn().mockResolvedValue(null) });
  const d1 = { prepare: prep };
  return {
    cur, prep, d1,
    getMissionWithGoals: vi.fn(),
    updateMissionStatus: vi.fn(),
    deleteMission: vi.fn(),
  };
});

vi.mock('@/seed/auth/better-auth-session', () => ({ getCurrentUser: m.cur }));
vi.mock('@/seed/db/client', () => ({ createServerClient: vi.fn().mockReturnValue(m.d1) }));
vi.mock('@/tree/mission', () => ({
  getMissionWithGoals: m.getMissionWithGoals,
  updateMissionStatus: m.updateMissionStatus,
  deleteMission: m.deleteMission,
}));

const auth = () => m.cur.mockResolvedValueOnce({ id: 'user1' } as never);
const noAuth = () => m.cur.mockResolvedValueOnce(null);
const grant = () => m.prep().first.mockResolvedValueOnce({});
const PATCH_J = (url: string, body: Record<string, unknown>) =>
  new Request(url, { method: 'PATCH', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } });
const params = (id: string) => ({ params: Promise.resolve({ id }) });
const mission = (o: Record<string, unknown> = {}) => ({
  id: 'm1', workspaceId: 'ws_1', title: 'T', status: 'draft', goals: [], ...o,
});

beforeEach(() => vi.clearAllMocks());

describe('GET /api/mission/[id]', () => {
  it('401 unauthenticated', async () => {
    noAuth();
    const r = await GET(new Request('http://localhost/api/mission/m1?workspaceId=ws_1'), params('m1'));
    expect(r.status).toBe(401);
  });
  it('400 missing workspaceId', async () => {
    auth();
    const r = await GET(new Request('http://localhost/api/mission/m1'), params('m1'));
    expect(r.status).toBe(400);
  });
  it('403 workspace denied', async () => {
    auth();
    const r = await GET(new Request('http://localhost/api/mission/m1?workspaceId=ws_1'), params('m1'));
    expect(r.status).toBe(403);
  });
  it('404 mission not found', async () => {
    auth(); grant(); m.getMissionWithGoals.mockResolvedValueOnce(null);
    const r = await GET(new Request('http://localhost/api/mission/m1?workspaceId=ws_1'), params('m1'));
    expect(r.status).toBe(404);
  });
  it('200 returns mission with goals', async () => {
    auth(); grant(); m.getMissionWithGoals.mockResolvedValueOnce(mission());
    const r = await GET(new Request('http://localhost/api/mission/m1?workspaceId=ws_1'), params('m1'));
    expect(r.status).toBe(200);
    const data = (await r.json()) as Record<string, unknown>;
    expect(data.id).toBe('m1');
  });
  it('403 when mission belongs to another workspace (IDOR guard)', async () => {
    auth(); grant(); m.getMissionWithGoals.mockResolvedValueOnce(mission({ workspaceId: 'ws_other' }));
    const r = await GET(new Request('http://localhost/api/mission/m1?workspaceId=ws_1'), params('m1'));
    expect(r.status).toBe(403);
  });
});

describe('PATCH /api/mission/[id]', () => {
  const validBody = { workspaceId: 'ws_1', status: 'running', currentPhase: 'exec' };
  it('401 unauthenticated', async () => {
    noAuth();
    const r = await PATCH(PATCH_J('http://localhost/api/mission/m1', validBody), params('m1'));
    expect(r.status).toBe(401);
  });
  it('400 missing fields', async () => {
    auth();
    const r = await PATCH(PATCH_J('http://localhost/api/mission/m1', { workspaceId: 'ws_1' }), params('m1'));
    expect(r.status).toBe(400);
  });
  it('403 workspace denied', async () => {
    auth();
    const r = await PATCH(PATCH_J('http://localhost/api/mission/m1', validBody), params('m1'));
    expect(r.status).toBe(403);
  });
  it('200 updates mission status', async () => {
    auth(); grant();
    m.updateMissionStatus.mockResolvedValueOnce(mission({ status: 'running' }));
    const r = await PATCH(PATCH_J('http://localhost/api/mission/m1', validBody), params('m1'));
    expect(r.status).toBe(200);
    const data = (await r.json()) as Record<string, unknown>;
    expect(data.status).toBe('running');
  });
  it('409 invalid transition', async () => {
    auth(); grant();
    m.updateMissionStatus.mockRejectedValueOnce(new Error('INVALID_TRANSITION draft->completed'));
    const r = await PATCH(PATCH_J('http://localhost/api/mission/m1', { ...validBody, status: 'completed' }), params('m1'));
    expect(r.status).toBe(409);
  });
  it('404 mission not found on update', async () => {
    auth(); grant();
    m.updateMissionStatus.mockRejectedValueOnce(new Error('mission not found'));
    const r = await PATCH(PATCH_J('http://localhost/api/mission/m1', validBody), params('m1'));
    expect(r.status).toBe(404);
  });
  it('403 when mission does not belong to workspace on update (IDOR guard)', async () => {
    auth(); grant();
    m.updateMissionStatus.mockRejectedValueOnce(new Error('Mission m1 does not belong to workspace ws_1'));
    const r = await PATCH(PATCH_J('http://localhost/api/mission/m1', validBody), params('m1'));
    expect(r.status).toBe(403);
  });
});

describe('DELETE /api/mission/[id]', () => {
  it('401 unauthenticated', async () => {
    noAuth();
    const r = await DELETE(new Request('http://localhost/api/mission/m1?workspaceId=ws_1'), params('m1'));
    expect(r.status).toBe(401);
  });
  it('400 missing workspaceId', async () => {
    auth();
    const r = await DELETE(new Request('http://localhost/api/mission/m1'), params('m1'));
    expect(r.status).toBe(400);
  });
  it('403 workspace denied', async () => {
    auth();
    const r = await DELETE(new Request('http://localhost/api/mission/m1?workspaceId=ws_1'), params('m1'));
    expect(r.status).toBe(403);
  });
  it('200 deletes mission', async () => {
    auth(); grant(); m.deleteMission.mockResolvedValueOnce(undefined);
    const r = await DELETE(new Request('http://localhost/api/mission/m1?workspaceId=ws_1'), params('m1'));
    expect(r.status).toBe(200);
    const data = (await r.json()) as Record<string, unknown>;
    expect(data.ok).toBe(true);
  });
  it('403 when mission does not belong to workspace on delete (IDOR guard)', async () => {
    auth(); grant();
    m.deleteMission.mockRejectedValueOnce(new Error('Mission m1 does not belong to workspace ws_1'));
    const r = await DELETE(new Request('http://localhost/api/mission/m1?workspaceId=ws_1'), params('m1'));
    expect(r.status).toBe(403);
  });
});
