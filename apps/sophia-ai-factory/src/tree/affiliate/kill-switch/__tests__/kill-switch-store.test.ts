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
  });

  it('reads true from D1 platform config when present', async () => {
    vi.mocked(platformConfigRepo.getPlatformConfig).mockResolvedValue('true');

    const active = await isAffiliateKillSwitchActive('tenant_1');
    expect(active).toBe(true);
  });

  it('updates in-memory cache and persists to D1 on setAffiliateKillSwitch', async () => {
    await setAffiliateKillSwitch(true, 'tenant_1', 'user_admin_123');

    expect(platformConfigRepo.setPlatformConfig).toHaveBeenCalledWith(
      'affiliate_kill_switch_active',
      'true',
      'user_admin_123',
    );

    // Immediate read should hit in-memory cache without re-querying D1
    const active = await isAffiliateKillSwitchActive('tenant_1');
    expect(active).toBe(true);
  });

  it('supports toggling off (false)', async () => {
    await setAffiliateKillSwitch(false, 'tenant_1', 'user_admin_123');

    expect(platformConfigRepo.setPlatformConfig).toHaveBeenCalledWith(
      'affiliate_kill_switch_active',
      'false',
      'user_admin_123',
    );

    const active = await isAffiliateKillSwitchActive('tenant_1');
    expect(active).toBe(false);
  });
});
