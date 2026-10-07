import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  toggleAffiliateKillSwitchAction,
  getAffiliateKillSwitchAction,
} from '../toggle-kill-switch-action';
import * as authSession from '@/seed/auth/better-auth-session';
import * as isUserAdminModule from '@/seed/auth/is-user-admin';
import * as workspaceAccessModule from '@/seed/auth/workspace-access';
import * as killSwitchStore from '@/tree/affiliate/kill-switch/kill-switch-store';

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock('@/seed/auth/is-user-admin', () => ({
  isUserAdminWithRole: vi.fn(),
}));

vi.mock('@/seed/auth/workspace-access', () => ({
  verifyWorkspaceRole: vi.fn(),
}));

vi.mock('@/tree/affiliate/kill-switch/kill-switch-store', () => ({
  setAffiliateKillSwitch: vi.fn().mockResolvedValue(true),
  isAffiliateKillSwitchActive: vi.fn().mockResolvedValue(false),
}));

describe('toggleAffiliateKillSwitchAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fails with UNAUTHORIZED when no authenticated user is found', async () => {
    vi.mocked(authSession.getCurrentUser).mockResolvedValue(null);

    const result = await toggleAffiliateKillSwitchAction({ active: true });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('UNAUTHORIZED');
    }
  });

  it('fails with FORBIDDEN when user lacks admin/operator role for tenant', async () => {
    vi.mocked(authSession.getCurrentUser).mockResolvedValue({
      id: 'usr_regular_001',
      email: 'regular@example.com',
      full_name: 'Regular User',
      role: 'user',
    });
    vi.mocked(isUserAdminModule.isUserAdminWithRole).mockResolvedValue({
      isAdmin: false,
      dbRole: 'user',
    });
    vi.mocked(workspaceAccessModule.verifyWorkspaceRole).mockResolvedValue(false);

    const result = await toggleAffiliateKillSwitchAction({
      active: true,
      tenantId: 'tenant_other_company',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('FORBIDDEN');
      expect(result.error.message).toContain('not authorized');
    }
    expect(killSwitchStore.setAffiliateKillSwitch).not.toHaveBeenCalled();
  });

  it('successfully updates kill switch when user is platform admin', async () => {
    vi.mocked(authSession.getCurrentUser).mockResolvedValue({
      id: 'usr_ceo_001',
      email: 'ceo@example.com',
      full_name: 'CEO User',
      role: 'admin',
    });
    vi.mocked(isUserAdminModule.isUserAdminWithRole).mockResolvedValue({
      isAdmin: true,
      dbRole: 'admin',
    });

    const result = await toggleAffiliateKillSwitchAction({
      active: true,
      tenantId: 'tenant_growth',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.killSwitchActive).toBe(true);
      expect(result.value.tenantId).toBe('tenant_growth');
    }

    expect(killSwitchStore.setAffiliateKillSwitch).toHaveBeenCalledWith(
      true,
      'tenant_growth',
      'usr_ceo_001',
    );
  });

  it('successfully updates kill switch when user is workspace ADMIN in tenant', async () => {
    vi.mocked(authSession.getCurrentUser).mockResolvedValue({
      id: 'usr_lead_002',
      email: 'lead@example.com',
      full_name: 'Lead User',
      role: 'user',
    });
    vi.mocked(isUserAdminModule.isUserAdminWithRole).mockResolvedValue({
      isAdmin: false,
      dbRole: 'user',
    });
    vi.mocked(workspaceAccessModule.verifyWorkspaceRole).mockResolvedValue(true);

    const result = await toggleAffiliateKillSwitchAction({
      active: false,
      tenantId: 'tenant_agency_corp',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.killSwitchActive).toBe(false);
      expect(result.value.tenantId).toBe('tenant_agency_corp');
    }

    expect(killSwitchStore.setAffiliateKillSwitch).toHaveBeenCalledWith(
      false,
      'tenant_agency_corp',
      'usr_lead_002',
    );
  });

  it('getAffiliateKillSwitchAction returns current state for authorized user', async () => {
    vi.mocked(authSession.getCurrentUser).mockResolvedValue({
      id: 'usr_ceo_001',
      email: 'ceo@example.com',
      full_name: 'CEO User',
      role: 'admin',
    });
    vi.mocked(isUserAdminModule.isUserAdminWithRole).mockResolvedValue({
      isAdmin: true,
      dbRole: 'admin',
    });
    vi.mocked(killSwitchStore.isAffiliateKillSwitchActive).mockResolvedValue(true);

    const result = await getAffiliateKillSwitchAction('tenant_growth');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.killSwitchActive).toBe(true);
    }
  });

  it('getAffiliateKillSwitchAction rejects unauthorized query with FORBIDDEN', async () => {
    vi.mocked(authSession.getCurrentUser).mockResolvedValue({
      id: 'usr_attacker_001',
      email: 'attacker@example.com',
      full_name: 'Attacker User',
      role: 'user',
    });
    vi.mocked(isUserAdminModule.isUserAdminWithRole).mockResolvedValue({
      isAdmin: false,
      dbRole: 'user',
    });
    vi.mocked(workspaceAccessModule.verifyWorkspaceRole).mockResolvedValue(false);

    const result = await getAffiliateKillSwitchAction('tenant_victim_corp');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('FORBIDDEN');
    }
  });
});
