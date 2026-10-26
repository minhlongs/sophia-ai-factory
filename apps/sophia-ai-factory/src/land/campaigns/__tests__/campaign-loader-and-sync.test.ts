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

  it('loadUserCampaigns maps D1 rows across all statuses and fallbacks', async () => {
    mockFrom.mockReturnValueOnce({
      select: () => ({
        eq: () => ({
          order: () => ({
            limit: vi.fn().mockResolvedValue({
              data: [
                { id: 'c1', title: 'Done Camp', topic: 'Tech', status: 'completed', progress: 100, created_at: '2026-10-26T00:00:00Z' },
                { id: 'c2', title: '', topic: 'Paused Camp', status: 'paused', progress: null, created_at: null },
                { id: 'c3', title: null, topic: null, status: 'running', progress: 50, created_at: '2026-10-26T00:00:00Z' },
                { id: 'c4', title: 'Draft Camp', topic: 'Finance', status: 'queued', progress: null, created_at: null },
              ],
            }),
          }),
        }),
      }),
    });

    const campaigns = await loadUserCampaigns('user_1');
    expect(campaigns).toHaveLength(4);
    expect(campaigns[0]?.status).toBe('done');
    expect(campaigns[1]?.status).toBe('paused');
    expect(campaigns[1]?.title).toBe('Paused Camp');
    expect(campaigns[2]?.status).toBe('live');
    expect(campaigns[2]?.title).toBe('Untitled Campaign');
    expect(campaigns[3]?.status).toBe('draft');
    expect(campaigns[3]?.action).toBe('Continue Draft');

    mockFrom.mockImplementationOnce(() => {
      throw new Error('DB offline');
    });
    expect(await loadUserCampaigns('user_1')).toEqual([]);
  });

  it('deleteUserCampaign deletes scoped by id and user_id and handles errors', async () => {
    const eqUser = vi.fn().mockResolvedValue({ data: null });
    const eqId = vi.fn().mockReturnValue({ eq: eqUser });
    mockFrom.mockReturnValueOnce({
      delete: () => ({ eq: eqId }),
    });

    const res = await deleteUserCampaign('user_1', 'camp_123');
    expect(res.success).toBe(true);
    expect(eqId).toHaveBeenCalledWith('id', 'camp_123');
    expect(eqUser).toHaveBeenCalledWith('user_id', 'user_1');

    mockFrom.mockImplementationOnce(() => {
      throw new Error('Delete fail');
    });
    const failRes = await deleteUserCampaign('user_1', 'camp_123');
    expect(failRes.success).toBe(false);
  });

  it('loadProductsWithSubscriberCounts aggregates active subscriptions and handles errors', async () => {
    mockFrom.mockReturnValueOnce({
      select: () => ({
        eq: vi.fn().mockResolvedValue({
          data: [
            { tier: 'BASIC', status: 'active' },
            { tier: 'BASIC', status: 'active' },
            { tier: 'PREMIUM', status: 'active' },
            { tier: 'MASTER', status: 'active' },
            { tier: null, status: 'active' },
          ],
        }),
      }),
    });

    const products = await loadProductsWithSubscriberCounts();
    expect(products.find((p) => p.id === 'starter')?.subscribers).toBe(2);
    expect(products.find((p) => p.id === 'growth')?.subscribers).toBe(1);
    expect(products.find((p) => p.id === 'master')?.subscribers).toBe(1);

    mockFrom.mockImplementationOnce(() => {
      throw new Error('DB fail');
    });
    const fallback = await loadProductsWithSubscriberCounts();
    expect(fallback.length).toBeGreaterThan(0);
  });

  it('requireMfaIfEnabled returns true when Better Auth user.twoFactorEnabled is 1', async () => {
    mockFrom.mockImplementation((table: string) => ({
      select: () => ({
        eq: () => ({
          single: vi.fn().mockResolvedValue({
            data: table === 'user' ? { twoFactorEnabled: 1 } : { totp_enabled: 0 },
          }),
        }),
      }),
    }));

    const check = await requireMfaIfEnabled('user_2fa');
    expect(check.required).toBe(true);
  });
});
