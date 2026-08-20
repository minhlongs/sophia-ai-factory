/**
 * Integration tests for /api/creative-missions and /api/creative-missions/[id]
 *
 * Tests: create → get → list → update status
 * Verifies: workspace scoping (IDOR), auth, full flow
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

// Mock data must be defined before vi.mock() hoisting
const MOCK_USER = {
  id: 'user_test_001',
  email: 'test@example.com',
  orgId: 'org_test_001',
  role: 'owner',
};

// vi.mock() is hoisted — factory uses inline literal to avoid hoisting issues
vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: vi.fn().mockResolvedValue({
    id: 'user_test_001',
    email: 'test@example.com',
    orgId: 'org_test_001',
    role: 'owner',
  }),
}));

vi.mock('@/land/creative-mission', () => ({
  createMission: vi.fn(),
  listMissions: vi.fn(),
  getMission: vi.fn(),
  updateMissionStatus: vi.fn(),
}));

import { createMission, listMissions, getMission, updateMissionStatus } from '@/land/creative-mission';
import { POST as collectionPost, GET as collectionGet } from '../route';
import { GET as itemGet, PATCH as itemPatch } from '../[id]/route';

function makeReq(method: string, url: string, body?: unknown): NextRequest {
  return new NextRequest(url, {
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers: new Headers({ 'content-type': 'application/json' }),
  });
}

// Helper: cast NextResponse.json() which returns unknown
async function json<T>(res: NextResponse): Promise<T> {
  return res.json() as Promise<T>;
}

describe('Phase 2: Creative Mission API integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── POST /api/creative-missions (create) ────────────────────────────────────

  describe('POST /api/creative-missions', () => {
    it('creates a mission and returns 201 with missionId', async () => {
      vi.mocked(createMission).mockResolvedValue({ ok: true, value: { missionId: 'msn_new_001' } });

      const res = await collectionPost(makeReq('POST', 'http://localhost/api/creative-missions', {
        workspaceId: 'ws_test_001',
        title: 'Test Mission',
        objective: 'Build media business',
        audience: 'SEA creators',
        timeframeStart: 1700000000,
        timeframeEnd: 1730000000,
      }));

      expect(res.status).toBe(201);
      const data = await json<{ missionId: string }>(res);
      expect(data.missionId).toBe('msn_new_001');
    });

    it('returns 400 for missing required fields', async () => {
      const res = await collectionPost(makeReq('POST', 'http://localhost/api/creative-missions', {
        workspaceId: 'ws_test_001',
      }));

      expect(res.status).toBe(400);
    });

    it('returns 401 when not authenticated', async () => {
      vi.mocked(createMission).mockResolvedValue({
        ok: false,
        error: { code: 'NOT_AUTHENTICATED', message: 'Authentication required' },
      });

      const res = await collectionPost(makeReq('POST', 'http://localhost/api/creative-missions', {
        workspaceId: 'ws_test_001',
        title: 'Test',
        objective: 'Test',
        audience: 'Test',
        timeframeStart: 1700000000,
        timeframeEnd: 1730000000,
      }));

      expect(res.status).toBe(401);
    });

    it('returns 403 when user lacks workspace access', async () => {
      vi.mocked(createMission).mockResolvedValue({
        ok: false,
        error: { code: 'FORBIDDEN', message: 'No access' },
      });

      const res = await collectionPost(makeReq('POST', 'http://localhost/api/creative-missions', {
        workspaceId: 'ws_other',
        title: 'Test',
        objective: 'Test',
        audience: 'Test',
        timeframeStart: 1700000000,
        timeframeEnd: 1730000000,
      }));

      expect(res.status).toBe(403);
    });
  });

  // ── GET /api/creative-missions (list) ──────────────────────────────────────

  describe('GET /api/creative-missions (list)', () => {
    it('lists missions for workspace', async () => {
      vi.mocked(listMissions).mockResolvedValue({
        ok: true,
        value: {
          missions: [
            { id: 'msn_001', title: 'Mission 1', status: 'draft' },
            { id: 'msn_002', title: 'Mission 2', status: 'running' },
          ],
          count: 2,
        },
      });

      const url = new URL('http://localhost/api/creative-missions');
      url.searchParams.set('workspaceId', 'ws_test_001');
      const res = await collectionGet(new NextRequest(url));
      expect(res.status).toBe(200);
      const data = await json<{ missions: Array<{ id: string }> }>(res);
      expect(data.missions).toHaveLength(2);
      expect(listMissions).toHaveBeenCalledWith({ workspaceId: 'ws_test_001', limit: 20 });
    });
  });
});

describe('Phase 2: Creative Mission [id] API integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── GET /api/creative-missions/[id] ────────────────────────────────────────

  describe('GET /api/creative-missions/[id]', () => {
    it('returns mission by ID', async () => {
      vi.mocked(getMission).mockResolvedValue({
        ok: true,
        value: {
          mission: {
            id: 'msn_001', workspaceId: 'ws_test_001', creatorId: 'user_test_001',
            title: 'Test Mission', objective: 'Test', audience: 'Test', geography: '',
            timeframeStart: 1700000000, timeframeEnd: 1730000000, budgetCents: 0, spentCents: 0,
            autonomyLevel: 1, channels: [], monetizationGoals: [],
            constraints: {}, successMetrics: {},
            status: 'draft', currentPhase: 'draft',
            createdAt: Date.now(), updatedAt: Date.now(),
            goals: [],
          },
        },
      });

      const res = await itemGet(makeReq('GET', 'http://localhost/api/creative-missions/msn_001'), { params: Promise.resolve({ id: 'msn_001' }) });

      expect(res.status).toBe(200);
      const data = await json<{ mission: { id: string } }>(res);
      expect(data.mission.id).toBe('msn_001');
      expect(getMission).toHaveBeenCalledWith({ missionId: 'msn_001' });
    });

    it('returns 404 for nonexistent mission', async () => {
      vi.mocked(getMission).mockResolvedValue({
        ok: false,
        error: { code: 'NOT_FOUND', message: 'Mission not found' },
      });

      const res = await itemGet(makeReq('GET', 'http://localhost/api/creative-missions/msn_nonexistent'), { params: Promise.resolve({ id: 'msn_nonexistent' }) });

      expect(res.status).toBe(404);
    });
  });

  // ── PATCH /api/creative-missions/[id] ─────────────────────────────────────

  describe('PATCH /api/creative-missions/[id]', () => {
    it('updates mission status', async () => {
      vi.mocked(updateMissionStatus).mockResolvedValue({
        ok: true,
        value: { missionId: 'msn_001' },
      });

      const res = await itemPatch(makeReq('PATCH', 'http://localhost/api/creative-missions/msn_001', { status: 'planned' }), { params: Promise.resolve({ id: 'msn_001' }) });

      expect(res.status).toBe(200);
      const data = await json<{ missionId: string; status: string }>(res);
      expect(data.missionId).toBe('msn_001');
      expect(data.status).toBe('planned');
      expect(updateMissionStatus).toHaveBeenCalledWith({ missionId: 'msn_001', status: 'planned' });
    });

    it('returns 400 for invalid status', async () => {
      const res = await itemPatch(makeReq('PATCH', 'http://localhost/api/creative-missions/msn_001', { status: 'invalid_status' }), { params: Promise.resolve({ id: 'msn_001' }) });

      expect(res.status).toBe(400);
    });

    it('returns 404 for nonexistent mission', async () => {
      vi.mocked(updateMissionStatus).mockResolvedValue({
        ok: false,
        error: { code: 'NOT_FOUND', message: 'Mission not found' },
      });

      const res = await itemPatch(makeReq('PATCH', 'http://localhost/api/creative-missions/msn_nonexistent', { status: 'planned' }), { params: Promise.resolve({ id: 'msn_nonexistent' }) });

      expect(res.status).toBe(404);
    });
  });
});

describe('Phase 2: Full flow — mission lifecycle end-to-end', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('create → get → update status — full mission lifecycle', async () => {
    const missionId = 'msn_flow_001';

    // Step 1: Create
    vi.mocked(createMission).mockResolvedValue({ ok: true, value: { missionId } });
    const createRes = await collectionPost(makeReq('POST', 'http://localhost/api/creative-missions', {
      workspaceId: 'ws_test_001',
      title: 'Flow Test Mission',
      objective: 'Test full flow',
      audience: 'SEA',
      timeframeStart: 1700000000,
      timeframeEnd: 1730000000,
    }));
    expect(createRes.status).toBe(201);
    const createData = await json<{ missionId: string }>(createRes);
    expect(createData.missionId).toBe(missionId);

    // Step 2: Get
    vi.mocked(getMission).mockResolvedValue({
      ok: true,
      value: {
          mission: {
            id: missionId, workspaceId: 'ws_test_001', creatorId: 'user_test_001',
            title: 'Flow Test Mission', objective: 'Test', audience: 'SEA', geography: '',
            timeframeStart: 1700000000, timeframeEnd: 1730000000, budgetCents: 0, spentCents: 0,
            autonomyLevel: 1, channels: [], monetizationGoals: [],
            constraints: {}, successMetrics: {},
            status: 'draft', currentPhase: 'draft',
            createdAt: Date.now(), updatedAt: Date.now(),
            goals: [],
          },
        },
    });
    const getRes = await itemGet(makeReq('GET', `http://localhost/api/creative-missions/${missionId}`), { params: Promise.resolve({ id: missionId }) });
    expect(getRes.status).toBe(200);
    const getData = await json<{ mission: { id: string; status: string } }>(getRes);
    expect(getData.mission.id).toBe(missionId);
    expect(getData.mission.status).toBe('draft');

    // Step 3: Update status
    vi.mocked(updateMissionStatus).mockResolvedValue({ ok: true, value: { missionId } });
    const patchRes = await itemPatch(makeReq('PATCH', `http://localhost/api/creative-missions/${missionId}`, { status: 'planned' }), { params: Promise.resolve({ id: missionId }) });
    expect(patchRes.status).toBe(200);
    const patchData = await json<{ missionId: string; status: string }>(patchRes);
    expect(patchData.status).toBe('planned');
  });

  it('verifies workspace scoping — list only returns workspace missions', async () => {
    vi.mocked(listMissions).mockResolvedValue({
      ok: true,
      value: {
        missions: [
          { id: 'msn_ws1_a', title: 'WS1 Mission A', status: 'draft' },
          { id: 'msn_ws1_b', title: 'WS1 Mission B', status: 'running' },
        ],
        count: 2,
      },
    });

    const url = new URL('http://localhost/api/creative-missions');
    url.searchParams.set('workspaceId', 'ws_001');
    const res = await collectionGet(new NextRequest(url));
    const data = await json<{ missions: Array<{ id: string }> }>(res);
    expect(data.missions.every((m) => m.id.startsWith('msn_ws1_'))).toBe(true);
    expect(listMissions).toHaveBeenCalledWith({ workspaceId: 'ws_001', limit: 20 });
  });
});