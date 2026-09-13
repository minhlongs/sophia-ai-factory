import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  withTenantScope,
  WorkspaceAccessError,
  WorkspaceAccessDeniedError,
  WorkspaceNotFoundError,
  InsufficientWorkspaceRoleError,
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

describe('tenant-scope: withTenantScope primitive', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function createMockD1({
    members = {} as Record<string, { role?: string } | null>,
    organizations = {} as Record<string, boolean>,
  }) {
    const prepareFn = vi.fn().mockImplementation((sql: string) => {
      if (sql.includes('FROM org_members') && sql.includes('user_id = ?')) {
        return {
          bind: vi.fn().mockImplementation((orgId: string, userId: string) => ({
            first: vi.fn().mockImplementation(() => {
              const key = `${orgId}:${userId}`;
              return Promise.resolve(key in members ? members[key] : null);
            }),
          })),
        };
      }

      if (sql.includes('FROM organizations WHERE id = ?')) {
        return {
          bind: vi.fn().mockImplementation((orgId: string) => ({
            first: vi.fn().mockImplementation(() => {
              return Promise.resolve(organizations[orgId] ? { id: orgId } : null);
            }),
          })),
        };
      }

      if (sql.includes('FROM org_members WHERE org_id = ?')) {
        return {
          bind: vi.fn().mockImplementation((orgId: string) => ({
            first: vi.fn().mockImplementation(() => {
              const hasAny = Object.keys(members).some((k) => k.startsWith(`${orgId}:`));
              return Promise.resolve(hasAny ? { org_id: orgId } : null);
            }),
          })),
        };
      }

      return {
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue(null),
        }),
      };
    });

    return {
      prepare: prepareFn,
      from: vi.fn(),
    };
  }

  it('rejects invalid or missing workspaceId with fail-closed error', async () => {
    const mockDb = createMockD1({});

    await expect(
      withTenantScope({ workspaceId: '', userId: 'u_1', db: mockDb as never }, async () => 'ok')
    ).rejects.toThrow(WorkspaceAccessError);

    await expect(
      withTenantScope({ workspaceId: '   ', userId: 'u_1', db: mockDb as never }, async () => 'ok')
    ).rejects.toThrow(WorkspaceAccessError);

    expect(logger.warn).toHaveBeenCalledWith(
      '[security] workspace_access_denied',
      expect.objectContaining({
        reason: 'invalid_workspace_id',
      })
    );
  });

  it('executes user-scoped block with validated tenant context', async () => {
    const mockDb = createMockD1({
      members: {
        'ws_apple:u_alice': { role: 'admin' },
      },
    });

    const result = await withTenantScope(
      {
        workspaceId: 'ws_apple',
        userId: 'u_alice',
        db: mockDb as never,
      },
      async (scope) => {
        expect(scope.workspaceId).toBe('ws_apple');
        expect(scope.userId).toBe('u_alice');
        expect(scope.role).toBe('ADMIN');
        expect(scope.db).toBeDefined();
        return 'executed_successfully';
      }
    );

    expect(result).toBe('executed_successfully');
  });

  it('blocks cross-tenant access when user attempts to access another organization', async () => {
    const mockDb = createMockD1({
      members: {
        'ws_org_1:u_bob': { role: 'member' },
      },
    });

    // Bob in ws_org_2 (not a member)
    await expect(
      withTenantScope(
        {
          workspaceId: 'ws_org_2',
          userId: 'u_bob',
          db: mockDb as never,
        },
        async () => 'should_not_reach'
      )
    ).rejects.toThrow(WorkspaceAccessDeniedError);

    expect(logger.warn).toHaveBeenCalledWith(
      '[security] workspace_access_denied',
      expect.objectContaining({
        workspaceId: 'ws_org_2',
        userId: 'u_bob',
        reason: 'not_a_member',
      })
    );
  });

  it('enforces requiredRole within user tenant scope', async () => {
    const mockDb = createMockD1({
      members: {
        'ws_1:u_charlie': { role: 'member' },
      },
    });

    // Required OPERATOR, but Charlie has MEMBER
    await expect(
      withTenantScope(
        {
          workspaceId: 'ws_1',
          userId: 'u_charlie',
          requiredRole: 'OPERATOR',
          db: mockDb as never,
        },
        async () => 'forbidden'
      )
    ).rejects.toThrow(InsufficientWorkspaceRoleError);

    // Required VIEWER, Charlie has MEMBER (passes)
    const res = await withTenantScope(
      {
        workspaceId: 'ws_1',
        userId: 'u_charlie',
        requiredRole: 'VIEWER',
        db: mockDb as never,
      },
      async (scope) => {
        return `role:${scope.role}`;
      }
    );
    expect(res).toBe('role:MEMBER');
  });

  it('executes background worker scope without userId when workspace exists in organizations', async () => {
    const mockDb = createMockD1({
      organizations: {
        ws_bg_1: true,
      },
    });

    const result = await withTenantScope(
      {
        workspaceId: 'ws_bg_1',
        db: mockDb as never,
      },
      async (scope) => {
        expect(scope.workspaceId).toBe('ws_bg_1');
        expect(scope.userId).toBeUndefined();
        expect(scope.role).toBe('OPERATOR');
        return 'bg_job_completed';
      }
    );

    expect(result).toBe('bg_job_completed');
  });

  it('executes background worker scope falling back to org_members check if organizations query fails', async () => {
    const mockDb = createMockD1({
      members: {
        'ws_fallback:u_somebody': { role: 'member' },
      },
    });

    const result = await withTenantScope(
      {
        workspaceId: 'ws_fallback',
        db: mockDb as never,
      },
      async (scope) => {
        expect(scope.workspaceId).toBe('ws_fallback');
        expect(scope.role).toBe('OPERATOR');
        return 'fallback_success';
      }
    );

    expect(result).toBe('fallback_success');
  });

  it('throws WorkspaceNotFoundError in background worker context if workspace does not exist', async () => {
    const mockDb = createMockD1({
      organizations: {},
      members: {},
    });

    await expect(
      withTenantScope(
        {
          workspaceId: 'ws_ghost',
          db: mockDb as never,
        },
        async () => 'never'
      )
    ).rejects.toThrow(WorkspaceNotFoundError);

    expect(logger.warn).toHaveBeenCalledWith(
      '[security] workspace_access_denied',
      expect.objectContaining({
        workspaceId: 'ws_ghost',
        reason: 'workspace_not_found',
      })
    );
  });

  it('enforces requiredRole on background worker scope (default role OPERATOR)', async () => {
    const mockDb = createMockD1({
      organizations: {
        ws_bg_role: true,
      },
    });

    // Background has OPERATOR (30). Required ADMIN (40) should be rejected
    await expect(
      withTenantScope(
        {
          workspaceId: 'ws_bg_role',
          requiredRole: 'ADMIN',
          db: mockDb as never,
        },
        async () => 'forbidden'
      )
    ).rejects.toThrow(InsufficientWorkspaceRoleError);

    // Required OPERATOR (30) or MEMBER (20) should pass
    const res = await withTenantScope(
      {
        workspaceId: 'ws_bg_role',
        requiredRole: 'OPERATOR',
        db: mockDb as never,
      },
      async (scope) => scope.role
    );
    expect(res).toBe('OPERATOR');
  });

  it('maintains safety and isolation during nested tenant scope execution', async () => {
    const mockDb = createMockD1({
      members: {
        'ws_outer:u_user': { role: 'admin' },
        'ws_inner:u_user': { role: 'member' },
      },
    });

    const output = await withTenantScope(
      {
        workspaceId: 'ws_outer',
        userId: 'u_user',
        db: mockDb as never,
      },
      async (outerScope) => {
        expect(outerScope.workspaceId).toBe('ws_outer');
        expect(outerScope.role).toBe('ADMIN');

        const innerResult = await withTenantScope(
          {
            workspaceId: 'ws_inner',
            userId: 'u_user',
            db: mockDb as never,
          },
          async (innerScope) => {
            expect(innerScope.workspaceId).toBe('ws_inner');
            expect(innerScope.role).toBe('MEMBER');
            return 'inner_done';
          }
        );

        expect(innerResult).toBe('inner_done');
        // outer scope remains unchanged
        expect(outerScope.workspaceId).toBe('ws_outer');
        return 'outer_done';
      }
    );

    expect(output).toBe('outer_done');
  });

  it('propagates errors thrown within the scoped block without suppressing them', async () => {
    const mockDb = createMockD1({
      members: {
        'ws_err:u_1': { role: 'owner' },
      },
    });

    await expect(
      withTenantScope(
        {
          workspaceId: 'ws_err',
          userId: 'u_1',
          db: mockDb as never,
        },
        async () => {
          throw new Error('Business logic failed');
        }
      )
    ).rejects.toThrow('Business logic failed');
  });
});
