import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFrom = vi.fn();

vi.mock('@/seed/db/client', () => ({
  createServerClient: () => ({
    from: mockFrom,
  }),
  getD1: vi.fn().mockResolvedValue(null),
}));

import { loadUserCampaigns, deleteUserCampaign } from '../campaign-loader';
import { loadProductsWithSubscriberCounts } from '@/land/billing/product-catalog-loader';
import { requireMfaIfEnabled } from '@/seed/auth/mfa/login-challenge';

describe('BE-FE 2027 Sync — Domain Loaders & MFA Bridge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loadUserCampaigns maps D1 rows into Campaign UI cards', async () => {
    mockFrom.mockReturnValue({
      select: () => ({
        eq: () => ({
          order: () => ({
            limit: vi.fn().mockResolvedValue({
              data: [
                {
                  id: 'camp_123',
                  title: 'AI SaaS Flywheel',
                  topic: 'Tech Reviews',
                  status: 'completed',
                  progress: 100,
                  created_at: '2026-10-26T00:00:00.000Z',
                },
              ],
            }),
          }),
        }),
      }),
    });

    const campaigns = await loadUserCampaigns('user_1');
    expect(campaigns).toHaveLength(1);
    expect(campaigns[0]?.id).toBe('camp_123');
    expect(campaigns[0]?.status).toBe('done');
    expect(campaigns[0]?.progress).toBe(100);
  });

  it('deleteUserCampaign deletes scoped by id and user_id', async () => {
    const eqUser = vi.fn().mockResolvedValue({ data: null });
    const eqId = vi.fn().mockReturnValue({ eq: eqUser });
    mockFrom.mockReturnValue({
      delete: () => ({ eq: eqId }),
    });

    const res = await deleteUserCampaign('user_1', 'camp_123');
    expect(res.success).toBe(true);
    expect(eqId).toHaveBeenCalledWith('id', 'camp_123');
    expect(eqUser).toHaveBeenCalledWith('user_id', 'user_1');
  });

  it('loadProductsWithSubscriberCounts aggregates active subscriptions by tier', async () => {
    mockFrom.mockReturnValue({
      select: () => ({
        eq: vi.fn().mockResolvedValue({
          data: [
            { tier: 'BASIC', status: 'active' },
            { tier: 'BASIC', status: 'active' },
            { tier: 'PREMIUM', status: 'active' },
            { tier: 'MASTER', status: 'active' },
          ],
        }),
      }),
    });

    const products = await loadProductsWithSubscriberCounts();
    const basic = products.find((p) => p.id === 'starter');
    const growth = products.find((p) => p.id === 'growth');
    const master = products.find((p) => p.id === 'master');

    expect(basic?.subscribers).toBe(2);
    expect(growth?.subscribers).toBe(1);
    expect(master?.subscribers).toBe(1);
  });

  it('requireMfaIfEnabled returns true when Better Auth user.twoFactorEnabled is 1', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'user') {
        return {
          select: () => ({
            eq: () => ({
              single: vi.fn().mockResolvedValue({ data: { twoFactorEnabled: 1 } }),
            }),
          }),
        };
      }
      return {
        select: () => ({
          eq: () => ({
            single: vi.fn().mockResolvedValue({ data: { totp_enabled: 0 } }),
          }),
        }),
      };
    });

    const check = await requireMfaIfEnabled('user_2fa');
    expect(check.required).toBe(true);
  });
});
