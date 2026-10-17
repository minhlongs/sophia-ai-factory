import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { D1Database } from '@cloudflare/workers-types';
import type { PartnerProfile } from '@/tree/partners/types';

vi.mock('./partner-profile', () => ({ getPartnerById: vi.fn() }));
vi.mock('./whitelabel-config', () => ({ getWhitelabelConfigByPartnerId: vi.fn() }));
vi.mock('./commission-math', () => ({ calculateNextTierProgress: vi.fn(() => ({ nextTier: 'GOLD', progressPct: 50 })) }));

import { getPartnerById } from './partner-profile';
import { getWhitelabelConfigByPartnerId } from './whitelabel-config';
import { getPartnerDashboardData } from './partner-dashboard-query';

const profile = { id: 'partner-1', tier: 'SILVER', total_referred_customers: 5, total_mrr_cents: 1000 } as PartnerProfile;

function makeDb(results: unknown) {
  return {
    prepare: vi.fn(() => ({ bind: vi.fn(() => ({ all: vi.fn().mockResolvedValue({ results }) })) })),
  } as unknown as D1Database;
}

describe('partner dashboard query', () => {
  beforeEach(() => vi.clearAllMocks());

  it('throws when the partner profile does not exist', async () => {
    vi.mocked(getPartnerById).mockResolvedValue(null);
    await expect(getPartnerDashboardData(makeDb([]), 'missing')).rejects.toThrow('Partner not found: missing');
    expect(getWhitelabelConfigByPartnerId).not.toHaveBeenCalled();
  });

  it('aggregates profile, branding, commissions, and tier progress', async () => {
    vi.mocked(getPartnerById).mockResolvedValue(profile);
    vi.mocked(getWhitelabelConfigByPartnerId).mockResolvedValue(null);
    const commissions = [{ id: 'commission-1' }];
    const result = await getPartnerDashboardData(makeDb(commissions), 'partner-1');
    expect(result).toEqual({
      profile,
      whitelabelConfig: null,
      recentCommissions: commissions,
      nextTier: { nextTier: 'GOLD', progressPct: 50 },
    });
  });

  it('returns an empty commission list when the D1 result is absent', async () => {
    vi.mocked(getPartnerById).mockResolvedValue(profile);
    vi.mocked(getWhitelabelConfigByPartnerId).mockResolvedValue(null);
    await expect(getPartnerDashboardData(makeDb(undefined), 'partner-1')).resolves.toMatchObject({ recentCommissions: [] });
  });
});
