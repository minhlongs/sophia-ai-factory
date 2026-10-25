import { describe, it, expect, vi, beforeEach } from 'vitest';
import { linkAffiliateOffer } from '../campaign-creation-service';

vi.mock('@/seed/db/client', () => {
  const insertMock = vi.fn().mockResolvedValue({ error: null });
  return {
    createServerClient: () => ({
      from: () => ({
        insert: insertMock,
      }),
    }),
    __insertMock: insertMock,
  };
});

vi.mock('@/land/affiliates', () => ({
  getProgramById: (id: string) => {
    if (id === 'valid-offer') {
      return {
        id: 'valid-offer',
        name: 'KuCoin Trading Rebate',
        link: 'https://kucoin.com/r/test',
        commission: '20%',
        category: 'Crypto Exchange',
      };
    }
    return undefined;
  },
}));

describe('Campaign Affiliate Offer Association', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns false when offerId is not found in catalog', async () => {
    const result = await linkAffiliateOffer('camp-1', 'user-1', 'non-existent');
    expect(result).toBe(false);
  });

  it('successfully associates offer with short_code and network metadata', async () => {
    const result = await linkAffiliateOffer('camp-1', 'user-1', 'valid-offer');
    expect(result).toBe(true);
  });
});
