'use client';

import type { MockAffiliate } from '../mock-affiliates';

export interface AffiliateStats {
  total?: number;
  active?: number;
  totalCommission?: string;
  pendingCommission?: string;
}

export interface AffiliatesPageProps {
  initialAffiliates?: MockAffiliate[];
  stats?: AffiliateStats;
  initialStats?: AffiliateStats;
}
