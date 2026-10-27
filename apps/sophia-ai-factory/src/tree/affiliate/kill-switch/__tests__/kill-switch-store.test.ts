import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  isAffiliateKillSwitchActive,
  setAffiliateKillSwitch,
  resetKillSwitchInMemoryCache,
} from '../kill-switch-store';
import * as platformConfigRepo from '@/seed/db/platform-config-repo';

vi.mock('@/seed/db/platform-config-repo', () => ({
  getPlatformConfig: vi.fn(),
  setPlatformConfig: vi.fn().mockResolvedValue(undefined),
}));

describe('kill-switch-store', () => {
  beforeEach(() => {
    resetKillSwitchInMemoryCache();
    vi.clearAllMocks();
  });

  it('defaults to false when no KV or D1 config is found', async () => {
    vi.mocked(platformConfigRepo.getPlatformConfig).mockResolvedValue(null);

    const active = await isAffiliateKillSwitchActive('tenant_1');
    expect(active).toBe(false);
    expect(platformConfigRepo.getPlatformConfig).toHaveBeenCalledWith(
      'affiliate_kill_switch_active:tenant_1',
    );
  });

  it('reads true from tenant-scoped D1 platform config when present', async () => {
    vi.mocked(platformConfigRepo.getPlatformConfig).mockImplementation(async (key) => {
      if (key === 'affiliate_kill_switch_active:tenant_1') return 'true';
      return null;
    });

    const active = await isAffiliateKillSwitchActive('tenant_1');
    expect(active).toBe(true);
  });

  it('halts all tenants when platform-wide default kill switch is engaged', async () => {
    vi.mocked(platformConfigRepo.getPlatformConfig).mockResolvedValue(null);
    await setAffiliateKillSwitch(false, 'tenant_X', 'admin_X');
    await setAffiliateKillSwitch(true, 'default', 'platform_operator');

    //Even though tenant_X switch is false, platform-wide ('default') is true
    expect(await isAffiliateKillSwitchActive('tenant_X')).toBe(true);
  });

  it('updates in-memory cache and persists tenant-scoped key to D1 on setAffiliateKillSwitch', async () => {
    await setAffiliateKillSwitch(true, 'tenant_1', 'user_admin_123');

    expect(platformConfigRepo.setPlatformConfig).toHaveBeenCalledWith(
      'affiliate_kill_switch_active:tenant_1',
      'true',
      'user_admin_123',
    );

    const active = await isAffiliateKillSwitchActive('tenant_1');
    expect(active).toBe(true);
  });

  it('supports toggling off (false) with strict tenant isolation', async () => {
    await setAffiliateKillSwitch(true, 'tenant_A', 'admin_A');
    await setAffiliateKillSwitch(false, 'tenant_B', 'admin_B');

    expect(platformConfigRepo.setPlatformConfig).toHaveBeenCalledWith(
      'affiliate_kill_switch_active:tenant_A',
      'true',
      'admin_A',
    );
    expect(platformConfigRepo.setPlatformConfig).toHaveBeenCalledWith(
      'affiliate_kill_switch_active:tenant_B',
      'false',
      'admin_B',
    );

    expect(await isAffiliateKillSwitchActive('tenant_A')).toBe(true);
    expect(await isAffiliateKillSwitchActive('tenant_B')).toBe(false);
  });
});
