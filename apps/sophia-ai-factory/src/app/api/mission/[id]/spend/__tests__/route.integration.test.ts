/**
 * Integration tests for POST /api/mission/[id]/spend
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '../route';

const m = vi.hoisted(() => {
  const cur = vi.fn();
  const prep = vi.fn().mockReturnValue({ bind: vi.fn().mockReturnThis(), first: vi.fn().mockResolvedValue(null) });
  const d1 = { prepare: prep };
  return { cur, prep, d1, recordSpend: vi.fn() };
});

vi.mock('@/seed/auth/better-auth-session', () => ({ getCurrentUser: m.cur }));
vi.mock('@/seed/db/client', () => ({ createServerClient: vi.fn().mockReturnValue(m.d1) }));
vi.mock('@/tree/mission', () => ({ recordSpend: m.recordSpend }));

const auth = () => m.cur.mockResolvedValueOnce({ id: 'user1' } as never);
const noAuth = () => m.cur.mockResolvedValueOnce(null);
const grant = () => m.prep().first.mockResolvedValueOnce({});
const POST_J = (url: string, body: Record<string, unknown>) =>
  new Request(url, { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } });
const params = (id: string) => ({ params: Promise.resolve({ id }) });

beforeEach(() => vi.clearAllMocks());

describe('POST /api/mission/[id]/spend', () => {
  const validBody = { workspaceId: 'ws_1', amount: 500, category: 'ads', description: 'Campaign spend' };

  it('401 unauthenticated', async () => {
    noAuth();
    const r = await POST(POST_J('http://localhost/api/mission/m1/spend', validBody), params('m1'));
    expect(r.status).toBe(401);
  });

  it('400 missing required fields', async () => {
    auth();
    const r = await POST(POST_J('http://localhost/api/mission/m1/spend', { workspaceId: 'ws_1' }), params('m1'));
    expect(r.status).toBe(400);
  });

  it('400 invalid amount', async () => {
    auth();
    const r = await POST(POST_J('http://localhost/api/mission/m1/spend', { workspaceId: 'ws_1', amount: -10 }), params('m1'));
    expect(r.status).toBe(400);
  });

  it('403 workspace access denied', async () => {
    auth();
    const r = await POST(POST_J('http://localhost/api/mission/m1/spend', validBody), params('m1'));
    expect(r.status).toBe(403);
  });

  it('200 records spend successfully', async () => {
    auth(); grant();
    m.recordSpend.mockResolvedValueOnce(undefined);
    const r = await POST(POST_J('http://localhost/api/mission/m1/spend', validBody), params('m1'));
    expect(r.status).toBe(200);
    const data = (await r.json()) as Record<string, unknown>;
    expect(data.ok).toBe(true);
    expect(data.missionId).toBe('m1');
    expect(data.amountCents).toBe(500);
    expect(data.category).toBe('ads');
  });

  it('403 when mission does not belong to workspace (IDOR guard)', async () => {
    auth(); grant();
    m.recordSpend.mockRejectedValueOnce(new Error('Mission m1 does not belong to workspace ws_1'));
    const r = await POST(POST_J('http://localhost/api/mission/m1/spend', validBody), params('m1'));
    expect(r.status).toBe(403);
  });

  it('500 when recordSpend throws', async () => {
    auth(); grant();
    m.recordSpend.mockRejectedValueOnce(new Error('DB failure'));
    const r = await POST(POST_J('http://localhost/api/mission/m1/spend', validBody), params('m1'));
    expect(r.status).toBe(500);
  });
});
