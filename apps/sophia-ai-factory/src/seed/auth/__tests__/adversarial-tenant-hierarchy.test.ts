/**
 * Empirical Challenger Adversarial Test Suite for Better Auth Tenant Isolation & Role Hierarchy
 *
 * Stress-tests:
 * 1. Role tier hierarchy boundary enforcement:
 *    - VIEWER (10) and MEMBER (20) blocked from OPERATOR (30) and ADMIN (40)
 *    - All pairwise role combinations
 *    - Role string normalization edge cases and unknown role escalation risk
 * 2. Fail-closed behavior of withTenantScope & workspace-access primitives:
 *    - HTTP 403 on denied / insufficient role / missing credentials
 *    - HTTP 404 on nonexistent workspace in background scope
 *    - Nested scope boundary encapsulation
 * 3. Cross-tenant isolation & resource access:
 *    - Tenant A user accessing Tenant B
 *    - Empirical test of DELETE /api/creative-memory query param handler
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import {
  WORKSPACE_ROLE_HIERARCHY,
  normalizeWorkspaceRole,
  hasMinimumRole,
  verifyWorkspaceAccess,
  verifyWorkspaceRole,
  requireWorkspaceAccess,
  requireWorkspaceRole,
  withTenantScope,
  WorkspaceAccessError,
  WorkspaceAccessDeniedError,
  WorkspaceNotFoundError,
  InsufficientWorkspaceRoleError,
  type WorkspaceRole,
} from '../workspace-access';

// Hoist mocks
const { MockD1Client, mockD1, getMockUser, setMockUser, mockMemories } = vi.hoisted(() => {
  const dbMembers: Record<string, { role: string }> = {
    'org_a:user_viewer_a': { role: 'VIEWER' },
    'org_a:user_member_a': { role: 'MEMBER' },
    'org_a:user_operator_a': { role: 'OPERATOR' },
    'org_a:user_admin_a': { role: 'ADMIN' },
    'org_a:user_owner_a': { role: 'OWNER' },

    'org_b:user_viewer_b': { role: 'VIEWER' },
    'org_b:user_member_b': { role: 'MEMBER' },
    'org_b:user_operator_b': { role: 'OPERATOR' },
    'org_b:user_admin_b': { role: 'ADMIN' },
    'org_b:user_owner_b': { role: 'OWNER' },
  };

  const dbOrganizations: Record<string, { id: string; name: string }> = {
    org_a: { id: 'org_a', name: 'Org Alpha' },
    org_b: { id: 'org_b', name: 'Org Beta' },
  };

  const mockMemories: Record<string, { id: string; workspace_id: string; is_deleted: number }> = {
    mem_a1: { id: 'mem_a1', workspace_id: 'org_a', is_deleted: 0 },
    mem_b1: { id: 'mem_b1', workspace_id: 'org_b', is_deleted: 0 },
  };

  let currentUser: { id: string; email?: string } | null = null;

  const mockPrepare = vi.fn().mockImplementation((sql: string) => {
    return {
      bind: vi.fn().mockImplementation((...args: unknown[]) => {
        return {
          first: vi.fn().mockImplementation(async () => {
            if (sql.includes('org_members') && sql.includes('org_id = ?') && sql.includes('user_id = ?')) {
              const orgId = String(args[0]);
              const userId = String(args[1]);
              const key = `${orgId}:${userId}`;
              return dbMembers[key] ?? null;
            }
            if (sql.includes('organizations') && sql.includes('WHERE id = ?')) {
              const orgId = String(args[0]);
              return dbOrganizations[orgId] ?? null;
            }
            if (sql.includes('creative_memory') && sql.includes('WHERE id = ?')) {
              const id = String(args[0]);
              return mockMemories[id] ?? null;
            }
            return null;
          }),
          run: vi.fn().mockImplementation(async () => {
            if (sql.includes('UPDATE creative_memory SET is_deleted = 1 WHERE id = ?')) {
              const id = String(args[0]);
              if (mockMemories[id]) {
                mockMemories[id].is_deleted = 1;
              }
              return { success: true };
            }
            return { success: true };
          }),
          all: vi.fn().mockResolvedValue({ results: [] }),
        };
      }),
    };
  });

  class MockD1Client {
    prepare(sql: string) {
      return mockPrepare(sql);
    }
  }

  const mockD1 = new MockD1Client();

  return {
    MockD1Client,
    mockD1,
    mockMemories,
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
  getD1: vi.fn().mockReturnValue(mockD1),
}));

// Route handlers for empirical testing
import { DELETE as deleteMemoryQueryParam } from '@/app/api/creative-memory/route';
import { DELETE as deleteMemoryPathParam } from '@/app/api/creative-memory/[id]/route';

describe('EMPIRICAL ADVERSARIAL CHALLENGE: Tenant Isolation & Role Hierarchy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setMockUser(null);
    mockMemories.mem_a1.is_deleted = 0;
    mockMemories.mem_b1.is_deleted = 0;
  });

  // =========================================================================
  // Challenge Area 1: Role Tier Hierarchy Boundary Enforcement
  // =========================================================================
  describe('1. Role Tier Hierarchy Boundary Enforcement', () => {
    const roles: WorkspaceRole[] = ['VIEWER', 'MEMBER', 'OPERATOR', 'ADMIN', 'OWNER'];
    const numericLevels: Record<WorkspaceRole, number> = {
      VIEWER: 10,
      MEMBER: 20,
      OPERATOR: 30,
      ADMIN: 40,
      OWNER: 50,
    };

    it('rigorously validates the entire 5x5 role hierarchy matrix', () => {
      for (const actualRole of roles) {
        for (const requiredRole of roles) {
          const expectedAccess = numericLevels[actualRole] >= numericLevels[requiredRole];
          const hasAccess = hasMinimumRole(actualRole, requiredRole);
          expect(
            hasAccess,
            `Role ${actualRole} (${numericLevels[actualRole]}) accessing ${requiredRole} (${numericLevels[requiredRole]}) should be ${expectedAccess}`
          ).toBe(expectedAccess);
        }
      }
    });

    it('proves VIEWER (10) CANNOT access MEMBER (20), OPERATOR (30), ADMIN (40), or OWNER (50)', async () => {
      const viewerId = 'user_viewer_a';
      const workspaceId = 'org_a';

      // VIEWER can access VIEWER
      expect(await verifyWorkspaceRole(workspaceId, viewerId, 'VIEWER', mockD1 as never)).toBe(true);

      // VIEWER fails on all higher roles
      expect(await verifyWorkspaceRole(workspaceId, viewerId, 'MEMBER', mockD1 as never)).toBe(false);
      expect(await verifyWorkspaceRole(workspaceId, viewerId, 'OPERATOR', mockD1 as never)).toBe(false);
      expect(await verifyWorkspaceRole(workspaceId, viewerId, 'ADMIN', mockD1 as never)).toBe(false);
      expect(await verifyWorkspaceRole(workspaceId, viewerId, 'OWNER', mockD1 as never)).toBe(false);

      // requireWorkspaceRole throws InsufficientWorkspaceRoleError with status 403
      await expect(
        requireWorkspaceRole(workspaceId, viewerId, 'OPERATOR', mockD1 as never)
      ).rejects.toThrow(InsufficientWorkspaceRoleError);

      await expect(
        requireWorkspaceRole(workspaceId, viewerId, 'ADMIN', mockD1 as never)
      ).rejects.toThrow(InsufficientWorkspaceRoleError);
    });

    it('proves MEMBER (20) CANNOT access OPERATOR (30), ADMIN (40), or OWNER (50)', async () => {
      const memberId = 'user_member_a';
      const workspaceId = 'org_a';

      // MEMBER can access VIEWER and MEMBER
      expect(await verifyWorkspaceRole(workspaceId, memberId, 'VIEWER', mockD1 as never)).toBe(true);
      expect(await verifyWorkspaceRole(workspaceId, memberId, 'MEMBER', mockD1 as never)).toBe(true);

      // MEMBER fails on OPERATOR, ADMIN, OWNER
      expect(await verifyWorkspaceRole(workspaceId, memberId, 'OPERATOR', mockD1 as never)).toBe(false);
      expect(await verifyWorkspaceRole(workspaceId, memberId, 'ADMIN', mockD1 as never)).toBe(false);
      expect(await verifyWorkspaceRole(workspaceId, memberId, 'OWNER', mockD1 as never)).toBe(false);

      // Throws InsufficientWorkspaceRoleError
      try {
        await requireWorkspaceRole(workspaceId, memberId, 'OPERATOR', mockD1 as never);
        expect.fail('Expected InsufficientWorkspaceRoleError');
      } catch (err) {
        expect(err).toBeInstanceOf(InsufficientWorkspaceRoleError);
        const secErr = err as InsufficientWorkspaceRoleError;
        expect(secErr.status).toBe(403);
        expect(secErr.code).toBe('INSUFFICIENT_WORKSPACE_ROLE');
        expect(secErr.actualRole).toBe('MEMBER');
        expect(secErr.requiredRole).toBe('OPERATOR');
      }
    });

    it('proves OPERATOR (30) CANNOT access ADMIN (40) or OWNER (50)', async () => {
      const operatorId = 'user_operator_a';
      const workspaceId = 'org_a';

      expect(await verifyWorkspaceRole(workspaceId, operatorId, 'VIEWER', mockD1 as never)).toBe(true);
      expect(await verifyWorkspaceRole(workspaceId, operatorId, 'MEMBER', mockD1 as never)).toBe(true);
      expect(await verifyWorkspaceRole(workspaceId, operatorId, 'OPERATOR', mockD1 as never)).toBe(true);

      expect(await verifyWorkspaceRole(workspaceId, operatorId, 'ADMIN', mockD1 as never)).toBe(false);
      expect(await verifyWorkspaceRole(workspaceId, operatorId, 'OWNER', mockD1 as never)).toBe(false);
    });

    it('identifies role normalization behavior on untrusted inputs', () => {
      // Normalization handles case and trimming
      expect(normalizeWorkspaceRole('  viewer  ')).toBe('VIEWER');
      expect(normalizeWorkspaceRole('MeMbEr')).toBe('MEMBER');
      expect(normalizeWorkspaceRole('operator')).toBe('OPERATOR');
      expect(normalizeWorkspaceRole('ADMIN')).toBe('ADMIN');
      expect(normalizeWorkspaceRole('Owner')).toBe('OWNER');

      // Edge case: Unknown role strings default to 'MEMBER' (Level 20)
      // Note: An unrecognized role string does NOT default to the least-privilege role VIEWER (10),
      // it defaults to MEMBER (20)
      expect(normalizeWorkspaceRole('unrecognized_role')).toBe('MEMBER');
      expect(normalizeWorkspaceRole('guest')).toBe('MEMBER');
      expect(normalizeWorkspaceRole('')).toBe('MEMBER');
      expect(normalizeWorkspaceRole(null)).toBe('MEMBER');
      expect(normalizeWorkspaceRole(undefined)).toBe('MEMBER');
    });
  });

  // =========================================================================
  // Challenge Area 2: Fail-Closed Behavior of withTenantScope
  // =========================================================================
  describe('2. Fail-Closed Behavior of withTenantScope', () => {
    it('fails closed (403 WorkspaceAccessError) on empty, whitespace, or invalid workspaceId', async () => {
      await expect(
        withTenantScope({ workspaceId: '', userId: 'user_admin_a', db: mockD1 as never }, async () => 'ok')
      ).rejects.toMatchObject({
        status: 403,
        name: 'WorkspaceAccessError',
      });

      await expect(
        withTenantScope({ workspaceId: '   ', userId: 'user_admin_a', db: mockD1 as never }, async () => 'ok')
      ).rejects.toMatchObject({
        status: 403,
        name: 'WorkspaceAccessError',
      });
    });

    it('fails closed (403 WorkspaceAccessDeniedError) when user has NO membership in the workspace', async () => {
      // Alice (org_a) attempting to access org_b
      await expect(
        withTenantScope(
          {
            workspaceId: 'org_b',
            userId: 'user_member_a',
            db: mockD1 as never,
          },
          async () => 'forbidden'
        )
      ).rejects.toMatchObject({
        status: 403,
        name: 'WorkspaceAccessDeniedError',
        code: 'WORKSPACE_ACCESS_DENIED',
      });
    });

    it('fails closed (403 InsufficientWorkspaceRoleError) when user role is below requiredRole', async () => {
      await expect(
        withTenantScope(
          {
            workspaceId: 'org_a',
            userId: 'user_viewer_a',
            requiredRole: 'OPERATOR',
            db: mockD1 as never,
          },
          async () => 'forbidden'
        )
      ).rejects.toMatchObject({
        status: 403,
        name: 'InsufficientWorkspaceRoleError',
        code: 'INSUFFICIENT_WORKSPACE_ROLE',
        actualRole: 'VIEWER',
        requiredRole: 'OPERATOR',
      });
    });

    it('fails closed (404 WorkspaceNotFoundError) in background worker scope when workspace does not exist', async () => {
      await expect(
        withTenantScope(
          {
            workspaceId: 'org_nonexistent',
            // No userId: background worker scope
            db: mockD1 as never,
          },
          async () => 'forbidden'
        )
      ).rejects.toMatchObject({
        status: 404,
        name: 'WorkspaceNotFoundError',
        code: 'WORKSPACE_NOT_FOUND',
      });
    });

    it('fails closed (403 InsufficientWorkspaceRoleError) in background scope when requiredRole exceeds OPERATOR (e.g. ADMIN)', async () => {
      await expect(
        withTenantScope(
          {
            workspaceId: 'org_a',
            // No userId: background role defaults to OPERATOR
            requiredRole: 'ADMIN',
            db: mockD1 as never,
          },
          async () => 'forbidden'
        )
      ).rejects.toMatchObject({
        status: 403,
        name: 'InsufficientWorkspaceRoleError',
        actualRole: 'OPERATOR',
        requiredRole: 'ADMIN',
      });
    });

    it('propagates internal exceptions safely without bypassing isolation', async () => {
      await expect(
        withTenantScope(
          {
            workspaceId: 'org_a',
            userId: 'user_admin_a',
            db: mockD1 as never,
          },
          async () => {
            throw new Error('Database transaction deadlocked');
          }
        )
      ).rejects.toThrow('Database transaction deadlocked');
    });
  });

  // =========================================================================
  // Challenge Area 3: Cross-Tenant Isolation Verification & Route Adversarial Testing
  // =========================================================================
  describe('3. Cross-Tenant Isolation & Adversarial Attack Scenarios', () => {
    it('strictly prevents authenticated user in Org A from accessing resources in Org B via withTenantScope', async () => {
      // User is Alice in org_a
      setMockUser({ id: 'user_admin_a', email: 'alice@org-a.com' });

      await expect(
        withTenantScope(
          {
            workspaceId: 'org_b',
            userId: 'user_admin_a',
            db: mockD1 as never,
          },
          async () => 'breach'
        )
      ).rejects.toThrow(WorkspaceAccessDeniedError);
    });

    it('proves DELETE /api/creative-memory/[id] (path param) correctly enforces tenant isolation (403)', async () => {
      // Alice (org_a) attempts to delete mem_b1 belonging to org_b via path param
      setMockUser({ id: 'user_admin_a', email: 'alice@org-a.com' });

      const req = new NextRequest('http://localhost/api/creative-memory/mem_b1', { method: 'DELETE' });
      const res = await deleteMemoryPathParam(req, { params: Promise.resolve({ id: 'mem_b1' }) });

      expect(res.status).toBe(403);
      const data = (await res.json()) as { error: string };
      expect(data.error).toBe('Forbidden');
      expect(mockMemories.mem_b1.is_deleted).toBe(0); // Protected!
    });

    it('proves DELETE /api/creative-memory?id=X (query param) strictly enforces tenant isolation (403 on cross-tenant attempt)', async () => {
      // Alice (org_a) attempts to delete mem_b1 belonging to org_b via query param
      setMockUser({ id: 'user_admin_a', email: 'alice@org-a.com' });

      const req = new NextRequest('http://localhost/api/creative-memory?id=mem_b1', { method: 'DELETE' });
      const res = await deleteMemoryQueryParam(req);

      // REMEDIATION VERIFIED: The query-param route handler now verifies tenant isolation!
      // Cross-tenant deletion attempt is rejected with HTTP 403 Forbidden.
      expect(res.status).toBe(403);
      const data = (await res.json()) as { error: string };
      expect(data.error).toBe('Forbidden');
      expect(mockMemories.mem_b1.is_deleted).toBe(0); // Memory is protected from unauthorized deletion!

      // Authorized deletion of own memory (mem_a1 in org_a) succeeds with 200
      const ownReq = new NextRequest('http://localhost/api/creative-memory?id=mem_a1', { method: 'DELETE' });
      const ownRes = await deleteMemoryQueryParam(ownReq);
      expect(ownRes.status).toBe(200);
      const ownData = (await ownRes.json()) as { deleted: boolean };
      expect(ownData.deleted).toBe(true);
      expect(mockMemories.mem_a1.is_deleted).toBe(1); // Deleted successfully by authorized tenant owner
    });
  });
});
