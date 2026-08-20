/**
 * Integration tests for /api/approvals/[id]
 *
 * PATCH  — Approve or reject an approval (admin/owner only)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

// vi.mock() is hoisted by Vitest — use vi.hoisted() to share mock refs
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

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: vi.fn().mockResolvedValue({
    id: 'user_test_001',
    email: 'test@example.com',
    orgId: 'org_test_001',
    role: 'owner',
  }),
}));

vi.mock('@/seed/db/client', () => ({
  createServerClient: vi.fn().mockReturnValue({ prepare: mockDbPrepare }),
}));

vi.mock('@/tree/mission/agent-run-repo', () => ({
  getApproval: vi.fn(),
  resolveApproval: vi.fn(),
  getAgentRun: vi.fn(),
}));

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getApproval, resolveApproval, getAgentRun } from '@/tree/mission/agent-run-repo';
import { PATCH } from '../[id]/route';

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

function setMembership(row: { role: string } | null) {
  mockDbFirst.mockResolvedValue(row);
}

describe('Phase 3: Approvals API integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCurrentUser).mockReset().mockResolvedValue({
      id: 'user_test_001',
      email: 'test@example.com',
      full_name: 'Test User',
      role: 'owner',
    });
    vi.mocked(getApproval).mockReset();
    vi.mocked(getAgentRun).mockReset();
    vi.mocked(resolveApproval).mockReset();
    setMembership(null); // default: no membership
  });

  describe('PATCH /api/approvals/[id] — resolve', () => {
    it('approves when user is owner in workspace', async () => {
      vi.mocked(getApproval).mockResolvedValue({
        ok: true,
        value: { id: 'appr_001', agent_run_id: 'run_001' },
      });
      vi.mocked(getAgentRun).mockResolvedValue({
        ok: true,
        value: { id: 'run_001', agentId: 'agent_design', workspaceId: 'ws_test_001', createdAt: Date.now(), status: 'queued', phase: 'planning', autonomyLevel: 1, totalCostCents: 0, totalTokens: 0, retryCount: 0 },
      });
      setMembership({ role: 'owner' });
      vi.mocked(resolveApproval).mockResolvedValue({
        ok: true,
        value: { approvalId: 'appr_001', status: 'approved' },
      });

      const res = await PATCH(
        makeReq('PATCH', 'http://localhost/api/approvals/appr_001', { approved: true }),
        { params: Promise.resolve({ id: 'appr_001' }) },
      );
      expect(res.status).toBe(200);
      const data = await json<{ status: string; approvalId: string }>(res);
      expect(data.status).toBe('approved');
      expect(data.approvalId).toBe('appr_001');
      expect(resolveApproval).toHaveBeenCalledWith('appr_001', 'approved', 'user_test_001', undefined);
    });

    it('rejects when user is admin in workspace', async () => {
      vi.mocked(getApproval).mockResolvedValue({
        ok: true,
        value: { id: 'appr_002', agent_run_id: 'run_002' },
      });
      vi.mocked(getAgentRun).mockResolvedValue({
        ok: true,
        value: { id: 'run_002', agentId: 'agent_content', workspaceId: 'ws_test_001', createdAt: Date.now(), status: 'queued', phase: 'planning', autonomyLevel: 1, totalCostCents: 0, totalTokens: 0, retryCount: 0 },
      });
      setMembership({ role: 'admin' });
      vi.mocked(resolveApproval).mockResolvedValue({
        ok: true,
        value: { approvalId: 'appr_002', status: 'rejected' },
      });

      const res = await PATCH(
        makeReq('PATCH', 'http://localhost/api/approvals/appr_002', { approved: false, reason: 'Needs rework' }),
        { params: Promise.resolve({ id: 'appr_002' }) },
      );
      expect(res.status).toBe(200);
      const data = await json<{ status: string; approvalId: string }>(res);
      expect(data.status).toBe('rejected');
      expect(resolveApproval).toHaveBeenCalledWith('appr_002', 'rejected', 'user_test_001', 'Needs rework');
    });

    it('returns 404 for nonexistent approval', async () => {
      vi.mocked(getApproval).mockResolvedValue({
        ok: false,
        error: { code: 'NOT_FOUND', message: 'Approval not found' },
      });

      const res = await PATCH(
        makeReq('PATCH', 'http://localhost/api/approvals/appr_nonexistent', { approved: true }),
        { params: Promise.resolve({ id: 'appr_nonexistent' }) },
      );
      expect(res.status).toBe(404);
    });

    it('returns 401 when not authenticated', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(null);
      vi.mocked(getApproval).mockResolvedValue({
        ok: true,
        value: { id: 'appr_001', agent_run_id: 'run_001' },
      });

      const res = await PATCH(
        makeReq('PATCH', 'http://localhost/api/approvals/appr_001', { approved: true }),
        { params: Promise.resolve({ id: 'appr_001' }) },
      );
      expect(res.status).toBe(401);
    });

    it('returns 403 when user is not a workspace member (IDOR)', async () => {
      vi.mocked(getApproval).mockResolvedValue({
        ok: true,
        value: { id: 'appr_001', agent_run_id: 'run_001' },
      });
      vi.mocked(getAgentRun).mockResolvedValue({
        ok: true,
        value: { id: 'run_001', agentId: 'agent_design', workspaceId: 'ws_other', createdAt: Date.now(), status: 'queued', phase: 'planning', autonomyLevel: 1, totalCostCents: 0, totalTokens: 0, retryCount: 0 },
      });
      setMembership(null); // not a member

      const res = await PATCH(
        makeReq('PATCH', 'http://localhost/api/approvals/appr_001', { approved: true }),
        { params: Promise.resolve({ id: 'appr_001' }) },
      );
      expect(res.status).toBe(403);
      expect(resolveApproval).not.toHaveBeenCalled();
    });

    it('returns 403 when user is viewer (not admin/owner)', async () => {
      vi.mocked(getApproval).mockResolvedValue({
        ok: true,
        value: { id: 'appr_001', agent_run_id: 'run_001' },
      });
      vi.mocked(getAgentRun).mockResolvedValue({
        ok: true,
        value: { id: 'run_001', agentId: 'agent_design', workspaceId: 'ws_test_001', createdAt: Date.now(), status: 'queued', phase: 'planning', autonomyLevel: 1, totalCostCents: 0, totalTokens: 0, retryCount: 0 },
      });
      setMembership({ role: 'viewer' });

      const res = await PATCH(
        makeReq('PATCH', 'http://localhost/api/approvals/appr_001', { approved: true }),
        { params: Promise.resolve({ id: 'appr_001' }) },
      );
      expect(res.status).toBe(403);
      expect(resolveApproval).not.toHaveBeenCalled();
    });

    it('returns 404 when linked agent run not found', async () => {
      vi.mocked(getApproval).mockResolvedValue({
        ok: true,
        value: { id: 'appr_001', agent_run_id: 'run_ghost' },
      });
      vi.mocked(getAgentRun).mockResolvedValue({
        ok: false,
        error: { code: 'NOT_FOUND', message: 'Agent run not found' },
      });
      setMembership({ role: 'owner' });

      const res = await PATCH(
        makeReq('PATCH', 'http://localhost/api/approvals/appr_001', { approved: true }),
        { params: Promise.resolve({ id: 'appr_001' }) },
      );
      expect(res.status).toBe(404);
    });

    it('returns 400 for invalid request body', async () => {
      const res = await PATCH(
        makeReq('PATCH', 'http://localhost/api/approvals/appr_001', { approved: 'not-a-boolean' }),
        { params: Promise.resolve({ id: 'appr_001' }) },
      );
      expect(res.status).toBe(400);
    });
  });
});