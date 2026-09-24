import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getWhiteLabelBrandingSettingsAction,
  saveWhiteLabelBrandingSettingsAction,
} from '../white-label-actions';

// Mock seed & tree modules
vi.mock('@/seed/db/client', () => ({
  getD1: vi.fn(),
}));

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock('@/seed/auth/is-user-admin', () => ({
  isUserAdminWithRole: vi.fn(),
}));

vi.mock('@/seed/db/get-user-tier', () => ({
  getUserTier: vi.fn(),
}));

vi.mock('@/tree/branding/org-branding-repo', () => ({
  getOrgBranding: vi.fn(),
  upsertOrgBranding: vi.fn(),
  invalidateTenantBrandingCache: vi.fn(),
}));

import { getD1 } from '@/seed/db/client';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { isUserAdminWithRole } from '@/seed/auth/is-user-admin';
import { getUserTier } from '@/seed/db/get-user-tier';
import { getOrgBranding, upsertOrgBranding, invalidateTenantBrandingCache } from '@/tree/branding/org-branding-repo';

describe('white-label-actions', () => {
  const mockOrgId = 'org_test_123';
  const mockUserId = 'user_admin_456';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getWhiteLabelBrandingSettingsAction', () => {
    it('returns UNAUTHORIZED when user is not logged in', async () => {
      vi.mocked(getD1).mockResolvedValue({} as D1Database);
      vi.mocked(getCurrentUser).mockResolvedValue(null);

      const res = await getWhiteLabelBrandingSettingsAction(mockOrgId);

      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error.code).toBe('UNAUTHORIZED');
      }
    });

    it('returns branding settings when user is a platform admin', async () => {
      const mockDb = {
        prepare: vi.fn().mockReturnValue({
          bind: vi.fn().mockReturnValue({
            first: vi.fn().mockResolvedValue({
              value: JSON.stringify({
                agencyName: 'Admin Agency',
                logoUrl: 'https://example.com/logo.png',
                faviconUrl: 'https://example.com/favicon.ico',
                primaryColor: '#6366F1',
                accentColor: '#F59E0B',
              }),
            }),
          }),
        }),
      } as unknown as D1Database;

      vi.mocked(getD1).mockResolvedValue(mockDb);
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: mockUserId,
        email: 'admin@sophia.network',
        role: 'admin',
      });
      vi.mocked(isUserAdminWithRole).mockResolvedValue({ isAdmin: true, dbRole: 'admin' });
      vi.mocked(getOrgBranding).mockResolvedValue({
        org_id: mockOrgId,
        agency_name: 'Admin Agency',
        logo_url: 'https://example.com/logo.png',
        watermark_position: 'bottom-right',
        watermark_opacity: 0.85,
        watermark_policy: 'master_plus',
        primary_color: '#6366F1',
        updated_at: 1000,
        created_at: 1000,
      });

      const res = await getWhiteLabelBrandingSettingsAction(mockOrgId);

      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.value.orgId).toBe(mockOrgId);
        expect(res.value.agencyName).toBe('Admin Agency');
        expect(res.value.primaryColor).toBe('#6366F1');
      }
    });
  });

  describe('saveWhiteLabelBrandingSettingsAction', () => {
    it('persists branding and invalidates cache when authorized', async () => {
      const mockRun = vi.fn().mockResolvedValue({ success: true });
      const mockBind = vi.fn().mockReturnValue({ run: mockRun });
      const mockPrepare = vi.fn().mockReturnValue({
        bind: mockBind,
        first: vi.fn().mockResolvedValue(null),
      });
      const mockDb = { prepare: mockPrepare } as unknown as D1Database;

      vi.mocked(getD1).mockResolvedValue(mockDb);
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: mockUserId,
        email: 'master@agency.com',
        role: 'user',
      });
      vi.mocked(isUserAdminWithRole).mockResolvedValue({ isAdmin: false, dbRole: 'user' });

      // Mock member check and subscription check for MASTER tier
      mockPrepare.mockImplementation((sql: string) => {
        if (sql.includes('org_members')) {
          return {
            bind: vi.fn().mockReturnValue({
              first: vi.fn().mockResolvedValue({ role: 'owner' }),
            }),
          };
        }
        if (sql.includes('subscriptions')) {
          return {
            bind: vi.fn().mockReturnValue({
              first: vi.fn().mockResolvedValue({ tier: 'MASTER', plan: 'master' }),
            }),
          };
        }
        return {
          bind: mockBind,
          first: vi.fn().mockResolvedValue(null),
        };
      });

      vi.mocked(getUserTier).mockResolvedValue('MASTER');

      const res = await saveWhiteLabelBrandingSettingsAction(mockOrgId, {
        agencyName: 'New Studio',
        primaryColor: '#7C3AED',
        accentColor: '#10B981',
      });

      expect(res.ok).toBe(true);
      expect(upsertOrgBranding).toHaveBeenCalledWith(
        mockDb,
        mockOrgId,
        expect.objectContaining({
          agencyName: 'New Studio',
          primaryColor: '#7C3AED',
        }),
      );
      expect(invalidateTenantBrandingCache).toHaveBeenCalledWith(undefined, mockOrgId);
    });

    it('authorizes update when user holds ENTERPRISE tier', async () => {
      const mockRun = vi.fn().mockResolvedValue({ success: true });
      const mockBind = vi.fn().mockReturnValue({ run: mockRun });
      const mockPrepare = vi.fn().mockReturnValue({
        bind: mockBind,
        first: vi.fn().mockResolvedValue(null),
      });
      const mockDb = { prepare: mockPrepare } as unknown as D1Database;

      vi.mocked(getD1).mockResolvedValue(mockDb);
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: mockUserId,
        email: 'enterprise@agency.com',
        role: 'user',
      });
      vi.mocked(isUserAdminWithRole).mockResolvedValue({ isAdmin: false, dbRole: 'user' });

      // Mock member check and subscription check for ENTERPRISE tier
      mockPrepare.mockImplementation((sql: string) => {
        if (sql.includes('org_members')) {
          return {
            bind: vi.fn().mockReturnValue({
              first: vi.fn().mockResolvedValue({ role: 'owner' }),
            }),
          };
        }
        if (sql.includes('subscriptions')) {
          return {
            bind: vi.fn().mockReturnValue({
              first: vi.fn().mockResolvedValue({ tier: 'ENTERPRISE', plan: 'enterprise' }),
            }),
          };
        }
        return {
          bind: mockBind,
          first: vi.fn().mockResolvedValue(null),
        };
      });

      vi.mocked(getUserTier).mockResolvedValue('ENTERPRISE');

      const res = await saveWhiteLabelBrandingSettingsAction(mockOrgId, {
        agencyName: 'Enterprise Studio',
        primaryColor: '#6366F1',
        accentColor: '#10B981',
      });

      expect(res.ok).toBe(true);
      expect(upsertOrgBranding).toHaveBeenCalledWith(
        mockDb,
        mockOrgId,
        expect.objectContaining({
          agencyName: 'Enterprise Studio',
          primaryColor: '#6366F1',
        }),
      );
    });

    it('rejects update if user does not hold MASTER or ENTERPRISE tier', async () => {
      const mockDb = {
        prepare: vi.fn().mockImplementation((sql: string) => {
          if (sql.includes('org_members')) {
            return {
              bind: vi.fn().mockReturnValue({
                first: vi.fn().mockResolvedValue({ role: 'owner' }),
              }),
            };
          }
          if (sql.includes('subscriptions')) {
            return {
              bind: vi.fn().mockReturnValue({
                first: vi.fn().mockResolvedValue({ tier: 'BASIC', plan: 'basic' }),
              }),
            };
          }
          return { bind: vi.fn().mockReturnValue({ first: vi.fn() }) };
        }),
      } as unknown as D1Database;

      vi.mocked(getD1).mockResolvedValue(mockDb);
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: mockUserId,
        email: 'user@basic.com',
        role: 'user',
      });
      vi.mocked(isUserAdminWithRole).mockResolvedValue({ isAdmin: false, dbRole: 'user' });
      vi.mocked(getUserTier).mockResolvedValue('BASIC');

      const res = await saveWhiteLabelBrandingSettingsAction(mockOrgId, {
        agencyName: 'Unauthorized Agency',
      });

      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error.code).toBe('FORBIDDEN');
      }
    });
  });
});
