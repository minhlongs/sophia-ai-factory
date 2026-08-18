/**
 * Integration tests for /api/agent-runs/[id]
 *
 * GET    — Get agent run (IDOR-protected)
 * PATCH  — Cancel run (IDOR-protected)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

// vi.mock() is hoisted by Vitest — use vi.hoisted() to share mock refs across factory + tests
const {
  mockDbPrepare,
  mockDbBind,
  mockDbFirst,
} = vi.hoisted(() => {
  const mockDbFirst = vi.fn().mockResolvedValue(null);
  const mockDbBind = vi.fn().mockReturnThis();
  const mockDbPrepare = vi.fn().mockReturnValue({ bind: mockDbBind, first: mockDbFirst });
  return { mockDbPrepare, mockDbBind, mockDbFirst };
});

// Auth mock
vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: vi.fn().mockResolvedValue({
    id: 'user_test_001',
    email: 'test@example.com',
    full_name: 'Test User',
    role: 'owner',
  }),
}));

// DB mock
vi.mock('@/seed/db/client', () => ({
  createServerClient: vi.fn().mockReturnValue({ prepare: mockDbPrepare }),
}));

// Repo mocks
vi.mock('@/tree/mission/agent-run-repo', () => ({
  getAgentRun: vi.fn(),
  updateAgentRun: vi.fn(),
}));

import { getAgentRun, updateAgentRun } from '@/tree/mission/agent-run-repo';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { GET, PATCH } from '../[id]/route';

function makeReq(method: string, url: string, body?: unknown): NextRequest {
  return new NextRequest(url, {
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers: new Headers({ 'content-type': 'application/json' }),
  });
}

async function json<T>(res: NextResponse): Promise<T> {
  return res.json() as Promise<T>;
}

// Control workspace membership response per test
function setWorkspaceMembership(present: boolean) {
  mockDbFirst.mockResolvedValue(present ? { 1: 1 } : null);
}

describe('Phase 3: Agent Runs API integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getAgentRun).mockReset();
    vi.mocked(updateAgentRun).mockReset();
    vi.mocked(getCurrentUser).mockReset().mockResolvedValue({
      id: 'user_test_001',
      email: 'test@example.com',
      full_name: 'Test User',
      role: 'owner',
    });
    setWorkspaceMembership(false); // default: no access
  });

  describe('GET /api/agent-runs/[id]', () => {
    it('returns agent run when user has workspace access', async () => {
      vi.mocked(getAgentRun).mockResolvedValue({
        ok: true,
        value: {
          id: 'run_001',
          agentId: 'agent_strategy',
          workspaceId: 'ws_test_001',
          missionId: 'msn_001',
          createdAt: Date.now(),
          status: 'running',
          phase: 'executing',
          autonomyLevel: 2,
          totalCostCents: 50,
          totalTokens: 500,
          retryCount: 0,
        },
      });
      setWorkspaceMembership(true);

      const res = await GET(makeReq('GET', 'http://localhost/api/agent-runs/run_001'), { params: { id: 'run_001' } });
      expect(res.status).toBe(200);
      const data = await json<{ agentRun: { id: string } }>(res);
      expect(data.agentRun.id).toBe('run_001');
    });

    it('returns 404 for nonexistent run', async () => {
      vi.mocked(getAgentRun).mockResolvedValue({
        ok: false,
        error: { code: 'NOT_FOUND', message: 'Agent run not found' },
      });

      const res = await GET(makeReq('GET', 'http://localhost/api/agent-runs/run_nonexistent'), { params: { id: 'run_nonexistent' } });
      expect(res.status).toBe(404);
    });

    it('returns 401 when not authenticated', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(null);

      const res = await GET(makeReq('GET', 'http://localhost/api/agent-runs/run_001'), { params: { id: 'run_001' } });
      expect(res.status).toBe(401);
    });

    it('returns 403 when user lacks workspace access (IDOR)', async () => {
      vi.mocked(getAgentRun).mockResolvedValue({
        ok: true,
        value: {
          id: 'run_001',
          agentId: 'agent_strategy',
          workspaceId: 'ws_other',
          createdAt: Date.now(),
          status: 'running',
          phase: 'executing',
          autonomyLevel: 2,
          totalCostCents: 50,
          totalTokens: 500,
          retryCount: 0,
        },
      });
      // setWorkspaceMembership(false) already set in beforeEach

      const res = await GET(makeReq('GET', 'http://localhost/api/agent-runs/run_001'), { params: { id: 'run_001' } });
      expect(res.status).toBe(403);
    });
  });

  describe('PATCH /api/agent-runs/[id] — cancel', () => {
    it('cancels agent run successfully', async () => {
      vi.mocked(getAgentRun).mockResolvedValue({
        ok: true,
        value: {
          id: 'run_001',
          agentId: 'agent_strategy',
          workspaceId: 'ws_test_001',
          createdAt: Date.now(),
          status: 'running',
          phase: 'executing',
          autonomyLevel: 2,
          totalCostCents: 50,
          totalTokens: 500,
          retryCount: 0,
        },
      });
      setWorkspaceMembership(true);
      vi.mocked(updateAgentRun).mockResolvedValue({
        ok: true,
        value: {
          id: 'run_001',
          agentId: 'agent_strategy',
          workspaceId: 'ws_test_001',
          createdAt: Date.now(),
          status: 'cancelled',
          phase: 'cancelled',
          autonomyLevel: 2,
          totalCostCents: 50,
          totalTokens: 500,
          retryCount: 0,
        },
      });

      const res = await PATCH(
        makeReq('PATCH', 'http://localhost/api/agent-runs/run_001', { reason: 'User cancelled' }),
        { params: { id: 'run_001' } },
      );
      expect(res.status).toBe(200);
      const data = await json<{ status: string }>(res);
      expect(data.status).toBe('cancelled');
      expect(updateAgentRun).toHaveBeenCalledWith('run_001', {
        status: 'cancelled',
        phase: 'cancelled',
        errorMessage: 'User cancelled',
      });
    });

    it('returns 404 for nonexistent run', async () => {
      vi.mocked(getAgentRun).mockResolvedValue({
        ok: false,
        error: { code: 'NOT_FOUND', message: 'Agent run not found' },
      });

      const res = await PATCH(
        makeReq('PATCH', 'http://localhost/api/agent-runs/run_nonexistent', {}),
        { params: { id: 'run_nonexistent' } },
      );
      expect(res.status).toBe(404);
    });

    it('returns 403 for cross-workspace cancel (IDOR)', async () => {
      vi.mocked(getAgentRun).mockResolvedValue({
        ok: true,
        value: {
          id: 'run_001',
          agentId: 'agent_strategy',
          workspaceId: 'ws_other',
          createdAt: Date.now(),
          status: 'running',
          phase: 'executing',
          autonomyLevel: 2,
          totalCostCents: 50,
          totalTokens: 500,
          retryCount: 0,
        },
      });

      const res = await PATCH(
        makeReq('PATCH', 'http://localhost/api/agent-runs/run_001', { reason: 'trying to hack' }),
        { params: { id: 'run_001' } },
      );
      expect(res.status).toBe(403);
      expect(updateAgentRun).not.toHaveBeenCalled();
    });
  });
});