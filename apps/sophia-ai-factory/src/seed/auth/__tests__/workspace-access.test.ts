import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ROLE_HIERARCHY,
  WORKSPACE_ROLE_HIERARCHY,
  normalizeWorkspaceRole,
  hasMinimumRole,
  WorkspaceAccessError,
  WorkspaceAccessDeniedError,
  WorkspaceNotFoundError,
  InsufficientWorkspaceRoleError,
  getWorkspaceMembership,
  verifyWorkspaceAccess,
  verifyWorkspaceRole,
  requireWorkspaceAccess,
  requireWorkspaceRole,
  type WorkspaceRole,
} from '../workspace-access';
import { logger } from '@/seed/utils/logger-utility';

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('workspace-access: Role Hierarchy & Normalization', () => {
  it('defines the correct role hierarchy order', () => {
    expect(ROLE_HIERARCHY.OWNER).toBe(50);
    expect(ROLE_HIERARCHY.ADMIN).toBe(40);
    expect(ROLE_HIERARCHY.OPERATOR).toBe(30);
    expect(ROLE_HIERARCHY.MEMBER).toBe(20);
    expect(ROLE_HIERARCHY.VIEWER).toBe(10);
    expect(WORKSPACE_ROLE_HIERARCHY).toEqual(ROLE_HIERARCHY);

    expect(ROLE_HIERARCHY.OWNER).toBeGreaterThan(ROLE_HIERARCHY.ADMIN);
    expect(ROLE_HIERARCHY.ADMIN).toBeGreaterThan(ROLE_HIERARCHY.OPERATOR);
    expect(ROLE_HIERARCHY.OPERATOR).toBeGreaterThan(ROLE_HIERARCHY.MEMBER);
    expect(ROLE_HIERARCHY.MEMBER).toBeGreaterThan(ROLE_HIERARCHY.VIEWER);
  });

  it('normalizes roles with case-insensitivity and trimming', () => {
    expect(normalizeWorkspaceRole('owner')).toBe('OWNER');
    expect(normalizeWorkspaceRole('  Admin  ')).toBe('ADMIN');
    expect(normalizeWorkspaceRole('Operator')).toBe('OPERATOR');
    expect(normalizeWorkspaceRole('mEmBeR')).toBe('MEMBER');
    expect(normalizeWorkspaceRole('VIEWER')).toBe('VIEWER');
  });

  it('defaults invalid, empty, or nullish inputs to MEMBER', () => {
    expect(normalizeWorkspaceRole(null)).toBe('MEMBER');
    expect(normalizeWorkspaceRole(undefined)).toBe('MEMBER');
    expect(normalizeWorkspaceRole('')).toBe('MEMBER');
    expect(normalizeWorkspaceRole('unknown_role')).toBe('MEMBER');
    expect(normalizeWorkspaceRole('superadmin')).toBe('MEMBER');
  });

  it('correctly evaluates hasMinimumRole', () => {
    // OWNER satisfies all roles
    expect(hasMinimumRole('OWNER', 'OWNER')).toBe(true);
    expect(hasMinimumRole('owner', 'ADMIN')).toBe(true);
    expect(hasMinimumRole('OWNER', 'OPERATOR')).toBe(true);
    expect(hasMinimumRole('OWNER', 'MEMBER')).toBe(true);
    expect(hasMinimumRole('OWNER', 'VIEWER')).toBe(true);

    // ADMIN satisfies OPERATOR, MEMBER, VIEWER, but not OWNER
    expect(hasMinimumRole('ADMIN', 'OWNER')).toBe(false);
    expect(hasMinimumRole('admin', 'admin')).toBe(true);
    expect(hasMinimumRole('ADMIN', 'OPERATOR')).toBe(true);
    expect(hasMinimumRole('ADMIN', 'MEMBER')).toBe(true);
    expect(hasMinimumRole('ADMIN', 'VIEWER')).toBe(true);

    // OPERATOR satisfies MEMBER and VIEWER
    expect(hasMinimumRole('OPERATOR', 'ADMIN')).toBe(false);
    expect(hasMinimumRole('operator', 'OPERATOR')).toBe(true);
    expect(hasMinimumRole('OPERATOR', 'MEMBER')).toBe(true);
    expect(hasMinimumRole('OPERATOR', 'VIEWER')).toBe(true);

    // MEMBER satisfies only MEMBER and VIEWER
    expect(hasMinimumRole('MEMBER', 'OPERATOR')).toBe(false);
    expect(hasMinimumRole('member', 'MEMBER')).toBe(true);
    expect(hasMinimumRole('MEMBER', 'VIEWER')).toBe(true);

    // VIEWER satisfies only VIEWER
    expect(hasMinimumRole('VIEWER', 'MEMBER')).toBe(false);
    expect(hasMinimumRole('viewer', 'VIEWER')).toBe(true);
  });
});

describe('workspace-access: Typed Security Errors', () => {
  it('instantiates WorkspaceAccessError with correct properties', () => {
    const err = new WorkspaceAccessError('Forbidden', 'ws_1', 'u_1', 'CUSTOM_DENIED', 403);
    expect(err.name).toBe('WorkspaceAccessError');
    expect(err.message).toBe('Forbidden');
    expect(err.workspaceId).toBe('ws_1');
    expect(err.userId).toBe('u_1');
    expect(err.status).toBe(403);
    expect(err.code).toBe('CUSTOM_DENIED');
  });

  it('instantiates WorkspaceAccessDeniedError with status 403', () => {
    const err = new WorkspaceAccessDeniedError('Access denied', 'ws_1', 'u_1');
    expect(err).toBeInstanceOf(WorkspaceAccessError);
    expect(err.name).toBe('WorkspaceAccessDeniedError');
    expect(err.status).toBe(403);
    expect(err.code).toBe('WORKSPACE_ACCESS_DENIED');
    expect(err.workspaceId).toBe('ws_1');
    expect(err.userId).toBe('u_1');
  });

  it('instantiates WorkspaceNotFoundError with status 404', () => {
    const err = new WorkspaceNotFoundError('Not found', 'ws_unknown');
    expect(err).toBeInstanceOf(WorkspaceAccessError);
    expect(err.name).toBe('WorkspaceNotFoundError');
    expect(err.status).toBe(404);
    expect(err.code).toBe('WORKSPACE_NOT_FOUND');
    expect(err.workspaceId).toBe('ws_unknown');
    expect(err.userId).toBeUndefined();
  });

  it('instantiates InsufficientWorkspaceRoleError with status 403 and role details', () => {
    const err = new InsufficientWorkspaceRoleError(
      'Requires admin',
      'ws_1',
      'ADMIN',
      'MEMBER',
      'u_1'
    );
    expect(err).toBeInstanceOf(WorkspaceAccessError);
    expect(err.name).toBe('InsufficientWorkspaceRoleError');
    expect(err.status).toBe(403);
    expect(err.code).toBe('INSUFFICIENT_WORKSPACE_ROLE');
    expect(err.requiredRole).toBe('ADMIN');
    expect(err.actualRole).toBe('MEMBER');
    expect(err.workspaceId).toBe('ws_1');
    expect(err.userId).toBe('u_1');
  });
});

describe('workspace-access: Verification Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function createMockD1(rows: Record<string, { role?: string } | null>) {
    const firstFn = vi.fn().mockImplementation(function (this: { boundKey?: string }) {
      const key = this.boundKey;
      return Promise.resolve(key && key in rows ? rows[key] : null);
    });

    const bindFn = vi.fn().mockImplementation((orgId: string, userId: string) => {
      return {
        first: firstFn.bind({ boundKey: `${orgId}:${userId}` }),
      };
    });

    const prepareFn = vi.fn().mockReturnValue({
      bind: bindFn,
    });

    return {
      prepare: prepareFn,
      firstFn,
      bindFn,
    };
  }

  it('returns null and logs warning for missing workspaceId or userId in getWorkspaceMembership', async () => {
    const mockDb = createMockD1({});
    expect(await getWorkspaceMembership('', 'u_1', mockDb as never)).toBeNull();
    expect(await getWorkspaceMembership('ws_1', '', mockDb as never)).toBeNull();
  });

  it('returns membership with normalized role when found', async () => {
    const mockDb = createMockD1({
      'ws_1:u_admin': { role: 'admin' },
      'ws_1:u_owner': { role: 'OWNER' },
      'ws_1:u_empty': {}, // Mock D1 object returning empty object
    });

    const admin = await getWorkspaceMembership('ws_1', 'u_admin', mockDb as never);
    expect(admin).toEqual({ role: 'ADMIN' });

    const owner = await getWorkspaceMembership('ws_1', 'u_owner', mockDb as never);
    expect(owner).toEqual({ role: 'OWNER' });

    const empty = await getWorkspaceMembership('ws_1', 'u_empty', mockDb as never);
    expect(empty).toEqual({ role: 'MEMBER' }); // defaults to MEMBER on empty row
  });

  it('returns null when user is not a member of the workspace (cross-tenant rejection)', async () => {
    const mockDb = createMockD1({
      'ws_org_a:u_1': { role: 'admin' },
    });

    // User 1 in Org A has access
    const resA = await verifyWorkspaceAccess('ws_org_a', 'u_1', mockDb as never);
    expect(resA).toBe(true);

    // User 1 in Org B does NOT have access (cross-tenant isolation)
    const resB = await verifyWorkspaceAccess('ws_org_b', 'u_1', mockDb as never);
    expect(resB).toBe(false);

    expect(logger.warn).toHaveBeenCalledWith(
      '[security] workspace_access_denied',
      expect.objectContaining({
        workspaceId: 'ws_org_b',
        userId: 'u_1',
        reason: 'not_a_member',
      })
    );
  });

  it('returns false and emits security telemetry on empty/missing parameters', async () => {
    const mockDb = createMockD1({});
    const res = await verifyWorkspaceAccess('', 'u_1', mockDb as never);
    expect(res).toBe(false);
    expect(logger.warn).toHaveBeenCalledWith(
      '[security] workspace_access_denied',
      expect.objectContaining({
        reason: 'missing_parameters',
      })
    );
  });

  it('evaluates verifyWorkspaceRole with role hierarchy and security telemetry', async () => {
    const mockDb = createMockD1({
      'ws_1:u_member': { role: 'member' },
      'ws_1:u_admin': { role: 'admin' },
    });

    // Member has MEMBER role
    expect(await verifyWorkspaceRole('ws_1', 'u_member', 'MEMBER', mockDb as never)).toBe(true);
    // Member does not have ADMIN role
    expect(await verifyWorkspaceRole('ws_1', 'u_member', 'ADMIN', mockDb as never)).toBe(false);
    expect(logger.warn).toHaveBeenCalledWith(
      '[security] workspace_access_denied',
      expect.objectContaining({
        workspaceId: 'ws_1',
        userId: 'u_member',
        requiredRole: 'ADMIN',
        actualRole: 'MEMBER',
        reason: 'insufficient_role',
      })
    );

    // Admin has OPERATOR, MEMBER, and ADMIN roles
    expect(await verifyWorkspaceRole('ws_1', 'u_admin', 'OPERATOR', mockDb as never)).toBe(true);
    expect(await verifyWorkspaceRole('ws_1', 'u_admin', 'ADMIN', mockDb as never)).toBe(true);
    expect(await verifyWorkspaceRole('ws_1', 'u_admin', 'OWNER', mockDb as never)).toBe(false);
  });

  it('requireWorkspaceAccess returns role on success, throws WorkspaceAccessDeniedError on failure', async () => {
    const mockDb = createMockD1({
      'ws_1:u_1': { role: 'operator' },
    });

    const membership = await requireWorkspaceAccess('ws_1', 'u_1', mockDb as never);
    expect(membership).toEqual({ role: 'OPERATOR' });

    await expect(requireWorkspaceAccess('ws_1', 'u_nonmember', mockDb as never)).rejects.toThrow(
      WorkspaceAccessDeniedError
    );

    await expect(requireWorkspaceAccess('', 'u_1', mockDb as never)).rejects.toThrow(
      WorkspaceAccessDeniedError
    );
  });

  it('requireWorkspaceRole returns role on success, throws InsufficientWorkspaceRoleError when below required role', async () => {
    const mockDb = createMockD1({
      'ws_1:u_member': { role: 'member' },
    });

    const res = await requireWorkspaceRole('ws_1', 'u_member', 'VIEWER', mockDb as never);
    expect(res).toEqual({ role: 'MEMBER' });

    await expect(
      requireWorkspaceRole('ws_1', 'u_member', 'ADMIN', mockDb as never)
    ).rejects.toThrow(InsufficientWorkspaceRoleError);
  });

  it('gracefully handles database errors during membership lookup', async () => {
    const failingDb = {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockRejectedValue(new Error('D1 connection timeout')),
        }),
      }),
    };

    const res = await verifyWorkspaceAccess('ws_1', 'u_1', failingDb as never);
    expect(res).toBe(false);
    expect(logger.warn).toHaveBeenCalledWith(
      '[security] workspace_membership_lookup_error',
      expect.objectContaining({
        workspaceId: 'ws_1',
        userId: 'u_1',
        error: 'D1 connection timeout',
      })
    );
  });
});
