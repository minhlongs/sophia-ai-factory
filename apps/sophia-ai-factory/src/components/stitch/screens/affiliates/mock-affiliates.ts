export interface MockAffiliate {
  id: string;
  name: string;
  email: string;
  status: 'active' | 'pending';
  totalSales: number;
  totalCommission: string;
  pending: string;
  avatar: string | null;
}

/**
 * Zero-mock affiliate partner repository contract.
 * Static mock data purged — empty by default, populated via live D1 queries.
 */
export const mockAffiliates: MockAffiliate[] = [];
export const EMPTY_AFFILIATES: MockAffiliate[] = [];
