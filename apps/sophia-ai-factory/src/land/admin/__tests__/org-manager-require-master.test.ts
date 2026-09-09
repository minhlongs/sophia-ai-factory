import { describe, it, expect, vi, beforeEach } from 'vitest';
import { requireMaster } from '@/land/admin/org-manager';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { isUserAdminWithRole } from '@/seed/auth/is-user-admin';
import { getD1 } from '@/seed/db/client';

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock('@/seed/auth/is-user-admin', () => ({
  isUserAdminWithRole: vi.fn(),
}));

vi.mock('@/seed/db/client', () => ({
  getD1: vi.fn(),
}));

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

const mockGetCurrentUser = vi.mocked(getCurrentUser);
const mockIsUserAdminWithRole = vi.mocked(isUserAdminWithRole);
const mockGetD1 = vi.mocked(getD1);

describe('org-manager requireMaster', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns UNAUTHORIZED when user is not authenticated', async () => {
    mockGetCurrentUser.mockResolvedValue(null);

    const result = await requireMaster();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('UNAUTHORIZED');
      expect(result.error.message).toBe('Not authenticated');
    }
  });

  it('returns success when user is admin via isUserAdminWithRole', async () => {
    mockGetCurrentUser.mockResolvedValue({
      id: 'usr_admin',
      email: 'admin@agencyos.network',
      role: 'user', // session role is 'user' but DB role is 'admin'
    });
    mockIsUserAdminWithRole.mockResolvedValue({
      isAdmin: true,
      dbRole: 'admin',
    });

    const result = await requireMaster();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.userId).toBe('usr_admin');
    }
    // D1 subscription query should be bypassed
    expect(mockGetD1).not.toHaveBeenCalled();
  });

  it('returns success when user is admin via session user.role === "admin"', async () => {
    mockGetCurrentUser.mockResolvedValue({
      id: 'usr_admin_2',
      email: 'admin2@agencyos.network',
      role: 'admin',
    });
    mockIsUserAdminWithRole.mockResolvedValue({
      isAdmin: false,
      dbRole: 'user',
    });

    const result = await requireMaster();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.userId).toBe('usr_admin_2');
    }
    expect(mockGetD1).not.toHaveBeenCalled();
  });

  it('returns success when non-admin user has active MASTER subscription', async () => {
    mockGetCurrentUser.mockResolvedValue({
      id: 'usr_master',
      email: 'master@agencyos.network',
      role: 'user',
    });
    mockIsUserAdminWithRole.mockResolvedValue({
      isAdmin: false,
      dbRole: 'user',
    });

    const mockFirst = vi.fn().mockResolvedValue({ tier: 'MASTER' });
    const mockBind = vi.fn().mockReturnValue({ first: mockFirst });
    const mockPrepare = vi.fn().mockReturnValue({ bind: mockBind });

    mockGetD1.mockResolvedValue({
      prepare: mockPrepare,
    } as unknown as Awaited<ReturnType<typeof getD1>>);

    const result = await requireMaster();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.userId).toBe('usr_master');
    }
  });

  it('returns FORBIDDEN when non-admin user has non-MASTER subscription', async () => {
    mockGetCurrentUser.mockResolvedValue({
      id: 'usr_basic',
      email: 'basic@agencyos.network',
      role: 'user',
    });
    mockIsUserAdminWithRole.mockResolvedValue({
      isAdmin: false,
      dbRole: 'user',
    });

    const mockFirst = vi.fn().mockResolvedValue({ tier: 'BASIC' });
    const mockBind = vi.fn().mockReturnValue({ first: mockFirst });
    const mockPrepare = vi.fn().mockReturnValue({ bind: mockBind });

    mockGetD1.mockResolvedValue({
      prepare: mockPrepare,
    } as unknown as Awaited<ReturnType<typeof getD1>>);

    const result = await requireMaster();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('FORBIDDEN');
      expect(result.error.message).toBe('MASTER tier required');
    }
  });

  it('returns FORBIDDEN when non-admin user has no active subscription', async () => {
    mockGetCurrentUser.mockResolvedValue({
      id: 'usr_no_sub',
      email: 'nosub@agencyos.network',
      role: 'user',
    });
    mockIsUserAdminWithRole.mockResolvedValue({
      isAdmin: false,
      dbRole: 'user',
    });

    const mockFirst = vi.fn().mockResolvedValue(null);
    const mockBind = vi.fn().mockReturnValue({ first: mockFirst });
    const mockPrepare = vi.fn().mockReturnValue({ bind: mockBind });

    mockGetD1.mockResolvedValue({
      prepare: mockPrepare,
    } as unknown as Awaited<ReturnType<typeof getD1>>);

    const result = await requireMaster();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('FORBIDDEN');
      expect(result.error.message).toBe('MASTER tier required');
    }
  });

  it('returns DB_UNAVAILABLE when database binding is not available for non-admin check', async () => {
    mockGetCurrentUser.mockResolvedValue({
      id: 'usr_regular',
      email: 'user@agencyos.network',
      role: 'user',
    });
    mockIsUserAdminWithRole.mockResolvedValue({
      isAdmin: false,
      dbRole: 'user',
    });
    mockGetD1.mockResolvedValue(null);

    const result = await requireMaster();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('DB_UNAVAILABLE');
    }
  });

  it('returns INTERNAL when D1 query throws an unexpected error', async () => {
    mockGetCurrentUser.mockResolvedValue({
      id: 'usr_err',
      email: 'user@agencyos.network',
      role: 'user',
    });
    mockIsUserAdminWithRole.mockResolvedValue({
      isAdmin: false,
      dbRole: 'user',
    });

    mockGetD1.mockResolvedValue({
      prepare: vi.fn().mockImplementation(() => {
        throw new Error('D1 execution failed');
      }),
    } as unknown as Awaited<ReturnType<typeof getD1>>);

    const result = await requireMaster();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('INTERNAL');
      expect(result.error.message).toBe('D1 execution failed');
    }
  });
});
