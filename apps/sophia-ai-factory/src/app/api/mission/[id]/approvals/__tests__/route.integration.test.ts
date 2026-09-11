/**
 * Integration tests for GET/POST /api/mission/[id]/approvals
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, POST } from '../route';

const m = vi.hoisted(() => {
  const cur = vi.fn();
  const prep = vi.fn().mockReturnValue({ bind: vi.fn().mockReturnThis(), first: vi.fn().mockResolvedValue(null) });
  const d1 = { prepare: prep };
  return { cur, prep, d1, listPendingApprovals: vi.fn(), resolveApproval: vi.fn() };
});

vi.mock('@/seed/auth/better-auth-session', () => ({ getCurrentUser: m.cur }));
vi.mock('@/seed/db/client', () => ({ createServerClient: vi.fn().mockReturnValue(m.d1) }));
vi.mock('@/tree/mission', () => ({
  listPendingApprovals: m.listPendingApprovals,
  resolveApproval: m.resolveApproval,
}));

const auth = () => m.cur.mockResolvedValueOnce({ id: 'user1' } as never);
const noAuth = () => m.cur.mockResolvedValueOnce(null);
const grant = () => m.prep().first.mockResolvedValueOnce({});
const POST_J = (url: string, body: Record<string, unknown>) =>
  new Request(url, { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } });
const approval = (o: Record<string, unknown> = {}) => ({
  id: 'ap1', agentRunId: 'ar1', workspaceId: 'ws_1', missionId: 'm1',
  status: 'pending', requestedAt: 1000, ...o,
});

beforeEach(() => vi.clearAllMocks());

describe('GET /api/mission/[id]/approvals', () => {
  it('401 unauthenticated', async () => {
    noAuth();
    const r = await GET(new Request('http://localhost/api/mission/m1/approvals?workspaceId=ws_1'));
    expect(r.status).toBe(401);
  });

  it('400 missing workspaceId', async () => {
    auth();
    const r = await GET(new Request('http://localhost/api/mission/m1/approvals'));
    expect(r.status).toBe(400);
  });

  it('403 workspace access denied', async () => {
    auth();
    const r = await GET(new Request('http://localhost/api/mission/m1/approvals?workspaceId=ws_1'));
    expect(r.status).toBe(403);
  });

  it('200 lists pending approvals', async () => {
    auth(); grant();
    m.listPendingApprovals.mockResolvedValueOnce({ ok: true, value: [approval()] });
    const r = await GET(new Request('http://localhost/api/mission/m1/approvals?workspaceId=ws_1'));
    expect(r.status).toBe(200);
    const data = (await r.json()) as unknown[];
    expect(data).toHaveLength(1);
  });

  it('500 when listPendingApprovals fails', async () => {
    auth(); grant();
    m.listPendingApprovals.mockResolvedValueOnce({ ok: false, error: { message: 'DB error' } });
    const r = await GET(new Request('http://localhost/api/mission/m1/approvals?workspaceId=ws_1'));
    expect(r.status).toBe(500);
  });
});

describe('POST /api/mission/[id]/approvals', () => {
  const validBody = { workspaceId: 'ws_1', approvalId: 'ap1', approved: true, reason: 'Looks good' };

  it('401 unauthenticated', async () => {
    noAuth();
    const r = await POST(POST_J('http://localhost/api/mission/m1/approvals', validBody));
    expect(r.status).toBe(401);
  });

  it('400 missing required fields', async () => {
    auth();
    const r = await POST(POST_J('http://localhost/api/mission/m1/approvals', { workspaceId: 'ws_1' }));
    expect(r.status).toBe(400);
  });

  it('403 workspace access denied', async () => {
    auth();
    const r = await POST(POST_J('http://localhost/api/mission/m1/approvals', validBody));
    expect(r.status).toBe(403);
  });

  it('200 resolves approval as approved', async () => {
    auth(); grant();
    m.resolveApproval.mockResolvedValueOnce({ ok: true, value: { ...approval(), status: 'approved' } });
    const r = await POST(POST_J('http://localhost/api/mission/m1/approvals', validBody));
    expect(r.status).toBe(200);
    const data = (await r.json()) as Record<string, unknown>;
    expect(data.status).toBe('approved');
    expect(m.resolveApproval).toHaveBeenCalledWith('ap1', 'approved', 'user1', 'Looks good', 'ws_1');
  });

  it('200 resolves approval as rejected', async () => {
    auth(); grant();
    m.resolveApproval.mockResolvedValueOnce({ ok: true, value: { ...approval(), status: 'rejected' } });
    const r = await POST(POST_J('http://localhost/api/mission/m1/approvals', { ...validBody, approved: false }));
    expect(r.status).toBe(200);
    expect(m.resolveApproval).toHaveBeenCalledWith('ap1', 'rejected', 'user1', 'Looks good', 'ws_1');
  });

  it('403 approval belongs to another workspace (IDOR guard)', async () => {
    auth(); grant();
    m.resolveApproval.mockResolvedValueOnce({ ok: false, error: { code: 'FORBIDDEN', message: 'Approval does not belong to workspace ws_1' } });
    const r = await POST(POST_J('http://localhost/api/mission/m1/approvals', validBody));
    expect(r.status).toBe(403);
  });

  it('404 approval not found', async () => {
    auth(); grant();
    m.resolveApproval.mockResolvedValueOnce({ ok: false, error: { code: 'NOT_FOUND', message: 'Approval not found' } });
    const r = await POST(POST_J('http://localhost/api/mission/m1/approvals', validBody));
    expect(r.status).toBe(404);
  });

  it('409 already resolved', async () => {
    auth(); grant();
    m.resolveApproval.mockResolvedValueOnce({ ok: false, error: { code: 'ALREADY_RESOLVED', message: 'Already resolved' } });
    const r = await POST(POST_J('http://localhost/api/mission/m1/approvals', validBody));
    expect(r.status).toBe(409);
  });
});
