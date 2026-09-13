/**
 * Cross-Tenant Route Isolation & Data Boundary Integration Test Suite
 *
 * Verifies that consolidated routes (Mission, ROI, IP Graph, Distribution)
 * strictly enforce multi-tenant isolation through the canonical seed primitive:
 * 1. Cross-tenant access rejection (User of Tenant A accessing Tenant B -> 403 Forbidden)
 * 2. Role hierarchy rejection (MEMBER attempting OPERATOR/ADMIN operations -> 403 Forbidden)
 * 3. Data boundary enforcement (No data leaks across workspace boundaries)
 *
 * Layer: seed/auth/__tests__
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  verifyWorkspaceAccess,
  verifyWorkspaceRole,
  requireWorkspaceAccess,
  requireWorkspaceRole,
  withTenantScope,
  WorkspaceAccessDeniedError,
  InsufficientWorkspaceRoleError,
  type WorkspaceRole,
} from '../workspace-access';

// Hoist mocks to avoid TDZ issues with vi.mock
const { MockD1Client, mockD1, getMockUser, setMockUser } = vi.hoisted(() => {
  const dbRows: Record<string, { role: string }> = {
    'tenant_a:user_alice': { role: 'OWNER' },
    'tenant_a:user_bob': { role: 'MEMBER' },
    'tenant_b:user_carol': { role: 'ADMIN' },
    'tenant_b:user_dave': { role: 'MEMBER' },
  };

  let currentUser: { id: string; email?: string } | null = null;

  const mockPrepare = vi.fn().mockImplementation((sql: string) => {
    return {
      bind: vi.fn().mockImplementation((...args: unknown[]) => {
        return {
          first: vi.fn().mockImplementation(async () => {
            if (sql.includes('org_members')) {
              const orgId = String(args[0]);
              const userId = String(args[1]);
              const key = `${orgId}:${userId}`;
              return dbRows[key] ?? null;
            }
            if (sql.includes('organizations')) {
              const orgId = String(args[0]);
              if (orgId === 'tenant_a' || orgId === 'tenant_b') {
                return { id: orgId, name: orgId };
              }
              return null;
            }
            return null;
          }),
        };
      }),
    };
  });

  class MockD1Client {
    prepare(sql: string) {
      return mockPrepare(sql);
    }
    from() {
      return this;
    }
  }

  const mockD1 = new MockD1Client();

  return {
    MockD1Client,
    mockD1,
    getMockUser: () => currentUser,
    setMockUser: (u: { id: string; email?: string } | null) => {
      currentUser = u;
    },
  };
});

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: vi.fn().mockImplementation(async () => getMockUser()),
}));

vi.mock('@/seed/db/client', () => ({
  D1Client: MockD1Client,
  createServerClient: vi.fn().mockReturnValue(mockD1),
}));

// Mock tree modules so routes don't fail when access is granted
vi.mock('@/tree/mission', () => ({
  createMission: vi.fn().mockResolvedValue({ id: 'm_1', title: 'Mission 1' }),
  listMissions: vi.fn().mockResolvedValue([]),
  newMissionId: vi.fn().mockReturnValue('m_1'),
  getMissionWithGoals: vi.fn().mockImplementation(async (id: string) => ({
    id,
    workspaceId: 'tenant_a',
    title: 'Mission A',
    goals: [],
  })),
  recordSpend: vi.fn().mockResolvedValue(undefined),
  listPendingApprovals: vi.fn().mockResolvedValue({ ok: true, value: [] }),
  resolveApproval: vi.fn().mockResolvedValue({ ok: true, value: { id: 'ap_1', status: 'approved' } }),
}));

vi.mock('@/tree/roi', () => ({
  getWorkspaceROI: vi.fn().mockResolvedValue({ workspaceId: 'tenant_a', totalRevenueCents: 100 }),
  getTopROIChannels: vi.fn().mockResolvedValue([]),
  recordROI: vi.fn().mockResolvedValue({ entityId: 'e_1', roi: 1.5 }),
}));

vi.mock('@/tree/ip-graph', () => ({
  createIP: vi.fn().mockResolvedValue({ id: 'ip_1', name: 'IP 1' }),
  listIP: vi.fn().mockResolvedValue([]),
  newIpId: vi.fn().mockReturnValue('ip_1'),
  getIP: vi.fn().mockImplementation(async (id: string) => ({
    id,
    workspaceId: 'tenant_a',
    name: 'Entity A',
  })),
  getIPChildren: vi.fn().mockResolvedValue([]),
  updateIPStatus: vi.fn().mockResolvedValue({ id: 'ip_1', status: 'approved' }),
}));

vi.mock('@/tree/distribution', () => ({
  createDistributionPlan: vi.fn().mockResolvedValue({ id: 'dp_1', status: 'draft' }),
  listDistributionPlans: vi.fn().mockResolvedValue([]),
}));

// Route handlers under test
import { POST as postMission, GET as getMission } from '@/app/api/mission/route';
import { GET as getMissionById, PATCH as patchMission, DELETE as deleteMission } from '@/app/api/mission/[id]/route';
import { POST as postMissionSpend } from '@/app/api/mission/[id]/spend/route';
import { GET as getApprovals, POST as postApproval } from '@/app/api/mission/[id]/approvals/route';
import { GET as getROI, POST as postROI } from '@/app/api/roi/route';
import { POST as postIP, GET as getIPList } from '@/app/api/ip-graph/route';
import { GET as getIPById, PATCH as patchIP } from '@/app/api/ip-graph/[id]/route';
import { GET as getIPChildren } from '@/app/api/ip-graph/[id]/children/route';
import { POST as postDistribution, GET as getDistribution } from '@/app/api/distribution/route';

describe('Cross-Tenant Route Isolation & Data Boundary Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setMockUser(null);
  });

  // ---------------------------------------------------------------------------
  // 1. Cross-Tenant Route Access Rejection
  // ---------------------------------------------------------------------------
  describe('1. Cross-Tenant Route Access Rejection (Tenant A user accessing Tenant B resources)', () => {
    beforeEach(() => {
      // Alice belongs to Tenant A (OWNER)
      setMockUser({ id: 'user_alice', email: 'alice@tenant-a.com' });
    });

    it('POST /api/mission rejects Alice attempting to create mission in Tenant B with 403', async () => {
      const req = new Request('http://localhost/api/mission', {
        method: 'POST',
        body: JSON.stringify({
          workspaceId: 'tenant_b',
          title: 'Unauthorized Mission',
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      const res = await postMission(req);
      expect(res.status).toBe(403);
      const json = await res.json() as { error: string };
      expect(json.error).toBe('Forbidden');
    });

    it('GET /api/mission rejects Alice querying missions of Tenant B with 403', async () => {
      const req = new Request('http://localhost/api/mission?workspaceId=tenant_b');
      const res = await getMission(req);
      expect(res.status).toBe(403);
      const json = await res.json() as { error: string };
      expect(json.error).toBe('Forbidden');
    });

    it('GET /api/mission/[id] rejects Alice accessing a mission query with workspaceId=tenant_b with 403', async () => {
      const req = new Request('http://localhost/api/mission/m_1?workspaceId=tenant_b');
      const res = await getMissionById(req, { params: Promise.resolve({ id: 'm_1' }) });
      expect(res.status).toBe(403);
      const json = await res.json() as { error: string };
      expect(json.error).toBe('Forbidden');
    });

    it('POST /api/mission/[id]/spend rejects Alice recording spend in Tenant B with 403', async () => {
      const req = new Request('http://localhost/api/mission/m_1/spend', {
        method: 'POST',
        body: JSON.stringify({
          workspaceId: 'tenant_b',
          amount: 5000,
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      const res = await postMissionSpend(req, { params: Promise.resolve({ id: 'm_1' }) });
      expect(res.status).toBe(403);
      const json = await res.json() as { error: string };
      expect(json.error).toBe('Forbidden');
    });

    it('GET /api/roi rejects Alice requesting ROI metrics for Tenant B with 403', async () => {
      const req = new Request('http://localhost/api/roi?workspaceId=tenant_b');
      const res = await getROI(req as never);
      expect(res.status).toBe(403);
      const json = await res.json() as { error: string };
      expect(json.error).toBe('Forbidden');
    });

    it('POST /api/ip-graph rejects Alice creating an IP entity in Tenant B with 403', async () => {
      const req = new Request('http://localhost/api/ip-graph', {
        method: 'POST',
        body: JSON.stringify({
          workspaceId: 'tenant_b',
          type: 'character',
          name: 'Alice Cross-Tenant Infiltration',
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      const res = await postIP(req);
      expect(res.status).toBe(403);
      const json = await res.json() as { error: string };
      expect(json.error).toBe('Forbidden');
    });

    it('GET /api/ip-graph rejects Alice listing IP entities in Tenant B with 403', async () => {
      const req = new Request('http://localhost/api/ip-graph?workspaceId=tenant_b');
      const res = await getIPList(req);
      expect(res.status).toBe(403);
      const json = await res.json() as { error: string };
      expect(json.error).toBe('Forbidden');
    });

    it('POST /api/distribution rejects Alice creating a distribution plan in Tenant B with 403', async () => {
      const req = new Request('http://localhost/api/distribution', {
        method: 'POST',
        body: JSON.stringify({
          workspaceId: 'tenant_b',
          contentProjectId: 'cp_99',
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      const res = await postDistribution(req);
      expect(res.status).toBe(403);
      const json = await res.json() as { error: string };
      expect(json.error).toBe('Forbidden');
    });

    it('GET /api/distribution rejects Alice listing distribution plans in Tenant B with 403', async () => {
      const req = new Request('http://localhost/api/distribution?workspaceId=tenant_b');
      const res = await getDistribution(req);
      expect(res.status).toBe(403);
      const json = await res.json() as { error: string };
      expect(json.error).toBe('Forbidden');
    });

    it('PATCH /api/mission/[id] rejects Alice updating mission with workspaceId=tenant_b with 403', async () => {
      const req = new Request('http://localhost/api/mission/m_1', {
        method: 'PATCH',
        body: JSON.stringify({
          workspaceId: 'tenant_b',
          status: 'running',
          currentPhase: 'exec',
        }),
        headers: { 'Content-Type': 'application/json' },
      });
      const res = await patchMission(req, { params: Promise.resolve({ id: 'm_1' }) });
      expect(res.status).toBe(403);
      const json = await res.json() as { error: string };
      expect(json.error).toBe('Forbidden');
    });

    it('DELETE /api/mission/[id] rejects Alice deleting mission with workspaceId=tenant_b with 403', async () => {
      const req = new Request('http://localhost/api/mission/m_1?workspaceId=tenant_b', {
        method: 'DELETE',
      });
      const res = await deleteMission(req, { params: Promise.resolve({ id: 'm_1' }) });
      expect(res.status).toBe(403);
      const json = await res.json() as { error: string };
      expect(json.error).toBe('Forbidden');
    });

    it('GET /api/mission/[id]/approvals rejects Alice listing approvals for Tenant B with 403', async () => {
      const req = new Request('http://localhost/api/mission/m_1/approvals?workspaceId=tenant_b');
      const res = await getApprovals(req);
      expect(res.status).toBe(403);
      const json = await res.json() as { error: string };
      expect(json.error).toBe('Forbidden');
    });

    it('POST /api/mission/[id]/approvals rejects Alice resolving approval in Tenant B with 403', async () => {
      const req = new Request('http://localhost/api/mission/m_1/approvals', {
        method: 'POST',
        body: JSON.stringify({
          workspaceId: 'tenant_b',
          approvalId: 'ap_1',
          approved: true,
        }),
        headers: { 'Content-Type': 'application/json' },
      });
      const res = await postApproval(req);
      expect(res.status).toBe(403);
      const json = await res.json() as { error: string };
      expect(json.error).toBe('Forbidden');
    });

    it('POST /api/roi rejects Alice recording ROI in Tenant B with 403', async () => {
      const req = new Request('http://localhost/api/roi', {
        method: 'POST',
        body: JSON.stringify({
          workspaceId: 'tenant_b',
          entityType: 'mission',
          entityId: 'm_1',
          revenueCents: 1000,
        }),
        headers: { 'Content-Type': 'application/json' },
      });
      const res = await postROI(req as never);
      expect(res.status).toBe(403);
      const json = await res.json() as { error: string };
      expect(json.error).toBe('Forbidden');
    });

    it('GET /api/ip-graph/[id] rejects Alice accessing IP entity belonging to Tenant B with 403', async () => {
      const { getIP } = await import('@/tree/ip-graph');
      vi.mocked(getIP).mockResolvedValueOnce({
        id: 'ip_b',
        workspaceId: 'tenant_b',
        type: 'character',
        name: 'Entity B',
        description: '',
        metadata: {},
        status: 'draft',
        createdAt: 1,
        updatedAt: 1,
      });

      const req = new Request('http://localhost/api/ip-graph/ip_b');
      const res = await getIPById(req, { params: Promise.resolve({ id: 'ip_b' }) });
      expect(res.status).toBe(403);
      const json = await res.json() as { error: string };
      expect(json.error).toBe('Forbidden');
    });

    it('PATCH /api/ip-graph/[id] rejects Alice updating IP entity belonging to Tenant B with 403', async () => {
      const { getIP } = await import('@/tree/ip-graph');
      vi.mocked(getIP).mockResolvedValueOnce({
        id: 'ip_b',
        workspaceId: 'tenant_b',
        type: 'character',
        name: 'Entity B',
        description: '',
        metadata: {},
        status: 'draft',
        createdAt: 1,
        updatedAt: 1,
      });

      const req = new Request('http://localhost/api/ip-graph/ip_b', {
        method: 'PATCH',
        body: JSON.stringify({ status: 'approved' }),
        headers: { 'Content-Type': 'application/json' },
      });
      const res = await patchIP(req, { params: Promise.resolve({ id: 'ip_b' }) });
      expect(res.status).toBe(403);
      const json = await res.json() as { error: string };
      expect(json.error).toBe('Forbidden');
    });

    it('GET /api/ip-graph/[id]/children rejects Alice accessing children of IP entity belonging to Tenant B with 403', async () => {
      const { getIP } = await import('@/tree/ip-graph');
      vi.mocked(getIP).mockResolvedValueOnce({
        id: 'ip_b',
        workspaceId: 'tenant_b',
        type: 'universe',
        name: 'Universe B',
        description: '',
        metadata: {},
        status: 'draft',
        createdAt: 1,
        updatedAt: 1,
      });

      const req = new Request('http://localhost/api/ip-graph/ip_b/children');
      const res = await getIPChildren(req, { params: Promise.resolve({ id: 'ip_b' }) });
      expect(res.status).toBe(403);
      const json = await res.json() as { error: string };
      expect(json.error).toBe('Forbidden');
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Role Hierarchy Rejection (MEMBER cannot execute ADMIN/OPERATOR mutations)
  // ---------------------------------------------------------------------------
  describe('2. Role Hierarchy Rejection (MEMBER vs ADMIN vs OPERATOR vs OWNER)', () => {
    it('verifies Bob (MEMBER in Tenant A) fails verification when requiring OPERATOR, ADMIN, or OWNER', async () => {
      // Bob is MEMBER in Tenant A
      const isMember = await verifyWorkspaceRole('tenant_a', 'user_bob', 'MEMBER', mockD1 as never);
      expect(isMember).toBe(true);

      const isViewer = await verifyWorkspaceRole('tenant_a', 'user_bob', 'VIEWER', mockD1 as never);
      expect(isViewer).toBe(true);

      // Higher roles must be rejected
      const isOperator = await verifyWorkspaceRole('tenant_a', 'user_bob', 'OPERATOR', mockD1 as never);
      expect(isOperator).toBe(false);

      const isAdmin = await verifyWorkspaceRole('tenant_a', 'user_bob', 'ADMIN', mockD1 as never);
      expect(isAdmin).toBe(false);

      const isOwner = await verifyWorkspaceRole('tenant_a', 'user_bob', 'OWNER', mockD1 as never);
      expect(isOwner).toBe(false);
    });

    it('requireWorkspaceRole throws InsufficientWorkspaceRoleError when MEMBER attempts OPERATOR action', async () => {
      await expect(
        requireWorkspaceRole('tenant_a', 'user_bob', 'OPERATOR', mockD1 as never)
      ).rejects.toThrow(InsufficientWorkspaceRoleError);

      try {
        await requireWorkspaceRole('tenant_a', 'user_bob', 'ADMIN', mockD1 as never);
        expect.fail('Expected InsufficientWorkspaceRoleError');
      } catch (err) {
        expect(err).toBeInstanceOf(InsufficientWorkspaceRoleError);
        const secErr = err as InsufficientWorkspaceRoleError;
        expect(secErr.status).toBe(403);
        expect(secErr.code).toBe('INSUFFICIENT_WORKSPACE_ROLE');
        expect(secErr.requiredRole).toBe('ADMIN');
        expect(secErr.actualRole).toBe('MEMBER');
      }
    });

    it('verifies Carol (ADMIN in Tenant B) satisfies OPERATOR and MEMBER but not OWNER', async () => {
      expect(await verifyWorkspaceRole('tenant_b', 'user_carol', 'VIEWER', mockD1 as never)).toBe(true);
      expect(await verifyWorkspaceRole('tenant_b', 'user_carol', 'MEMBER', mockD1 as never)).toBe(true);
      expect(await verifyWorkspaceRole('tenant_b', 'user_carol', 'OPERATOR', mockD1 as never)).toBe(true);
      expect(await verifyWorkspaceRole('tenant_b', 'user_carol', 'ADMIN', mockD1 as never)).toBe(true);
      expect(await verifyWorkspaceRole('tenant_b', 'user_carol', 'OWNER', mockD1 as never)).toBe(false);
    });

    it('withTenantScope rejects MEMBER when requiredRole is OPERATOR or ADMIN', async () => {
      await expect(
        withTenantScope(
          {
            workspaceId: 'tenant_a',
            userId: 'user_bob',
            requiredRole: 'OPERATOR',
            db: mockD1 as never,
          },
          async () => 'forbidden'
        )
      ).rejects.toThrow(InsufficientWorkspaceRoleError);

      await expect(
        withTenantScope(
          {
            workspaceId: 'tenant_a',
            userId: 'user_bob',
            requiredRole: 'ADMIN',
            db: mockD1 as never,
          },
          async () => 'forbidden'
        )
      ).rejects.toThrow(InsufficientWorkspaceRoleError);
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Data Boundary Enforcement (No cross-tenant data leaks)
  // ---------------------------------------------------------------------------
  describe('3. Data Boundary Enforcement & Isolation Guarantees', () => {
    it('guarantees verifyWorkspaceAccess returns false across all cross-tenant permutations', async () => {
      // Alice (Tenant A) -> Tenant B: false
      expect(await verifyWorkspaceAccess('tenant_b', 'user_alice', mockD1 as never)).toBe(false);
      // Bob (Tenant A) -> Tenant B: false
      expect(await verifyWorkspaceAccess('tenant_b', 'user_bob', mockD1 as never)).toBe(false);
      // Carol (Tenant B) -> Tenant A: false
      expect(await verifyWorkspaceAccess('tenant_a', 'user_carol', mockD1 as never)).toBe(false);
      // Dave (Tenant B) -> Tenant A: false
      expect(await verifyWorkspaceAccess('tenant_a', 'user_dave', mockD1 as never)).toBe(false);

      // Legitimate tenant access: true
      expect(await verifyWorkspaceAccess('tenant_a', 'user_alice', mockD1 as never)).toBe(true);
      expect(await verifyWorkspaceAccess('tenant_a', 'user_bob', mockD1 as never)).toBe(true);
      expect(await verifyWorkspaceAccess('tenant_b', 'user_carol', mockD1 as never)).toBe(true);
      expect(await verifyWorkspaceAccess('tenant_b', 'user_dave', mockD1 as never)).toBe(true);
    });

    it('requireWorkspaceAccess throws WorkspaceAccessDeniedError with code WORKSPACE_ACCESS_DENIED for cross-tenant calls', async () => {
      await expect(
        requireWorkspaceAccess('tenant_b', 'user_alice', mockD1 as never)
      ).rejects.toThrow(WorkspaceAccessDeniedError);

      await expect(
        requireWorkspaceAccess('tenant_a', 'user_carol', mockD1 as never)
      ).rejects.toThrow(WorkspaceAccessDeniedError);
    });

    it('withTenantScope strictly encapsulates workspaceId context preventing accidental scope bleed', async () => {
      const res = await withTenantScope(
        {
          workspaceId: 'tenant_a',
          userId: 'user_alice',
          db: mockD1 as never,
        },
        async (scope) => {
          expect(scope.workspaceId).toBe('tenant_a');
          expect(scope.userId).toBe('user_alice');
          expect(scope.role).toBe('OWNER');

          // Inside tenant_a scope, user cannot cross-execute into tenant_b
          await expect(
            withTenantScope(
              {
                workspaceId: 'tenant_b',
                userId: scope.userId,
                db: mockD1 as never,
              },
              async () => 'cross-leak'
            )
          ).rejects.toThrow(WorkspaceAccessDeniedError);

          return 'tenant_a_isolated_cleanly';
        }
      );

      expect(res).toBe('tenant_a_isolated_cleanly');
    });
  });
});
