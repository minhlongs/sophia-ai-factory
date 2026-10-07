import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  toggleAffiliateKillSwitchAction,
  getAffiliateKillSwitchAction,
} from '../toggle-kill-switch-action';
import * as authSession from '@/seed/auth/better-auth-session';
import * as killSwitchStore from '@/tree/affiliate/kill-switch/kill-switch-store';

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: vi.fn(),
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

  it('successfully updates kill switch when user is authenticated', async () => {
    vi.mocked(authSession.getCurrentUser).mockResolvedValue({
      id: 'usr_ceo_001',
      email: 'ceo@example.com',
      full_name: 'CEO User',
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

  it('getAffiliateKillSwitchAction returns current state for authenticated user', async () => {
    vi.mocked(authSession.getCurrentUser).mockResolvedValue({
      id: 'usr_ceo_001',
      email: 'ceo@example.com',
      full_name: 'CEO User',
    });
    vi.mocked(killSwitchStore.isAffiliateKillSwitchActive).mockResolvedValue(true);

    const result = await getAffiliateKillSwitchAction('tenant_growth');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.killSwitchActive).toBe(true);
    }
  });
});
